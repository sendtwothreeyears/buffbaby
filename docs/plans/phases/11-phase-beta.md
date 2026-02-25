# Phase 11: Beta

**Stage:** Scale and Polish
**Depends on:** Phase 10 (Session Management)
**Done when:** 10 engineers have used it for 2+ weeks, completing real development work via SMS, AND all graduation criteria are validated.

## What You Build

Invite 10 bootcamp engineers. Monitor costs, reliability, and MMS delivery across carriers (AT&T, T-Mobile, Verizon). Fix issues as they surface. Add logging, monitoring, and alerting. Label MMS images to handle out-of-order delivery.

Deliverables:
- Logging: structured logs for every message (inbound/outbound), latency, errors, Twilio costs
- Monitoring: relay health dashboard (Fly.io metrics + Supabase queries)
- **Alerting:** Basic alerts for relay down, VM unreachable, MMS delivery failure rate spike (Fly.io health checks + email/SMS notification)
- MMS image labeling/numbering to handle out-of-order delivery
- Bug fixes and reliability improvements from real-user feedback
- **Graduation gate:** Explicit validation of all PRD graduation criteria before proceeding

## Graduation Criteria (from PRD)

All must be true before moving past this phase:

- [ ] 10 engineers have used it for 2+ weeks
- [ ] Engineers complete 50%+ of agentic sessions via SMS
- [ ] Relay server uptime > 99% over 2-week period
- [ ] Zero message loss or incorrect routing
- [ ] MMS images readable and arrive in correct order across AT&T, T-Mobile, Verizon
- [ ] Works on both iPhone and Android without platform-specific issues

## Tasks

- [ ] Add logging and monitoring — structured logs, latency tracking, cost per user, basic alerting
  - Plan: `/workflow:plan logging, monitoring, and alerting for SMS relay`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-logging-monitoring-plan.md`

- [ ] Add MMS image labeling/numbering to handle out-of-order delivery
  - Plan: `/workflow:plan MMS image labeling — number images to handle out-of-order carrier delivery`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-mms-labeling-plan.md`

- [ ] Establish beta support process and feedback collection
  - Plan: `/workflow:plan beta support — feedback collection, bug triage, user communication channel`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-beta-support-plan.md`

- [ ] Validate graduation criteria — verify all 6 criteria are met before proceeding
  - This is a `/workflow:phase-review` task, not a `/ship` task. Run after 2+ weeks of beta usage.

## Notes

- This is the first phase where other people use the product. Expect surprises.
- Key things to monitor: MMS delivery success rate by carrier, message latency (time from user SMS to response SMS), VM uptime, Claude Code error rate.
- MMS out-of-order delivery is a known carrier issue. Label images with numbers (e.g., "[1/4] diff-theme.ts.png") so users can mentally reorder.
- Budget: 10 users × $5/month VM + ~$20/month Twilio per user = ~$250/month during beta. The service absorbs this cost.
- **A2P 10DLC:** Confirm the registration from Phase 1 is active and approved before inviting beta users. High-volume automated SMS without A2P compliance risks carrier filtering.
- **Support channel:** Define how beta users report issues — a shared Slack channel, Discord, or SMS to a separate number. Don't use the product number for support.
- Collect structured feedback: what works, what's confusing, what's missing. This drives Phases 12-16.
