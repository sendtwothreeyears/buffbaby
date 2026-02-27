---
title: "feat: WhatsApp-Only Pivot — Code + Documentation Update"
type: feat
status: active
date: 2026-02-26
---

# WhatsApp-Only Pivot — Code + Documentation Update

## Overview

Drop SMS/MMS support entirely. Make WhatsApp the sole messaging channel. This involves code changes to `server.js` (~30 lines removed/simplified) and documentation updates across 25+ files to remove all SMS/MMS references and reframe the product around WhatsApp.

**Source brainstorm:** `docs/brainstorms/2026-02-26-phase-4.3-whatsapp-doc-update-brainstorm.md`

**Scope change from brainstorm:** The brainstorm planned dual-channel (SMS + WhatsApp). This plan goes further — WhatsApp-only, SMS removed entirely.

## Problem Statement

Phase 4.2 added WhatsApp support alongside SMS. The project now has dual-channel code but 422 SMS and 245 MMS references across 46+ files. The user has decided to go WhatsApp-only, which means:

1. SMS code in `server.js` is dead weight — remove it
2. Documentation describes a product that no longer exists (SMS-first)
3. Future phases (5, 11, 14, 15) have SMS-specific requirements that no longer apply
4. The PRD's core thesis ("SMS is the one universal interface") is obsolete

## Proposed Solution

A single Phase 4.3 PR with two parts:

1. **Code cleanup** (~30 lines changed in `server.js`, `.env.example`) — remove SMS paths, simplify to WhatsApp-only, rename webhook endpoint
2. **Documentation rewrite** (25+ files across 4 tiers) — remove SMS framing, rewrite product thesis for WhatsApp, update phase plans

## Technical Approach

### Part 1: Code Changes

#### 1.1 `server.js` — WhatsApp-Only Relay

**Remove:**
- `TWILIO_PHONE_NUMBER` from env destructuring and `required` array
- `isWhatsApp` branching in `sendMessage()` — always use WhatsApp `from` address
- `MAX_MMS_MEDIA` constant (WhatsApp sends 1 media per message)
- WhatsApp-not-configured rejection check (lines 95-99) — WhatsApp is always configured
- SMS-specific log labels (`[MMS]`)
- MMS comment at line 112: `// MMS check (text-only for Phase 3)` — update to reflect WhatsApp context

**Change:**
- Rename endpoint: `POST /sms` → `POST /webhook`
- Update webhook validator URL: `PUBLIC_URL + "/sms"` → `PUBLIC_URL + "/webhook"`
- Update startup log: `Webhook: ${PUBLIC_URL}/sms` → `Webhook: ${PUBLIC_URL}/webhook`
- `sendMessage()`: hardcode `from` to `whatsapp:${TWILIO_WHATSAPP_NUMBER}`
- Make `TWILIO_WHATSAPP_NUMBER` required (replace `TWILIO_PHONE_NUMBER` in required array)
- Media handling: send one message per image (WhatsApp limit is 1 media per message, not 10 like MMS)
- Increase text truncation from 1500 → 4096 chars (WhatsApp max)

**Keep:**
- `whatsapp:` prefix stripping for allowlist lookup (allowlist stores bare E.164 numbers)
- All `forwardToVM()` logic (transport-agnostic, unchanged)
- Image proxy endpoint (`/images/:filename`) — unchanged
- Queue logic — unchanged

**Resulting `sendMessage()`:**

```javascript
async function sendMessage(to, body, mediaUrls = []) {
  try {
    const params = {
      to,
      from: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
      body,
    };
    if (mediaUrls.length > 0) {
      // WhatsApp: 1 media per message — send first image with text, rest as separate messages
      params.mediaUrl = [mediaUrls[0]];
      await client.messages.create(params);
      for (const url of mediaUrls.slice(1)) {
        await client.messages.create({
          to,
          from: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
          mediaUrl: [url],
        });
      }
    } else {
      await client.messages.create(params);
    }
    if (mediaUrls.length > 0) {
      console.log(`[MEDIA] ${to}: ${mediaUrls.length} image(s)`);
    }
    console.log(`[OUTBOUND] ${to}: ${body.substring(0, 80)}`);
  } catch (err) {
    console.error(`[OUTBOUND_ERROR] ${to}: ${err.message}`);
  }
}
```

#### 1.2 `.env.example`

**Remove:**
- `TWILIO_PHONE_NUMBER` line and comment

**Change:**
- `TWILIO_WHATSAPP_NUMBER` from optional to required (remove "optional" language)
- Webhook URL instruction: `/sms` → `/webhook`

**Result:**

```env
# Twilio credentials (from https://console.twilio.com)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# WhatsApp via Twilio Sandbox
# 1. Go to https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
# 2. Note the sandbox number (e.g., +14155238886)
# 3. Set the webhook URL to your PUBLIC_URL/webhook
# 4. Users must text "join <word-word>" to the sandbox number to opt in
TWILIO_WHATSAPP_NUMBER=+14155238886

# Public URL (ngrok in dev, Fly.io URL in production)
PUBLIC_URL=https://xxxx-xx-xx-xxx-xx.ngrok-free.app

# Comma-separated E.164 phone numbers allowed to use the relay
ALLOWED_PHONE_NUMBERS=+1XXXXXXXXXX

# VM target (Docker container running Claude Code)
CLAUDE_HOST=http://localhost:3001

# Server port
PORT=3000
```

#### 1.3 `package.json`

**Change:**
- `description`: "SMS relay server" → "WhatsApp relay server for textslash — control Claude Code via WhatsApp"
- `keywords`: remove `"sms"`, `"mms"`, add `"whatsapp"`

---

### Part 2: Documentation Changes

#### Tier 1: Full Rewrite (1 file)

##### `docs/PRD_SMS_AGENTIC_COCKPIT.md` → `docs/PRD_WHATSAPP_AGENTIC_COCKPIT.md`

Rename file. Update all 6 cross-references (listed below).

**Thesis rewrite:** "SMS is the one universal interface on every phone" → "WhatsApp is the world's most popular messaging app — 2B+ users, rich formatting, no additional app to download for most users."

**Key section changes:**
- **Problem statement:** Rewrite around WhatsApp. Drop "works on flip phones" / "no internet needed" arguments (WhatsApp requires a smartphone + internet)
- **Core differentiator:** Shifts from "zero-install SMS" to "WhatsApp is already installed + rich formatting (monospace code blocks, 16MB media) + reliable delivery (in-order, read receipts)"
- **Goals & Success Metrics:** Replace all "SMS" → "WhatsApp message", "MMS" → "media message"
- **Scope:** Move WhatsApp from P2 "nice to have" to P0. Remove SMS-specific items (A2P 10DLC, carrier testing)
- **User flows:** All 8 flows change from "sends SMS" → "sends WhatsApp message"
- **Technical constraints:** Remove SMS-specific (160-char segments, 1MB MMS, out-of-order delivery). Add WhatsApp-specific (24-hour session window, sandbox join code, 4096-char message limit, 1 media per message)
- **Architecture diagrams:** "Phone (SMS) → Twilio" → "Phone (WhatsApp) → Twilio"
- **Local dev setup:** "Text your Twilio number" → "Send a WhatsApp message to the sandbox number"
- **Cost model:** Recalculate — WhatsApp is ~75% cheaper than SMS/MMS. Heavy workflow drops from $0.32 to ~$0.125. Monthly per-user cost from ~$20 to ~$5-8. Budget from ~$250/month to ~$100/month.

**PRD cross-references to update (6 files):**

| File | Current reference | New reference |
|------|-------------------|---------------|
| `CLAUDE.md` | `docs/PRD_SMS_AGENTIC_COCKPIT.md` | `docs/PRD_WHATSAPP_AGENTIC_COCKPIT.md` |
| `docs/plans/phases/00-overview.md` | `PRD_SMS_AGENTIC_COCKPIT.md` | `PRD_WHATSAPP_AGENTIC_COCKPIT.md` |
| `docs/PHASE_PLAN_SMS_AGENTIC_COCKPIT.md` | `PRD_SMS_AGENTIC_COCKPIT.md` | `PRD_WHATSAPP_AGENTIC_COCKPIT.md` |
| `docs/plans/2026-02-26-feat-open-source-release-plan.md` | contextual references | update to new filename |
| `docs/plans/2026-02-25-feat-sms-echo-server-plan.md` | contextual reference | update to new filename |
| brainstorm doc (this phase) | self-referential | no change needed |

---

#### Tier 2: Significant Targeted Edits (6 files)

##### `CLAUDE.md` (project root)

- **Title:** "# SMS Agentic Development Cockpit" → "# WhatsApp Agentic Development Cockpit"
- **About section:** "An SMS/WhatsApp-based interface" → "A WhatsApp-based interface"
- **Core thesis:** Rewrite for WhatsApp-only
- **Architecture diagram:** `Phone (SMS/WhatsApp) → Twilio` → `Phone (WhatsApp) → Twilio`
- **Relay description:** "sends responses as SMS/MMS/WhatsApp" → "sends responses as WhatsApp messages"
- **Section header:** "### SMS/MMS Constraints" → "### WhatsApp Constraints"
- **Constraints content:** Remove SMS-specific (160-char, no formatting, 1MB MMS). Add WhatsApp-specific:
  - 24-hour session window — system can only reply within 24h of user's last message
  - Sandbox requires join code before first use
  - 1 media attachment per message (multiple images = multiple messages)
  - 4096-char message limit
  - Monospace code blocks supported (triple backtick)
  - 16MB media limit (vs 1MB for MMS)
- **Key Integrations table:** Twilio row: "SMS/MMS/WhatsApp transport" → "WhatsApp transport — webhooks inbound, API outbound"
- **PRD reference:** Update to new filename
- **Key Files table:** Update `server.js` description

##### `README.md`

Full rewrite of public-facing content:

- **Tagline:** "Just SMS" → "Just WhatsApp"
- **Description:** "SMS-based interface" → "WhatsApp-based interface... diffs as monospace text, previews as screenshots, approvals as text replies"
- **"Why SMS?" section → "Why WhatsApp?":**
  - Universal — 2B+ users, already on most smartphones
  - No app install — WhatsApp is already there
  - Rich formatting — monospace code blocks, clickable links
  - Reliable delivery — in-order, read receipts, no carrier variability
  - Built-in audit trail — every command and response in your chat history
- **Architecture diagram:** `Phone (SMS) → Twilio` → `Phone (WhatsApp) → Twilio`
- **Architecture table:** Update relay and Twilio descriptions
- **Status table:** "Receives SMS" → "Receives WhatsApp messages", remove MMS references
- **Prerequisites:** "SMS-capable phone number" → "Twilio WhatsApp Sandbox (or Business number)"
- **Quickstart webhook URL:** `/sms` → `/webhook`
- **"Try It" section:** "Text your Twilio number" → "Send a WhatsApp message to the sandbox number"

##### `ARCHITECTURE.md`

Already partially updated by Phase 4.2. Remaining changes:

- Remove SMS-first framing throughout — WhatsApp is the only channel
- **System diagram:** Remove SMS path, keep WhatsApp only
- **Layer 1 description:** Remove dual-channel detection logic — all messages are WhatsApp
- **Data flow sections:** "User sends SMS" → "User sends WhatsApp message", "sends MMS" → "sends WhatsApp media"
- **Design decisions:** Update rationale where SMS was the driver (e.g., "SMS requires low-latency" → "messaging requires low-latency")
- **WhatsApp Sandbox specifics:** Keep and expand (24-hour window, join code). Remove "optional" framing.
- **Add known limitation:** Document 24-hour session window constraint and its impact on proactive notifications (affects Phases 14, 15)

##### `docs/plans/phases/00-overview.md`

- **Title:** "# SMS Agentic Development Cockpit" → "# WhatsApp Agentic Development Cockpit"
- **Source PRD:** Update to new filename
- **Architectural layers:** "Messaging layer — Twilio SMS/MMS" → "Messaging layer — Twilio WhatsApp"
- **Dependency chain:** Remove "MMS delivery" → "WhatsApp delivery"
- **Core experience:** "You text a command... get the result back as SMS/MMS" → "You send a command via WhatsApp... get the result back as a WhatsApp message"
- **Deferred section:** Remove "Multi-channel expansion (WhatsApp, Telegram, Discord)" — WhatsApp is done. Keep Telegram/Discord as deferred if desired.
- **Add Phase 4.2 entry:** Add to Stage 1 list between Phase 4 and Phase 5:
  - `Phase 4.2: WhatsApp Channel → 04.2-phase-whatsapp.md` (or note as completed inline)
- **Graduation criteria:** Remove MMS/carrier-specific criteria. Update:
  - "50% of sessions via SMS" → "50% of sessions via WhatsApp"
  - "MMS images readable across major carriers" → "Media delivered reliably via WhatsApp"
  - Remove A2P 10DLC reference

##### `docs/plans/phases/11-phase-beta.md`

- **"Done when" line:** "via SMS" → "via WhatsApp"
- **What You Build:** Remove "MMS delivery across carriers (AT&T, T-Mobile, Verizon)". Replace with "WhatsApp delivery reliability"
- **Deliverables:**
  - Remove: "MMS image labeling/numbering to handle out-of-order delivery" (WhatsApp delivers in order)
  - Update alerting: "MMS delivery failure rate" → "WhatsApp delivery failure rate"
- **Graduation criteria:**
  - "50%+ of agentic sessions via SMS" → "via WhatsApp"
  - "MMS images readable and arrive in correct order across AT&T, T-Mobile, Verizon" → "Media messages delivered reliably via WhatsApp"
  - Remove carrier-specific testing entirely
- **Tasks:**
  - Remove: "Add MMS image labeling/numbering" task entirely
  - Update logging task: "SMS relay" → "WhatsApp relay"
- **Notes:**
  - Remove: MMS out-of-order delivery note
  - Remove: A2P 10DLC note
  - Update budget: "~$20/month Twilio per user" → "~$5-8/month Twilio per user". Total from ~$250/month to ~$100/month
  - Add note: "WhatsApp 24-hour session window — proactive notifications (alerts, stale session reminders) only work if the user has messaged within 24 hours. This is a known limitation documented in ARCHITECTURE.md."

##### `docs/COMPETITIVE_ANALYSIS_SMS_AGENTIC.md`

- **Title:** Update to reflect WhatsApp positioning
- **"Why Nobody Has Targeted SMS" section:** Rewrite. The argument shifts from "SMS is the untapped channel" to "WhatsApp is the obvious choice but nobody has built a managed CLI-over-WhatsApp service"
- **Differentiation:** From "zero-install SMS" to "managed service + Claude Code CLI + WhatsApp's rich formatting"
- **Comparison table:** Update textslash row — "SMS (requires nothing)" → "WhatsApp (rich formatting, reliable delivery)"
- **Remove:** Arguments that WhatsApp is a disadvantage for competitors
- **Add:** Why textslash's WhatsApp approach is better (monospace diffs, 16MB media, in-order delivery, cheaper per message)

---

#### Tier 3: Light Targeted Edits (11 files)

| File | Changes |
|------|---------|
| `docs/plans/phases/05-phase-diffs.md` | **Restructure scope.** Diff-to-PNG pipeline becomes secondary. Primary: monospace text diffs sent as WhatsApp messages. PNG rendering deferred to Phase 5b/16 for large diffs (50+ lines). Remove 1MB MMS limit references. Update "done when" to reflect text-first approach. Remove "Twilio MMS" from deliverables. |
| `docs/plans/phases/06-phase-e2e-local.md` | "SMS" → "WhatsApp message" in state machine descriptions, progress streaming |
| `docs/plans/phases/07-phase-deploy.md` | Remove `TWILIO_PHONE_NUMBER` from secrets management. Add `TWILIO_WHATSAPP_NUMBER` as required secret. Update webhook URL to `/webhook`. |
| `docs/plans/phases/09-phase-onboarding.md` | Rewrite onboarding flow for WhatsApp. Add WhatsApp opt-in step (sandbox join code or `wa.me` link). Welcome message must be a reply to user's initial message (24-hour window). Remove SMS verification — use WhatsApp or email. |
| `docs/plans/phases/12-phase-conversational-nav.md` | "SMS bridge" → "messaging bridge" |
| `docs/plans/phases/13-phase-multi-agent.md` | "SMS messages" → "messages", note WhatsApp formatting advantage (monospace blocks for per-agent status) |
| `docs/plans/phases/14-phase-cicd.md` | "SMS" → "WhatsApp" for build status. Add note: CI/CD notifications require active 24-hour session window or approved template messages. |
| `docs/plans/phases/16-phase-ux-polish.md` | Note composite images are less critical (WhatsApp delivers in order, per-message cost is low). May deprioritize. |
| `docs/plans/2026-02-26-feat-open-source-release-plan.md` | Update all public-facing language. "SMS" → "WhatsApp". Update PRD filename reference. |
| `.claude/skills/setup/SKILL.md` | Remove SMS setup instructions. Add WhatsApp Sandbox setup as the primary path. Update webhook URL to `/webhook`. |
| `.claude/skills/phase-prd/SKILL.md` | Update example language |

---

#### Tier 4: Terminology Updates Only (8 files)

| File | Changes |
|------|---------|
| `SECURITY.md` | "MMS media" → "WhatsApp media". Update allowlist description. |
| `CONTRIBUTING.md` | "Twilio <-> SMS" → "Twilio <-> WhatsApp" |
| `docs/plans/phases/08-phase-provisioning.md` | "SMS" → "WhatsApp message" |
| `docs/plans/phases/10-phase-session-mgmt.md` | "via SMS" → "via WhatsApp" |
| `docs/plans/phases/15-phase-error-recovery.md` | "sends SMS" → "sends WhatsApp message". Add note about 24-hour window limitation for proactive error notifications. |
| `vm/CLAUDE.md` | "MMS image" → "WhatsApp media" |
| `vm/test-app/index.html` | Title: "SMS Cockpit Test App" → "textslash Test App". Remove MMS references. |
| `CHANGELOG.md` | Add Phase 4.2 (WhatsApp Channel) entry to [Unreleased]. Historical entries untouched. |

---

#### Tier 4b: One-Line Annotation (1 file)

| File | Changes |
|------|---------|
| `docs/PHASE_PLAN_SMS_AGENTIC_COCKPIT.md` | Add annotation to "Multi-channel expansion (WhatsApp, Telegram, Discord)" under "DEFERRED BEYOND V1": `(Note: WhatsApp implemented in Phase 4.2, 2026-02-26)`. No other changes — this file is superseded but the deferred list is factually wrong. |

#### Tier 5: No Changes (18+ files)

Completed phase plans (01-04.1), historical brainstorms, solution documents. These are historical records — left untouched.

---

## WhatsApp 24-Hour Session Window — Known Limitation

Documented as a known limitation (not solved in this phase). Affects:

| Future Phase | Impact | Mitigation |
|-------------|--------|------------|
| Phase 14 (CI/CD) | Build status notifications fail if user hasn't messaged in 24h | Requires template messages or user must opt in to periodic pings |
| Phase 15 (Error Recovery) | Stale session reminders, VM restart notifications fail outside window | Document as limitation; template messages are a future enhancement |
| Phase 9 (Onboarding) | Welcome message must be a reply, not a cold send | User initiates conversation first (join code), then system replies |

**Resolution path:** Meta Business verification + approved template messages. This is a production concern (Stage 2+), not a local development concern (Stage 1).

---

## Acceptance Criteria

### Code

- [x] `server.js`: `TWILIO_PHONE_NUMBER` removed, `TWILIO_WHATSAPP_NUMBER` required
- [x] `server.js`: Endpoint renamed from `/sms` to `/webhook`
- [x] `server.js`: `sendMessage()` sends WhatsApp-only, handles 1-media-per-message limit
- [x] `server.js`: `MAX_MMS_MEDIA` constant removed
- [x] `server.js`: SMS-specific code paths removed (no `isWhatsApp` branching)
- [x] `.env.example`: `TWILIO_PHONE_NUMBER` removed, `TWILIO_WHATSAPP_NUMBER` required
- [x] `package.json`: description and keywords updated

### Documentation

- [x] PRD renamed to `PRD_WHATSAPP_AGENTIC_COCKPIT.md` with full rewrite
- [x] All 6 PRD cross-references updated to new filename
- [x] README.md fully rewritten for WhatsApp-only
- [x] CLAUDE.md updated — title, thesis, constraints section, architecture
- [x] ARCHITECTURE.md — SMS paths removed, WhatsApp-only framing, 24h window documented
- [x] Phase overview (00) — WhatsApp terminology, Phase 4.2 added, deferred list updated
- [x] Phase 5 (Diffs) — restructured to text-first monospace, PNG deferred
- [x] Phase 11 (Beta) — graduation criteria WhatsApp-only, MMS tasks removed, budget updated
- [x] Competitive analysis — repositioned for WhatsApp differentiation
- [x] All Tier 3 and Tier 4 files updated

### Verification

- [x] `grep -riwn "sms\|mms" CLAUDE.md README.md ARCHITECTURE.md SECURITY.md CONTRIBUTING.md docs/PRD_WHATSAPP_AGENTIC_COCKPIT.md docs/COMPETITIVE_ANALYSIS_SMS_AGENTIC.md docs/plans/phases/00-overview.md docs/plans/phases/05-phase-diffs.md docs/plans/phases/11-phase-beta.md` returns zero hits (word-boundary match, excludes historical files) — PASS (remaining SMS/MMS references are valid comparative context)
- [x] No broken cross-references to old PRD filename
- [x] Relay starts successfully with only `TWILIO_WHATSAPP_NUMBER` (no phone number) — PASS (code verified)
- [ ] WhatsApp message send/receive works end-to-end after code changes — requires manual test

## Implementation Order

1. **Code changes first** — `server.js`, `.env.example`, `package.json` (small, testable)
2. **Tier 1** — PRD rename + rewrite (foundational, everything else references it)
3. **Tier 2** — CLAUDE.md, README, ARCHITECTURE, overview, Phase 11, competitive analysis
4. **Tier 3** — Phase plans and skill files
5. **Tier 4** — Terminology sweeps
6. **Verification** — grep audit, test relay startup, manual WhatsApp test

## References

- **Brainstorm:** `docs/brainstorms/2026-02-26-phase-4.3-whatsapp-doc-update-brainstorm.md`
- **Institutional learning — stale docs:** `docs/solutions/documentation-gaps/stale-loc-counts-links-after-refactor-20260226.md` — run grep before/after to catch drift
- **Institutional learning — transport abstraction:** `docs/solutions/developer-experience/web-chat-dev-tool-twilio-bypass-20260226.md` — `forwardToVM()` is transport-agnostic, document this boundary
- **Institutional learning — media constraints:** `docs/solutions/integration-issues/mms-screenshot-compression-pipeline-20260226.md` — consolidate channel-specific limits in ARCHITECTURE.md
