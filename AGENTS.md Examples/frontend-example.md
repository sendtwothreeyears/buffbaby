# Authentic React Native Client

## Repository Structure

| Repo                | Purpose                                | Status                      |
| ------------------- | -------------------------------------- | --------------------------- |
| `Authentic_React`   | React Native mobile client (this repo) | **Active**                  |
| `Authentic_Backend` | Current backend                        | **Active**                  |
| `authentic_v2`      | Legacy Next.js backend                 | Deprecated (REFERENCE ONLY) |

## Task Plans

`TASKS/` contains structured plans for active feature work. Each file tracks one feature/epic with an inventory checklist, status, and context. Agents should consult relevant task plans before starting work on a feature, and update them when completing items. See `TASKS/README.md` for conventions and template. **This is also the default location for saving any to-do lists or task tracking files.**

If the user asks to launch/open a specific file, run `open <path>` to open it in the system default app.

## Tech Stack

> [REDACTED — specific framework, language, styling, state management, and testing libraries removed]

## Logging

Use `logger` from `[REDACTED — logger utility path]` (not console.log):

- Levels: `error()`, `warn()`, `info()`, `debug()`
- Default: WARN (clean console)
- Debug: `[REDACTED — environment variable format for per-component log levels]`

### Metro Logs (Agent-Readable)

`npm start` captures Metro output to `logs/metro.log` (interactive mode preserved). The log resets each time Metro starts. Agents can read runtime errors and bundle failures without asking the user to paste terminal output:

```bash
tail -200 logs/metro.log

# Search for errors (strip ANSI codes for clean output)
sed 's/\x1b\[[0-9;]*m//g' logs/metro.log | grep -i "error\|fatal\|failed"
```

## Caching & Storage

> [REDACTED — specific caching library, storage library, and cache tier configuration removed]
>
> General pattern: Three-tier cache (memory → persistent disk → network) with configurable TTLs per data type. Profile picture URLs use short-lived pre-signed URLs with automatic refresh.

Config: `[REDACTED — config file path]`
Helpers: `clearAllCache()` for logout, `clearProfileCache()` for updates

## i18n

Infrastructure exists in `/src/locales/` (i18next + react-i18next).

**Priority languages for new features:** English, Spanish, Korean, Portuguese (pt-BR). Ensure all new user-facing strings are translated for these four languages.

## Deployment

> [REDACTED — specific CI/CD platform, build service, and deployment domains removed]

Three-environment deployment with automated builds on merge:

| Branch       | Profile       | iOS                           | Android                        |
| ------------ | ------------- | ----------------------------- | ------------------------------ |
| `dev`        | `development` | —                             | —                              |
| `staging`    | `preview`     | TestFlight internal (auto)    | Internal testing track (auto)  |
| `production` | `production`  | App Store submission (future) | Play Store submission (future) |

**Promotion workflow:** `feature branch → dev → staging → production`

### How It Works

1. Merge PR to `staging` → CI runs build with `--auto-submit`
2. iOS build goes to TestFlight internal group (no Apple review needed)
3. Android build goes to internal testing track (no Google review needed)
4. Production CD pipeline will be added once staging pipeline is validated

### Version Management

- **Version** (e.g., `5.1.5`): Set manually in config. Human decision — bump when releasing.
- **Build number**: Auto-incremented by build service. Never manage manually.

## Safety Rules

**NEVER execute these commands without explicit user approval:**

```bash
# File deletion
rm -rf, rm -f, find . -delete

# Git destructive operations
git push --force, git reset --hard

# Production deployments (triggers immediate builds, risks breaking clients)
git push origin prod, git merge ... into prod

# Package management
npm ci --force, npm cache clean --force
```

**How to get approval:** Before running any destructive command, STOP and ask the user explicitly: "This command will [describe impact]. Do you want me to proceed?" Wait for a clear "yes" or approval before executing.

## Essential Commands

### Test the Project

Run in this order:

```bash
npm run type-check
npm run lint
npm test
```

### Switch Backend Environment

```bash
npm run env:local      # Local backend (localhost:4000)
npm run env:dev        # Dev server (default for most work)
npm run env:prod       # Production (careful!)
npm run env:pr 42      # PR #42 preview build
npm run env:status     # Show current environment
```

Restart Expo after switching: `npm start`

### E2E Tests

> [REDACTED — specific E2E testing framework and flow directory structure removed]

**After UI/navigation changes:** Flag to user that E2E tests may be affected. Run tests first—only update if they actually fail.

**After adding new features/flows:** Suggest writing a new E2E test if the feature represents a meaningful user journey worth protecting.

## Forbidden Patterns

- ❌ `yarn` (use npm)
- ❌ Hardcoded backend URLs (use environment switcher)
- ❌ [REDACTED — forbidden storage library] (use [REDACTED — preferred storage library])
- ❌ Skipping type-check or lint

## Testing

**Fix locally before pushing:** If CI tests fail, always reproduce and fix locally first (`npm test`). Local tests run in seconds; GitHub CI takes minutes. Don't iterate by pushing and waiting for CI.

**Jest mock scoping:** Test-file `jest.mock()` calls completely override global mocks from `setupTests.ts`. A partial mock in a test file (e.g., only mocking one function) shadows the entire global mock. When adding new exports to a globally-mocked module, check for partial mocks: `grep -r "jest.mock.*modulename" . --include="*.ts" --include="*.tsx"`

## Key Screen Architecture

> [REDACTED — specific screen component names, file paths, and component hierarchy removed]
>
> General pattern: Document which files are the ACTIVE implementations vs legacy dead code. Agents waste significant time editing deprecated files if this isn't clear. Be explicit about what's current and what's legacy.

## Common Gotchas

- **iOS shadows + overflow:hidden (CRITICAL)**: iOS clips shadows when `overflow: 'hidden'` is on the same view that has shadow properties. If shadows appear on Android but not iOS, this is likely the cause. **Fix:** Use separate views—put the shadow on a parent view, put `overflow: 'hidden'` on a child view for content clipping. Use a 3-layer pattern:
  ```
  Layer 1 (outer): shadow properties
  Layer 2 (middle): more shadow properties, NO overflow:hidden
  Layer 3 (inner): overflow:hidden for corner clipping, NO shadows
  ```
- **Auth tokens**: iOS Keychain can be locked when app is backgrounded. Token refresh has retry logic—document your auth architecture if debugging auth issues.
- **[REDACTED — platform-specific widget sync gotcha removed]**
- **Backend date formats**: The backend stores dates in UTC but sometimes sends ISO8601 strings without the `Z` suffix (e.g., `2026-01-12T01:57:10.006` instead of `2026-01-12T01:57:10.006Z`). Date parsers that require timezone info will fail silently. Add fallback formatters that assume UTC for timezone-less dates.

## Debugging Heuristics

- **Diagnose the disease, not the symptom** — If you're adding workarounds (retry logic, warm-up mechanisms, fallbacks) without confirming WHY something fails, you're treating symptoms. Stop and find the root cause. Workarounds compound; root causes don't.

- **When multiple unrelated async operations fail together**, the problem is upstream — something is blocking the JS event loop. Search the codebase for high-frequency operations: `setInterval`, `addListener`, `requestAnimationFrame`, sensor subscriptions.

- **Symptoms can be far from causes** — A network hang doesn't mean a network problem. When the obvious path doesn't pan out, ask "what else runs during this flow?" and widen the search.

- **Interrogate strong clues fully** — If a specific user action (like task switcher) reliably fixes the issue, that's a major hint about the cause. Don't interpret it narrowly.

- **Simulator vs physical device discrepancies** — When something works on simulator but fails on device, consider what's mocked (sensors, cameras, biometrics). The cause may be in code unrelated to the symptom.
