# Phase 16: UX Polish

**Stage:** Scale and Polish
**Depends on:** Phase 11 (Beta)
**Done when:** `/help` returns usage info, `/history` shows recent activity, `/cost` shows spending, and large diffs are batched into composite images.

## What You Build

User-facing polish features: help and history commands, cost tracking, and composite diff images for large changesets.

Deliverables:
- `/help` command: relay returns a static text with available commands and examples
- `/history` command: relay returns recent session activity (last 10 commands + outcomes, stored in Supabase)
- `/cost` command: relay returns estimated Twilio + API spend for the current billing period
- **Composite diff images:** When > 5 files change, batch into a single grid image showing file names + change counts + miniature diff previews. Send as one WhatsApp message with "Reply 'show [filename]' for the full diff."
- "Reply 'show [filename]'" recognized by relay: fetches and sends the individual diff image for that file

## Tasks

- [ ] Implement `/help`, `/history`, and `/cost` commands
  - Plan: `/workflow:plan help, history, and cost commands — relay-recognized commands, Supabase queries, cost estimation`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-help-history-cost-plan.md`

- [ ] Implement composite diff images — batch 5+ file diffs into a single grid image with "reply 'show [filename]' for detail"
  - Plan: `/workflow:plan composite diff images — grid layout, miniature previews, interactive show command`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-composite-diffs-plan.md`

## Notes

- `/help`, `/history`, and `/cost` are relay-recognized commands (along with "approve", "reject", "cancel", "status", "start session", "stop session", "resume" from earlier phases).
- `/help` is static text — no external lookups needed. Just list the commands and a few example workflows.
- `/history` requires logging command history to Supabase (may already exist from Phase 11's logging task). Query last 10 entries for the user.
- `/cost` requires tracking: (a) Twilio message counts/costs from Phase 11's logging, and (b) estimated API spend from Claude Code usage. For V1, Twilio costs are exact (from logs) and API costs are estimated (message count × average cost per prompt).
- Composite images are less critical with WhatsApp (delivers in order, per-message cost is low) but still reduce thread spam. Use a grid layout: each cell shows the filename, lines changed (+/-), and a thumbnail of the diff. Rendered as a single PNG via the diff rendering pipeline from Phase 5.
- "Reply 'show auth.ts'" — the relay needs to map the filename to the stored individual diff image and send it. This requires keeping the individual diff images available even when a composite was sent.
