# Phase 1: Echo

**Stage:** Local Development
**Depends on:** Nothing (first phase)
**Done when:** You text the Twilio number from your phone, you get your exact message echoed back. You receive a test image via MMS.

## What You Build

The simplest possible proof of life: a Twilio phone number, an ngrok tunnel, and a minimal Node.js relay server that receives an incoming SMS and echoes the message body back. Also sends a static test image via MMS to prove the image delivery pipeline works end-to-end.

Deliverables:
- Twilio account with phone number and A2P 10DLC registration
- ngrok installed and configured
- Minimal Node.js relay server (~50 LOC) that echoes SMS and sends a test MMS image
- `.env` file with Twilio credentials, ngrok URL, and allowed phone number (E.164 format, e.g., `+1XXXXXXXXXX`)
- Phone number allowlist: reject messages from non-allowlisted numbers (compare `req.body.From` against `.env`)

## Prerequisites (manual — complete before `/ship`)

These are manual setup steps done in the Twilio console and terminal, not shippable code:

1. Create Twilio account
2. Buy a phone number
3. Submit A2P 10DLC registration (~$15 one-time, takes 1-5 business days for approval — start early)
4. Install ngrok (`brew install ngrok` or download)

## Tasks

- [ ] Build a Node.js relay server that echoes incoming SMS back and sends a static test image via MMS
  - Plan: `/workflow:plan Twilio echo server with ngrok — receive SMS, echo back, send test MMS image`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-sms-echo-plan.md`

## Notes

- ngrok free tier generates a new URL on every restart. You must update the Twilio webhook URL each time. Consider a paid ngrok plan ($8/month) for a stable subdomain, or automate the URL update.
- Twilio webhook signature validation is deferred to Phase 3. The echo server should still restrict to the allowlisted phone number in `.env`.
- The test MMS image can be any publicly accessible PNG URL passed as `MediaUrl` in the Twilio API response, or served by the echo server itself on a public-facing route via ngrok.
- The echo server is throwaway code — Phase 3 replaces it with the real relay. But it validates the entire Twilio → ngrok → localhost → Twilio round trip.
- Keep the relay server in a single file for now. No framework — just `express` with Twilio's webhook parsing.
