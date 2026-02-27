---
module: "VM Server + Relay"
date: "2026-02-26"
problem_type: integration_issue
component: "Screenshot delivery pipeline (Playwright -> JPEG compression -> WhatsApp)"
symptoms:
  - "Screenshots at 2x DPR produce unnecessarily large files, slowing WhatsApp delivery"
  - "Quality reduction alone insufficient for complex/graphics-heavy pages"
  - "Playwright cannot change deviceScaleFactor on existing browser context"
  - "Screenshots captured before command failure are discarded"
root_cause: "Screenshot compression lacked a hard ceiling and DPR fallback. JPEG quality reduction (75 -> 50) is insufficient for dense pages at 2x DPR. Large images slow delivery and waste bandwidth even though WhatsApp supports up to 16MB."
resolution_type: code_fix
severity: high
tags:
  - whatsapp-media-constraints
  - image-compression
  - carrier-limits
  - playwright-screenshots
  - jpeg-quality-cascade
  - device-pixel-ratio
  - partial-results
---

# Troubleshooting: WhatsApp Screenshot Compression Pipeline

## Problem

Screenshots captured at 2x device pixel ratio (retina) for crisp text on mobile screens produce unnecessarily large files. While WhatsApp supports up to 16MB, large images slow delivery and waste bandwidth on mobile connections. The compression pipeline keeps images under 600KB (soft target) and 1MB (hard ceiling) for fast, efficient delivery. Additionally, screenshots captured before a command error were being discarded instead of surfaced as partial results.

## Environment

- Module: VM Server (`vm/vm-server.js`) + Relay (`server.js`)
- Affected Component: Screenshot capture endpoint (`POST /screenshot`), command error handling
- Date: 2026-02-26

## Symptoms

- Screenshots of complex pages (dashboards, data tables, multi-panel layouts) at 2x DPR produce 800KB-1.2MB files
- Large images cause slow delivery over mobile connections via WhatsApp
- When a command errors or times out, screenshots captured before the failure are lost

## What Didn't Work

**Attempted Solution 1:** Simple JPEG at quality 80 (original plan)
- **Why it failed:** Still produced 700KB-900KB for dense pages — too large for fast mobile delivery.

**Attempted Solution 2:** Iterative quality loop (80 -> 70 -> 60 -> 50)
- **Why it failed:** Over-engineered for alpha. Four quality steps add latency (4 screenshot captures). Even quality 50 at 2x DPR exceeds 1MB on graphics-heavy pages — slower than necessary for WhatsApp delivery.

## Solution

Implemented a two-tier compression strategy with DPR fallback, plus partial result surfacing on all error paths.

### Compression Pipeline (`vm/vm-server.js:199-230`)

```javascript
// Tier 1: Quality cascade at 2x DPR
let quality = JPEG_QUALITY; // 75
let buffer = await page.screenshot({ type: "jpeg", quality, fullPage });
if (buffer.length > MAX_IMAGE_BYTES) { // > 600KB
  quality = JPEG_QUALITY_FALLBACK; // 50
  buffer = await page.screenshot({ type: "jpeg", quality, fullPage });
}

// Tier 2: DPR fallback — if still > 1MB, retry entire capture at 1x DPR
if (buffer.length > HARD_CEILING_BYTES) { // > 1MB
  // Playwright can't change DPR on existing context — must create new page
  const page1x = await browser.newPage({
    viewport: { ...viewportConfig, deviceScaleFactor: 1 },
  });
  await page1x.goto(url, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS });
  quality = JPEG_QUALITY;
  buffer = await page1x.screenshot({ type: "jpeg", quality, fullPage });
  if (buffer.length > HARD_CEILING_BYTES) {
    quality = JPEG_QUALITY_FALLBACK;
    buffer = await page1x.screenshot({ type: "jpeg", quality, fullPage });
  }
  await page1x.close();

  // Graceful failure if nothing works
  if (buffer.length > HARD_CEILING_BYTES) {
    return res.status(502).json({
      success: false,
      error: `Screenshot too large (${buffer.length} bytes) even at 1x DPR and quality ${quality}. Hard ceiling is 1MB.`,
    });
  }
}
```

### Partial Results on Error (`vm/vm-server.js:140-151`)

```javascript
// Before (broken): error responses omitted pendingImages
// After (fixed): drain pendingImages on ALL exit paths
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

Same pattern applied to timeout responses (line 128-137).

## Why This Works

1. **DPR is the biggest size lever.** Reducing from 2x to 1x DPR cuts pixel count by ~4x, which dramatically reduces file size while keeping text readable at phone sizes.
2. **Playwright's API requires a new page to change DPR.** `deviceScaleFactor` is a property of the browser context at page creation. The DPR fallback creates a new page in the same browser session (cheaper than relaunching the browser) and re-navigates.
3. **600KB soft target, 1MB hard ceiling.** Most pages fit at quality 75 (best visual quality). Dense pages fall to quality 50 (acceptable). Extreme cases hit 1x DPR (lower fidelity but readable). Clear error if nothing works. These thresholds optimize for fast WhatsApp delivery on mobile connections.
4. **Partial results make errors debuggable.** The `pendingImages` array accumulates screenshots during command execution. Draining it on all exit paths (success, error, timeout) gives users visual context about what happened before the failure.

## Prevention

- **Always validate image size before returning to the transport layer.** Don't assume compression produced a small-enough file — check the buffer length.
- **Log every compression step** with file size and quality used. The `[SCREENSHOT]` log includes `sizeBytes` and `q=` for production debugging.
- **Audit all exit paths when adding state that accumulates during execution.** The `pendingImages` leak was caused by the error path not draining accumulated state. Use the pattern: reset on entry, drain on every exit.
- **Test with complex real-world pages, not just simple test pages.** The test app (`vm/test-app/index.html`) is simple; production pages may be much denser.
- **Document size thresholds prominently.** The 600KB/1MB compression targets should be in ARCHITECTURE.md and vm/CLAUDE.md so every developer knows the constraint.

## Related Issues

- See also: [sms-echo-server-twilio-ngrok-setup-20260225.md](../developer-experience/sms-echo-server-twilio-ngrok-setup-20260225.md) — Twilio webhook setup patterns, image delivery foundations
- See also: [docker-vm-claude-code-headless-setup-20260225.md](../developer-experience/docker-vm-claude-code-headless-setup-20260225.md) — path traversal protection pattern reused for image serving
