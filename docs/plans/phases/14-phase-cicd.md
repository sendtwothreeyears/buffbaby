# Phase 14: CI/CD

**Stage:** Scale and Polish
**Depends on:** Phase 11 (Beta)
**Done when:** You approve a PR via SMS, then receive "GitHub Actions: passed. Deployed to staging." followed by a staging screenshot.

## What You Build

After a PR is created, the relay listens for GitHub Actions webhook events and sends build/deploy status updates as SMS. When a staging deployment completes, Claude Code captures a screenshot of the staging URL via Playwright and the relay sends it via MMS.

Deliverables:
- GitHub Actions webhook listener on the relay server
- **GitHub webhook signature validation** (HMAC-SHA256) — security requirement
- Build status SMS: "GitHub Actions: building..." → "GitHub Actions: passed" or "GitHub Actions: failed"
- Staging screenshot capture after successful deployment
- **User-to-webhook routing:** Relay maps GitHub webhook events (repo/PR) to the owning user's phone number via Supabase

## Tasks

- [ ] Add GitHub Actions webhook listener — receive events, validate signatures, route to user, send build status as SMS
  - Plan: `/workflow:plan GitHub Actions webhook listener — signature validation, user routing, build status SMS`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-cicd-webhooks-plan.md`

- [ ] Add staging screenshot capture after successful deployment — trigger Playwright on VM, send screenshot via MMS
  - Plan: `/workflow:plan staging screenshot pipeline — detect deploy success, trigger Playwright, send MMS`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-staging-screenshots-plan.md`

## Notes

- **Webhook events to listen for:** `check_run` (completed), `deployment_status` (success/failure), `workflow_run` (completed).
- **Per-user webhook configuration:** Options: (a) onboarding flow auto-configures webhooks via GitHub API, (b) user manually adds webhook URL, (c) GitHub App installed org-wide. Define during planning. Option (a) is cleanest.
- **User routing:** The relay's user database (Supabase, Phase 9) maps GitHub usernames/repos to phone numbers. The webhook payload contains the repo owner — use this to look up the phone number.
- **Architectural note:** The staging screenshot requires the relay to trigger Playwright on the user's VM — this is the first time the relay initiates an action on the VM rather than forwarding user commands. This shifts the relay from pure "dumb pipe" to "dumb pipe + event reactor." Design deliberately.
- The staging screenshot requires knowing the staging URL. Options: (1) user configures it in VM environment, (2) extract from deployment status webhook payload (Vercel provides preview URLs), (3) Claude Code reads from project config. Start with option 1.
- **Vercel deploy hooks** are deferred. Start with GitHub Actions only. Vercel's preview URL extraction can be added as a refinement.
- **Interleaving with active workflows:** If a CI/CD notification arrives while another workflow is running, prefix it: `[ci] GitHub Actions: passed`. This prevents confusion with workflow progress updates.
- Can be worked in parallel with Phase 13 (Multi-Agent) since they touch different parts of the relay.
