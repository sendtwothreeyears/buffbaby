# Phase 9: Onboarding

**Stage:** Deploy to Production
**Depends on:** Phase 8 (Provisioning)
**Done when:** A test user visits the signup page, enters their info, sends a WhatsApp opt-in message, and can immediately start sending commands.

## What You Build

A simple signup website on Vercel. The user enters their phone number, connects GitHub (OAuth), and enters API keys (BYOK). Submitting the form triggers the provisioning API from Phase 8. A user database on Supabase maps phone numbers to VMs and stores encrypted credentials. Onboarding includes a WhatsApp opt-in step (sandbox join code or `wa.me` link).

Deliverables:
- Supabase schema: `users` table with phone number, VM address, Fly.io machine ID, encrypted GitHub token, encrypted API keys, status, created_at. Row-Level Security (RLS) policies configured. Schema designed for future extension (session state, usage tracking, billing columns).
- Onboarding web page on Vercel: phone verification → GitHub OAuth → API key entry → submit → provision
- Form submission triggers `POST /provision` from Phase 8
- User sends WhatsApp opt-in message (join code), then receives welcome reply: "You're set up. Send me anything to start."
- Relay updated to look up phone → VM mapping from Supabase instead of in-memory store
- Idempotency: if a phone number already has a VM, redirect to "you're already set up" instead of provisioning a second VM
- Error handling: if provisioning fails, show error on page + don't send welcome SMS + allow retry

## Tasks

- [ ] Build Supabase schema for user accounts — phone number, VM address, encrypted credentials, RLS policies
  - Plan: `/workflow:plan Supabase user database schema with RLS for SMS cockpit`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-supabase-schema-plan.md`

- [ ] Build onboarding page on Vercel — phone verification, GitHub OAuth, API key form, triggers provisioning on submit
  - Plan: `/workflow:plan onboarding website — phone verification, GitHub OAuth, API key entry, VM provisioning`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-onboarding-page-plan.md`

- [ ] Update relay to read phone → VM mapping from Supabase instead of in-memory store
  - Plan: `/workflow:plan relay migration to Supabase — look up phone-to-VM mapping from database`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-relay-supabase-plan.md`

## Notes

- Phone verification: User sends WhatsApp opt-in message (sandbox join code or `wa.me` link), which also verifies their number. Alternative: email verification.
- GitHub OAuth: minimal scopes — `repo` for private repos, `read:user` for identity. Store the token encrypted. OAuth callback URL points to a Vercel serverless API route. Token revocation on user deletion is deferred but noted as a future requirement.
- API keys (Claude, Codex, Gemini): entered as plain text on the form, transmitted over HTTPS, encrypted server-side before writing to Supabase. Encryption key stored as an environment variable on Vercel/relay, never in Supabase. Keys never logged, never displayed after entry.
- The onboarding page is intentionally minimal — users visit it once and never return. All subsequent interaction is via WhatsApp.
- Welcome message must be a reply to user's initial message (24-hour session window constraint).
- Vercel free tier is sufficient for a static page + serverless API routes.
