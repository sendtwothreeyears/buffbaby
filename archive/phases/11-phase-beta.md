# Phase 11: Beta

**Stage:** Scale and Polish
**Depends on:** Phase 10 (Session Management)
**Done when:** 10 engineers have used it for 2+ weeks, completing real development work via WhatsApp, AND all graduation criteria are validated.

## What You Build

Invite 10 bootcamp engineers. Monitor costs, reliability, and WhatsApp delivery. Fix issues as they surface. Add logging, monitoring, and alerting.

Deliverables:
- Logging: structured logs for every message (inbound/outbound), latency, errors, Twilio costs
- Monitoring: relay health dashboard (Fly.io metrics + Supabase queries)
- **Alerting:** Basic alerts for relay down, VM unreachable, WhatsApp delivery failure rate spike (Fly.io health checks + email notification)
- Bug fixes and reliability improvements from real-user feedback
- **Graduation gate:** Explicit validation of all PRD graduation criteria before proceeding

## Graduation Criteria (from PRD)

All must be true before moving past this phase:

- [ ] 10 engineers have used it for 2+ weeks
- [ ] Engineers complete 50%+ of agentic sessions via WhatsApp
- [ ] Relay server uptime > 99% over 2-week period
- [ ] Zero message loss or incorrect routing
- [ ] Media messages delivered reliably via WhatsApp
- [ ] Works on both iPhone and Android without platform-specific issues

## Tasks

- [ ] Add logging and monitoring — structured logs, latency tracking, cost per user, basic alerting
  - Plan: `/workflow:plan logging, monitoring, and alerting for WhatsApp relay`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-logging-monitoring-plan.md`

- [ ] Establish beta support process and feedback collection
  - Plan: `/workflow:plan beta support — feedback collection, bug triage, user communication channel`
  - Ship: `/workflow:ship docs/plans/YYYY-MM-DD-feat-beta-support-plan.md`

- [ ] Validate graduation criteria — verify all 6 criteria are met before proceeding
  - This is a `/workflow:phase-review` task, not a `/ship` task. Run after 2+ weeks of beta usage.

## Notes

- This is the first phase where other people use the product. Expect surprises.
- Key things to monitor: WhatsApp delivery success rate, message latency (time from user message to response), VM uptime, Claude Code error rate.
- Budget: 10 users x $5/month VM + ~$5-8/month Twilio per user = ~$100/month during beta. The service absorbs this cost.
- WhatsApp 24-hour session window — proactive notifications (alerts, stale session reminders) only work if the user has messaged within 24 hours. This is a known limitation documented in ARCHITECTURE.md.
- **Support channel:** Define how beta users report issues — a shared Slack channel, Discord, or WhatsApp group. Don't use the product number for support.
- Collect structured feedback: what works, what's confusing, what's missing. This drives Phases 12-16.
