# VM Tools

## Screenshot Capture

Take screenshots of web pages running in this container using the VM server's screenshot endpoint.

### Usage

```
curl -s -X POST http://localhost:3001/screenshot \
  -H "Content-Type: application/json" \
  -d '{"url": "http://localhost:8080", "viewport": "mobile"}'
```

### Parameters

- `url` (required): The URL to screenshot. Usually `http://localhost:<port>`.
- `viewport` (optional): `"mobile"` (390px, default) or `"desktop"` (1440px). Use mobile unless the user asks for desktop.
- `fullPage` (optional): `true` to capture full scroll height. Default `false` (viewport only).

### Response

Success: `{ "success": true, "filename": "...", "url": "/images/...", "sizeBytes": ... }`
Error: `{ "success": false, "error": "..." }`

### When to Use

- User asks to "show me", "what does it look like", "take a screenshot", or similar visual requests
- After making UI changes, to show the result
- Do NOT use for "show me the code" — that's a text request

### Important

- Always use blocking curl (no background `&`) — the image must be saved before you finish
- The screenshot is automatically sent to the user as a WhatsApp media message — just confirm what you captured in your text response
- If the screenshot fails, tell the user why (e.g., "The dev server isn't running on port 8080")
