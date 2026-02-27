---
module: "VM Server + Relay"
date: "2026-02-26"
problem_type: best_practice
component: "Screenshot delivery pipeline (Playwright -> JPEG -> image proxy -> WhatsApp)"
symptoms:
  - "No way to show users visual results (screenshots) of running applications"
  - "Claude Code commands had no mechanism to capture browser state"
  - "Relay server had no facility to proxy and deliver images to the messaging transport"
  - "Media delivery between isolated Docker container and remote users was unimplemented"
root_cause: "Building a visual interface for an agentic development cockpit requires an end-to-end media pipeline spanning VM execution, file storage, relay proxying, and transport-layer delivery — each layer has different constraints (temporary storage, size limits, media quotas per message)"
resolution_type: code_fix
severity: high
tags:
  - media-pipeline
  - playwright-integration
  - image-proxy
  - ttl-based-cleanup
  - docker-first-development
  - whatsapp-constraints
  - screenshot-capture
  - jpeg-compression
---

# Best Practice: Screenshot Delivery Pipeline (Playwright + Relay + WhatsApp)

## Problem

Before Phase 4, the WhatsApp agentic cockpit had no way to deliver visual content to users. Claude Code could run commands and return text output, but could not capture or display screenshots of running applications back to the user's phone.

## Environment

- Module: VM Server (`vm/vm-server.js`) + Relay (`server.js`)
- Affected Component: Screenshot capture, image serving, relay proxy, WhatsApp media delivery
- Date: 2026-02-26

## Solution Architecture

The screenshot pipeline creates a three-layer delivery mechanism: Claude Code captures screenshots via a REST endpoint on the VM, the VM tracks captured images in a `pendingImages` array during command execution, and the relay server proxies those images from the VM to Twilio for WhatsApp delivery.

```
Claude Code (in /command) --> POST /screenshot (Playwright) --> pendingImages array
                                                                     |
                                                          /command response.images
                                                                     |
                                                         Relay proxies /images/:filename
                                                                     |
                                                         Twilio sends mediaUrl to WhatsApp
```

This separates concerns cleanly — the VM handles capture and storage, the relay handles transport and authentication, and Twilio handles the messaging protocol.

## Key Implementation Details

### VM: Screenshot Capture (`POST /screenshot`)

Playwright launches Chromium with `--no-sandbox` (required in Docker). The endpoint accepts `url`, `viewport` ("mobile" 390x844 or "desktop" 1440x900), and optional `fullPage` flag, all at 2x device pixel ratio for crisp mobile display. JPEG compression is iterative: captures at quality 75, retries at quality 50 if the buffer exceeds 600KB, with a 1MB hard ceiling and DPR fallback (see [compression pipeline doc](../integration-issues/mms-screenshot-compression-pipeline-20260226.md) for details).

```javascript
// Iterative compression
let quality = JPEG_QUALITY;  // 75
let buffer = await page.screenshot({ type: "jpeg", quality, fullPage });
if (buffer.length > MAX_IMAGE_BYTES) {  // 600KB
  quality = JPEG_QUALITY_FALLBACK;      // 50
  buffer = await page.screenshot({ type: "jpeg", quality, fullPage });
}
await fs.writeFile(filepath, buffer);
pendingImages.push({ type: "screenshot", filename, url: `/images/${filename}` });
```

### VM: Image Serving (`GET /images/:filename`)

Images are stored in `/tmp/images/` with UUID filenames (unguessable, no enumeration attacks). Path traversal protection uses `path.resolve()` + `startsWith()` validation. TTL-based cleanup runs every 5 minutes: expired images (30-minute TTL) deleted first, then if count exceeds 100 files, oldest non-expired images culled.

### Relay: Image Proxy

The relay cannot grant Twilio direct access to the VM (no public IP). Instead, the relay's `GET /images/:filename` proxies to the VM's image endpoint. Filenames are validated against a strict UUID.jpeg regex before forwarding.

```javascript
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpeg$/.test(filename)) {
  return res.sendStatus(400);
}
const vmUrl = `${CLAUDE_HOST}/images/${encodeURIComponent(filename)}`;
const response = await fetch(vmUrl);
res.set("Content-Type", "image/jpeg");
res.send(Buffer.from(await response.arrayBuffer()));
```

### Relay: Media Delivery

When the relay receives an `images` array from the VM, it constructs public URLs by prepending `PUBLIC_URL` to the relative path. WhatsApp enforces one media attachment per message, so the relay sends the first image with the text response and splits remaining images into separate messages.

### pendingImages Pattern

The VM maintains a `pendingImages` array per `/command` execution. Reset on entry, append during execution, drain on every exit path (success, error, timeout). This ensures screenshots captured before a command failure are still delivered as partial results.

```javascript
// Drain on ALL exit paths — including errors and timeouts
if (code !== 0) {
  const images = [...pendingImages];
  pendingImages = [];
  return res.status(500).json({
    error: "execution_error",
    text: textOut || null,
    images,       // Partial results surfaced
    exitCode: code,
    durationMs,
  });
}
```

## Why This Architecture Works

- **Isolated capture and delivery:** The VM handles all Playwright and JPEG logic, testable with a local test app (`vm/test-app/`). The relay is stateless and transport-agnostic.
- **Iterative compression:** Quality 75 balances fidelity with size; fallback to 50 keeps files under the 16MB WhatsApp media limit with wide safety margin. DPR fallback catches extreme cases.
- **UUID filenames prevent guessing.** Token-based auth deferred to Phase 7 when production infrastructure lands.
- **Relay proxy keeps VM behind firewall** while meeting Twilio's requirement for publicly accessible image URLs.
- **TTL-based cleanup prevents disk fill** without requiring persistent storage infrastructure.
- **Partial result surfacing** gives users visual context about what happened before a command failure.

## Prevention & Best Practices

### Media Pipeline Design

- **Transport-agnostic producer API:** Design the VM's media endpoint to return raw content without transport knowledge. Let the relay handle protocol-specific constraints (WhatsApp's 1-media-per-message limit). This allows future channels without VM changes.
- **Async callback pattern for media collection:** Design image capture to be invoked asynchronously during long-running operations, with results collected in a process-local array returned with the final response.
- **Cold-start retry:** When a consumer (relay) calls a producer (VM), implement connection-refused recovery with a fixed delay. This handles VM cold starts without blocking the hot path.

### Image Compression

- **Tiered JPEG quality strategy:** Start at reasonable quality (75%), measure output size, retry at degraded quality (50%) if it exceeds the transport ceiling. Log the final quality used for debugging.
- **Explicit size threshold enforcement:** Set a hard max (600KB) significantly below the WhatsApp media limit (16MB) for fast delivery and low bandwidth usage.

### Accumulated State Management

- **Process-local state with explicit lifecycle:** Reset accumulated data when a command starts, append during execution, drain when it finishes. Eliminates orphaned state without external storage.
- **Failure resilience through state preservation:** On timeout or non-zero exit, still return all captured screenshots. Don't silently discard partial work.

### Container-to-External Media Serving

- **Relay proxy pattern:** Never expose the VM port directly to the internet. The relay fetches from the VM (local network) and serves to public clients (Twilio).
- **Public URL construction at the relay:** Images from VM use relative paths. The relay prepends `PUBLIC_URL` before sending to Twilio, decoupling VM networking from the relay's public address.
- **Volatile /tmp storage with TTL cleanup:** 30-minute TTL + 100-file cap. Background interval cleanup, not in the request path. Log cleanup failures but don't fail user requests.

### Security

- **UUID-based filename opacity:** Prevents enumeration attacks. UUIDs are unguessable and sufficiently unique.
- **Defense in depth:** Validate at both layers — strict UUID regex on relay, path resolution + `startsWith` validation on VM.
- **Graceful failure on missing auth:** Return HTTP 200 (not 401/403) to Twilio webhooks for non-allowlisted numbers. Prevents retries and doesn't reveal registration status.

## Related Issues

- See also: [mms-screenshot-compression-pipeline-20260226.md](../integration-issues/mms-screenshot-compression-pipeline-20260226.md) — compression pipeline, DPR fallback, 1MB carrier limits, partial result handling
- See also: [docker-vm-claude-code-headless-setup-20260225.md](../developer-experience/docker-vm-claude-code-headless-setup-20260225.md) — Docker container setup, non-root user, process group management, path traversal protection patterns
- See also: [web-chat-dev-tool-twilio-bypass-20260226.md](../developer-experience/web-chat-dev-tool-twilio-bypass-20260226.md) — dev tool that enabled e2e testing of the screenshot pipeline when Twilio verification was blocked
- See also: [sms-echo-server-twilio-ngrok-setup-20260225.md](../developer-experience/sms-echo-server-twilio-ngrok-setup-20260225.md) — Phase 1 foundation covering Twilio webhook patterns and image delivery
