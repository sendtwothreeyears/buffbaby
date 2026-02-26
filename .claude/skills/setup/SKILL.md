# /setup — AI-Native Project Setup

Walk a new developer through complete textslash setup interactively.

## What This Does

Checks prerequisites, guides `.env` creation, builds Docker, starts services, and verifies everything works — all through conversation.

## Steps

### 1. Detect Environment

```bash
uname -s   # OS detection
node --version
docker --version
ngrok --version 2>/dev/null || echo "ngrok not found"
```

- **Mac/Linux:** Proceed normally
- **Windows:** Warn: "Windows is untested. Setup may require adjustments."
- **Node < 22:** "Node.js 22+ is required. Current: [version]"
- **Docker missing:** "Docker is required. Install from https://docker.com"
- **ngrok missing:** "ngrok is recommended for local dev. Install from https://ngrok.com or use Cloudflare Tunnel as an alternative."

### 2. Guide `.env` Creation

Use `AskUserQuestion` for each credential:

#### Relay Server (root `.env`)

```bash
cp .env.example .env
```

Ask for:
1. **Twilio Account SID** — "Find this at https://console.twilio.com (starts with AC)"
2. **Twilio Auth Token** — "Same page, under Account SID"
3. **Twilio Phone Number** — "Your SMS-capable Twilio number in E.164 format (+1XXXXXXXXXX)"
4. **Allowed Phone Numbers** — "Comma-separated E.164 numbers that can send commands"

Validate formats:
- Account SID starts with `AC` and is 34 chars
- Phone numbers match `+\d{10,15}`

#### VM Server (`vm/.env`)

```bash
cp vm/.env.example vm/.env
```

Ask for:
1. **Anthropic API Key** — "From https://console.anthropic.com/settings/keys (starts with sk-ant-)"
2. **GitHub Token** (optional) — "For git operations inside the VM. Generate at https://github.com/settings/tokens"

### 3. Build Docker Image

```bash
docker compose build
```

- Warn: "This downloads ~2GB (Chromium, Node, Claude Code). May take a few minutes."
- If build fails, show the error and suggest common fixes.

### 4. Start Services

```bash
docker compose up -d
```

Verify VM health:
```bash
curl -s http://localhost:3001/health | cat
```

Expected: `{"status":"ok"}`

Install relay dependencies and start:
```bash
npm install
```

Tell the user: "Start the relay server in a separate terminal: `npm run dev`"

### 5. Setup ngrok Tunnel

Tell the user: "In a third terminal, run: `ngrok http 3000`"

Ask them to paste the ngrok HTTPS URL. Then:
1. Update `PUBLIC_URL` in `.env` with the ngrok URL
2. Remind them to restart the relay server after updating `.env`

### 6. Configure Twilio Webhook

Guide to Twilio console:
1. Go to https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Click the phone number
3. Under Messaging → "A message comes in", set webhook to `<PUBLIC_URL>/sms`
4. Method: HTTP POST
5. Save

### 7. Verify End-to-End

"Send a text message to your Twilio number now."

Check relay logs for:
- `[INBOUND] From: +1... Body: ...`
- `[OUTBOUND] Echo sent to +1...`

If the user receives an echo + test image: "Setup complete! You're ready to go."

### Important Warnings

Display these prominently:

**A2P 10DLC (US numbers only):** If using a US Twilio number, A2P 10DLC registration is required for reliable SMS delivery. This takes 3-15 business days. Without it, messages may be filtered by carriers. See: https://www.twilio.com/docs/messaging/guides/10dlc

**Twilio trial accounts:** Trial accounts can only send SMS to verified phone numbers. Add your phone as a verified number in the Twilio console if you're on a trial.
