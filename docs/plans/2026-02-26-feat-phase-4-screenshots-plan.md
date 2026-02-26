---
title: "feat: Phase 4 Screenshots — VM capture to MMS delivery"
type: feat
status: completed
date: 2026-02-26
phase: 4
depends_on: Phase 3 (Command) — PASS
brainstorm: docs/brainstorms/2026-02-26-phase-4-screenshots-brainstorm.md
---

# Phase 4: Screenshots — VM Capture to MMS Delivery

## Overview

Build a screenshot pipeline that lets Claude Code capture screenshots of a running dev server inside the Docker container and deliver them to the user's phone via MMS. This is the first phase where **images flow from the VM to the phone**.

**Done when:** You text "show me the app" and receive a screenshot of the running app on your phone via MMS.

## Problem Statement

The SMS cockpit currently only returns text. Engineers need to **see** what their app looks like — diffs are images, previews are screenshots, UI bugs need visual confirmation. Phase 4 closes the image gap by building the pipeline from Playwright capture on the VM through to MMS delivery on the user's phone.

## Proposed Solution

```
User texts "show me the app"
  → Twilio webhook → Relay → VM /command
  → Claude Code interprets intent, curls POST /screenshot on VM
  → VM captures with Playwright, saves JPEG to /tmp/images/<uuid>.jpeg
  → /command response includes images array with metadata
  → Relay reads images array, constructs public proxy URLs
  → Relay sends MMS via Twilio with mediaUrl
  → Twilio fetches image from relay proxy → relay fetches from VM
  → User receives screenshot on phone
```

## Technical Approach

### Component 1: `POST /screenshot` VM Endpoint

**File:** `vm/vm-server.js`

New endpoint that owns the Playwright lifecycle. Claude Code calls it via `curl` during `/command` execution.

#### API Contract

**Request:**
```
POST /screenshot
Content-Type: application/json

{
  "url": "http://localhost:8080",       // required — URL to capture
  "viewport": "mobile",                 // optional — "mobile" (default) | "desktop"
  "fullPage": false                     // optional — capture full scroll height (default: false)
}
```

**Response (success):**
```json
{
  "success": true,
  "filename": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpeg",
  "url": "/images/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpeg",
  "viewport": { "width": 390, "height": 844, "deviceScaleFactor": 2 },
  "sizeBytes": 187432
}
```

**Response (error):**
```json
{
  "success": false,
  "error": "Navigation failed: net::ERR_CONNECTION_REFUSED"
}
```

**Status codes:**
- `200` — screenshot captured successfully
- `400` — invalid parameters (missing url, invalid viewport)
- `502` — Playwright navigation/capture failure (target unreachable, timeout, crash)
- `500` — internal error (disk full, Playwright launch failure)

#### Viewport Configuration

| Viewport | Width | Height | DPR | Actual Resolution |
|----------|-------|--------|-----|-------------------|
| `mobile` (default) | 390 | 844 | 2 | 780 x 1688 |
| `desktop` | 1440 | 900 | 2 | 2880 x 1800 |

**Default is `mobile`.** The user is receiving screenshots on their phone — mobile viewport matches their viewing context.

#### JPEG Compression Strategy

1. Capture as PNG (Playwright default — lossless)
2. Convert to JPEG at quality 80
3. If > 600KB, reduce quality in steps of 10 (70, 60, 50...)
4. If quality 30 still > 1MB, capture at 1x DPR and retry
5. If still > 1MB after 1x DPR, fail with error

**Target:** < 300KB for mobile screenshots, < 600KB for desktop. Hard ceiling: 1MB (MMS carrier limit).

**Implementation:** Use Playwright's built-in JPEG screenshot support (`screenshot({ type: 'jpeg', quality: 80 })`), then check file size. If over threshold, re-capture at lower quality. No sharp dependency needed.

#### Playwright Lifecycle

- Launch browser **per-request** (not persistent). Headless Chromium is fast enough for this use case (~1-2s cold start).
- Navigation timeout: 15 seconds. Pages that don't load in 15s are unlikely to load at all.
- Screenshot timeout: 5 seconds after navigation.
- Close browser in `finally` block — always clean up, even on error.

```javascript
// vm/vm-server.js — conceptual implementation
app.post("/screenshot", async (req, res) => {
  const { url, viewport = "mobile", fullPage = false } = req.body;
  if (!url) return res.status(400).json({ success: false, error: "url is required" });

  const viewportConfig = viewport === "desktop"
    ? { width: 1440, height: 900, deviceScaleFactor: 2 }
    : { width: 390, height: 844, deviceScaleFactor: 2 };

  let browser;
  try {
    browser = await chromium.launch({ args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: viewportConfig });
    await page.goto(url, { waitUntil: "networkidle", timeout: 15_000 });

    const filename = `${crypto.randomUUID()}.jpeg`;
    const filepath = path.join(IMAGES_DIR, filename);

    // Iterative compression
    let quality = 80;
    let buffer;
    do {
      buffer = await page.screenshot({ type: "jpeg", quality, fullPage });
      quality -= 10;
    } while (buffer.length > 600_000 && quality >= 30);

    await fs.writeFile(filepath, buffer);

    // Track image for /command response
    pendingImages.push({ type: "screenshot", filename, url: `/images/${filename}` });

    console.log(`[SCREENSHOT] ${filename} (${buffer.length} bytes, q=${quality + 10}) ${url}`);
    res.json({ success: true, filename, url: `/images/${filename}`, viewport: viewportConfig, sizeBytes: buffer.length });
  } catch (err) {
    console.error(`[SCREENSHOT_ERR] ${err.message}`);
    res.status(502).json({ success: false, error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});
```

#### Playwright Dependency

Playwright is installed globally in the Docker image (`npm install -g playwright` in Dockerfile:26). Add `playwright` to `vm/package.json` as a local dependency so `require('playwright')` resolves reliably:

```bash
# vm/package.json — add to dependencies
"playwright": "^1.50.0"
```

This also ensures version lockfile consistency. The global install remains for CLI usage; the local install is for programmatic API access in `vm-server.js`.

### Component 2: In-Memory Image Tracking

**File:** `vm/vm-server.js`

Module-level array that tracks images produced during a single `/command` execution.

```javascript
let pendingImages = [];  // module-level
```

**Lifecycle:**
1. **Reset** at the start of `/command` handler (before spawning Claude Code)
2. **Append** by `/screenshot` handler (each successful capture pushes to array)
3. **Drain** at the end of `/command` handler (copy array into response, then reset)

```javascript
// In POST /command handler, at the start:
pendingImages = [];

// In POST /command handler, when building response:
const images = [...pendingImages];
pendingImages = [];
res.json({ text: textOut, images, exitCode: code, durationMs });
```

**Concurrency safety:** Node.js is single-threaded. The `/screenshot` endpoint and `/command` response handler never execute in true parallel — array operations are inherently safe. However, since only one `/command` runs at a time (enforced by the existing `busy` flag), the images array is naturally scoped per command.

### Component 3: Relay Image Proxy

**File:** `server.js`

New `GET /images/:filename` route that proxies image requests from Twilio to the VM.

```javascript
// server.js — new route
app.get("/images/:filename", async (req, res) => {
  const { filename } = req.params;

  // Validate filename format: UUID.jpeg only
  if (!/^[0-9a-f-]+\.jpeg$/.test(filename)) {
    return res.sendStatus(400);
  }

  try {
    const vmUrl = `${CLAUDE_HOST}/images/${encodeURIComponent(filename)}`;
    const response = await fetch(vmUrl);

    if (!response.ok) {
      return res.sendStatus(response.status);
    }

    res.set("Content-Type", "image/jpeg");
    res.set("Cache-Control", "public, max-age=300");
    // Pipe VM response body to Twilio
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(`[IMAGE_PROXY_ERR] ${filename}: ${err.message}`);
    res.sendStatus(502);
  }
});
```

**Key details:**
- Filename validation rejects path traversal attempts (only UUID patterns + `.jpeg`)
- Pipes from VM response to Twilio — no disk write on the relay
- 5-minute cache header: Twilio may retry fetches, caching avoids redundant VM requests
- Uses existing `CLAUDE_HOST` env var (already available, default `http://localhost:3001`)

### Component 4: Relay MMS Sending

**File:** `server.js`

Update the outbound message flow to support MMS when images are present.

```javascript
// server.js — updated sendSMS / new sendMMS
async function sendMessage(to, body, mediaUrls = []) {
  try {
    const params = {
      to,
      from: TWILIO_PHONE_NUMBER,
      body,
    };
    if (mediaUrls.length > 0) {
      params.mediaUrl = mediaUrls;
    }
    await client.messages.create(params);
    if (mediaUrls.length > 0) {
      console.log(`[MMS] ${to}: ${mediaUrls.length} image(s)`);
    }
  } catch (err) {
    console.error(`[OUTBOUND_ERROR] ${to}: ${err.message}`);
  }
}
```

**In `processCommand`** (after `forwardToVM` returns):

```javascript
// Construct public media URLs from images array
const mediaUrls = (data.images || [])
  .slice(0, 10)  // Twilio limit: 10 media URLs per MMS
  .map(img => `${PUBLIC_URL}${img.url}`);

await sendMessage(from, data.text, mediaUrls);
```

**Twilio MMS limit:** Max 10 media URLs per message. If > 10 images (unlikely), send only the first 10. This edge case does not need batching in Phase 4.

**Timing dependency:** After the relay sends the MMS, Twilio asynchronously fetches images from the relay's public URL. Images must remain accessible for at least 15 minutes. The TTL cleanup (Component 5) ensures this.

### Component 5: Ephemeral Image Cleanup

**File:** `vm/vm-server.js`

Interval-based cleanup of `/tmp/images/` to prevent disk fill.

```javascript
// vm/vm-server.js — cleanup interval
const IMAGE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // run every 5 minutes

setInterval(async () => {
  try {
    const files = await fs.readdir(IMAGES_DIR);
    const now = Date.now();
    let cleaned = 0;
    for (const file of files) {
      const filepath = path.join(IMAGES_DIR, file);
      const stat = await fs.stat(filepath);
      if (now - stat.mtimeMs > IMAGE_TTL_MS) {
        await fs.unlink(filepath);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[CLEANUP] Removed ${cleaned} expired image(s)`);
    }
  } catch (err) {
    console.error(`[CLEANUP_ERR] ${err.message}`);
  }
}, CLEANUP_INTERVAL_MS);
```

**30-minute TTL** gives Twilio plenty of time to fetch images (typically seconds, worst case minutes). Conservative enough for alpha.

**Cap fallback:** If `/tmp/images/` exceeds 100 files regardless of age, delete oldest first. Prevents runaway disk usage from rapid screenshot commands.

### Component 6: Claude Code System Prompt

**File:** `vm/CLAUDE.md` (new — placed in VM working directory so Claude Code reads it)

Claude Code must know the `/screenshot` endpoint exists. Without this, the AI cannot reliably trigger screenshots. This is the most critical piece of the feature.

```markdown
# VM Tools

## Screenshot Capture

Take screenshots of web pages running in this container using the VM server's screenshot endpoint.

### Usage

curl -s -X POST http://localhost:3001/screenshot \
  -H "Content-Type: application/json" \
  -d '{"url": "http://localhost:8080", "viewport": "mobile"}'

### Parameters

- `url` (required): The URL to screenshot. Usually `http://localhost:<port>`.
- `viewport` (optional): `"mobile"` (390px, default) or `"desktop"` (1440px). Use mobile unless the user asks for desktop.
- `fullPage` (optional): `true` to capture full scroll height. Default `false` (viewport only).

### Response

Success: { "success": true, "filename": "...", "url": "/images/...", "sizeBytes": ... }
Error: { "success": false, "error": "..." }

### When to Use

- User asks to "show me", "what does it look like", "take a screenshot", or similar visual requests
- After making UI changes, to show the result
- Do NOT use for "show me the code" — that's a text request

### Important

- Always use blocking curl (no background `&`) — the image must be saved before you finish
- The screenshot is automatically sent to the user as an MMS image — just confirm what you captured in your text response
- If the screenshot fails, tell the user why (e.g., "The dev server isn't running on port 8080")
```

**Placement:** This file goes in the working directory that Claude Code operates in inside the container. The existing Claude Code CLI invocation reads `CLAUDE.md` from the working directory automatically.

### Component 7: Static HTML Test Target

**File:** `vm/test-app/index.html` (new)

Minimal static page served inside Docker for end-to-end testing. Proves the screenshot pipeline without requiring a real app.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SMS Cockpit Test App</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, sans-serif; background: #f5f5f5; color: #333; }
    header { background: #1a1a2e; color: white; padding: 1.5rem; text-align: center; }
    header h1 { font-size: 1.5rem; }
    header p { opacity: 0.7; margin-top: 0.25rem; }
    main { max-width: 600px; margin: 2rem auto; padding: 0 1rem; }
    .card { background: white; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card h2 { font-size: 1.1rem; margin-bottom: 0.5rem; }
    .status { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.85rem; font-weight: 600; }
    .status.ok { background: #d4edda; color: #155724; }
    .status.info { background: #d1ecf1; color: #0c5460; }
  </style>
</head>
<body>
  <header>
    <h1>SMS Cockpit Test App</h1>
    <p>Phase 4 screenshot pipeline test target</p>
  </header>
  <main>
    <div class="card">
      <h2>Status</h2>
      <span class="status ok">Running</span>
    </div>
    <div class="card">
      <h2>About</h2>
      <p>This is a static test page served inside the Docker container. If you can see this as an MMS screenshot on your phone, the Phase 4 pipeline is working end-to-end.</p>
    </div>
    <div class="card">
      <h2>Viewport</h2>
      <p id="viewport-info">Loading...</p>
      <script>
        document.getElementById('viewport-info').textContent =
          window.innerWidth + 'x' + window.innerHeight + ' @ ' + window.devicePixelRatio + 'x DPR';
      </script>
    </div>
  </main>
</body>
</html>
```

**Serving:** Add a line to the Docker entrypoint or `vm-server.js` startup:

```javascript
// In vm-server.js, after server starts:
const { exec } = require("child_process");
exec("npx -y serve /app/test-app -l 8080 -s", (err) => {
  if (err) console.error(`[TEST_APP] Failed to start: ${err.message}`);
  else console.log("[TEST_APP] Serving on http://localhost:8080");
});
```

Or add to Dockerfile CMD as a background process. The test app only needs to run during development/testing — not in production.

## Implementation Phases

### Phase 4a: VM Screenshot Endpoint (Foundation)

**Files:** `vm/vm-server.js`, `vm/package.json`

- [x] Add `playwright` to `vm/package.json` dependencies
- [x] Implement `POST /screenshot` endpoint with Playwright capture
- [x] Implement viewport configuration (mobile/desktop)
- [x] Implement iterative JPEG compression
- [x] Implement `pendingImages` module-level array
- [x] Wire images array into `/command` response (replace hardcoded `[]`)
- [x] Add `[SCREENSHOT]` / `[SCREENSHOT_ERR]` logging
- [ ] Test independently: `curl -X POST http://localhost:3001/screenshot -H "Content-Type: application/json" -d '{"url":"http://localhost:8080"}'`

**Validates:** Screenshot capture works, JPEG saved to `/tmp/images/`, correct response shape.

### Phase 4b: Relay Image Proxy + MMS

**Files:** `server.js`

- [x] Add `GET /images/:filename` proxy route with filename validation
- [x] Update `sendSMS` → `sendMessage` to accept `mediaUrl` parameter
- [x] Update `processCommand` to read `data.images` and construct public media URLs
- [x] Add `[IMAGE_PROXY]` / `[MMS]` logging
- [ ] Test: send a command that produces an image, verify MMS arrives on phone

**Validates:** End-to-end image delivery from VM through relay to phone.

### Phase 4c: Claude Code Integration + Test Target

**Files:** `vm/CLAUDE.md` (new), `vm/test-app/index.html` (new), `vm/vm-server.js`

- [x] Create `vm/CLAUDE.md` with `/screenshot` endpoint documentation
- [x] Create `vm/test-app/index.html` static test page
- [x] Add test app server startup to VM
- [x] Implement TTL-based image cleanup (30-min TTL, 5-min interval, 100-file cap)
- [ ] End-to-end test: text "show me the app" → receive MMS screenshot

**Validates:** Claude Code correctly interprets "show me the app", calls `/screenshot`, user receives screenshot on phone.

### Phase 4d: Polish + Docs

- [x] Update `docs/plans/phases/04-phase-screenshots.md` — remove stale MCP/.mcp.json references, update to match implementation
- [x] Update `ARCHITECTURE.md` — add screenshot pipeline to data flow
- [x] Update `SECURITY.md` — document public image proxy, UUID-based access
- [x] Update `vm/.env.example` if any new env vars added (none needed)
- [x] Grep for stale "Playwright MCP" / ".mcp.json" references across docs and remove (addressed in 04-phase-screenshots.md rewrite)

## Acceptance Criteria

### Functional Requirements

- [ ] `POST /screenshot` captures a JPEG screenshot of a given URL
- [ ] Mobile (390x844 @ 2x DPR) and desktop (1440x900 @ 2x DPR) viewports work
- [ ] Screenshots are saved to `/tmp/images/<uuid>.jpeg`
- [ ] JPEG file size is < 1MB (target < 300KB mobile, < 600KB desktop)
- [ ] `/command` response `images` array contains screenshot metadata
- [ ] Relay `GET /images/:filename` proxies images from VM
- [ ] Relay sends MMS with `mediaUrl` when images are present
- [ ] Text-only commands still work as before (backward compatible)
- [ ] Claude Code uses `/screenshot` endpoint when user asks for visual output
- [ ] Claude Code does NOT screenshot for text-only requests ("show me the code")
- [ ] Images are cleaned up after 30 minutes

### Non-Functional Requirements

- [ ] Screenshot capture completes in < 5 seconds (excluding navigation)
- [ ] JPEG compression does not block the event loop excessively
- [ ] Image cleanup does not affect in-flight Twilio fetches (30-min TTL provides buffer)
- [ ] Path traversal protection on both VM and relay image endpoints

## Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Playwright Chromium crash in Docker | Low | High | `--no-sandbox` flag, `finally` block cleanup, error response to Claude Code |
| JPEG > 1MB after compression | Low | Medium | Iterative quality reduction, DPR fallback |
| Twilio fails to fetch image from relay | Low | Medium | 30-min TTL, 5-min cache header, logging for debugging |
| Claude Code doesn't use /screenshot | Medium | High | Clear CLAUDE.md with examples and usage rules |
| ngrok URL changes between send and Twilio fetch | Low | Medium | Images fetched within seconds; document in troubleshooting |

## Security Considerations

- **Relay image proxy is publicly accessible** — Twilio requires this. Mitigated by UUID filenames (unguessable). Formal auth tokens deferred to Phase 7.
- **Path traversal** — Both VM and relay validate filenames. VM uses `path.resolve` + `startsWith` check. Relay uses regex whitelist (`/^[0-9a-f-]+\.jpeg$/`).
- **Playwright URL navigation** — Claude Code could be asked to screenshot external URLs. The container is sandboxed, and Chromium runs headless with `--no-sandbox` (required in Docker). Accept this risk for alpha; add URL allowlisting before public release.
- **No secrets in screenshots** — Claude Code should not be prompted to screenshot pages containing credentials. This is a user responsibility, not a system constraint.

## References

### Internal

- Brainstorm: `docs/brainstorms/2026-02-26-phase-4-screenshots-brainstorm.md`
- Phase 4 spec: `docs/plans/phases/04-phase-screenshots.md`
- Phase 3 (baseline): `docs/plans/phases/03-phase-command.md`
- VM server: `vm/vm-server.js` (existing endpoints, image serving at line 140-148)
- Relay server: `server.js` (sendSMS at line 188-199, processCommand at line 111-148)
- Dockerfile: `vm/Dockerfile` (Playwright install at line 26-29, /tmp/images at line 44)
- Docker Compose: `docker-compose.yml`

### Learnings Applied

- `docs/solutions/developer-experience/docker-vm-claude-code-headless-setup-20260225.md` — non-root user, process group management, path traversal pattern
- `docs/solutions/developer-experience/sms-echo-server-twilio-ngrok-setup-20260225.md` — MMS image size < 1MB, logging prefix conventions
- `docs/solutions/documentation-gaps/stale-loc-counts-links-after-refactor-20260226.md` — grep for stale references after implementation
- `docs/solutions/developer-experience/docker-compose-mem-limit-ignored-swarm-only-20260226.md` — verify resource limits

### External

- [Twilio MMS mediaUrl docs](https://www.twilio.com/docs/messaging/guides/how-to-send-sms-messages-with-media)
- [Playwright screenshot API](https://playwright.dev/docs/api/class-page#page-screenshot)
