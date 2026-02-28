---
name: preview
description: "Capture screenshots at mobile and desktop viewports"
---

# /preview [url] [viewport]

Take a screenshot of a running web app.

## Steps

1. Default URL: `http://localhost:3000` (or detect from running dev server)
2. Default viewport: mobile (390px)
3. Take screenshot using the VM screenshot endpoint:
   ```
   curl -s -X POST http://localhost:3001/screenshot \
     -H "Content-Type: application/json" \
     -d '{"url": "<url>", "viewport": "<viewport>"}'
   ```
4. If viewport is "both", take two screenshots (mobile + desktop)

## Examples

- `/preview` - Screenshot of localhost:3000 at mobile viewport
- `/preview http://localhost:8080` - Screenshot of specific port
- `/preview http://localhost:3000 desktop` - Desktop viewport (1440px)
- `/preview http://localhost:3000 both` - Both mobile and desktop

## Notes

- The screenshot is automatically sent to the user as a media message
- If the dev server isn't running, suggest starting it first
