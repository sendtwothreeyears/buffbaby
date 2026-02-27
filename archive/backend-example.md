# Authentic Express Backend

## Repository Structure

| Repo                | Purpose                                | Status                      |
| ------------------- | -------------------------------------- | --------------------------- |
| `Authentic_React`   | React Native mobile client             | **Active**                  |
| `Authentic_Backend` | Express API backend (this repo)        | **Active**                  |
| `authentic_v2`      | Legacy Next.js backend                 | Deprecated (REFERENCE ONLY) |

## Tech Stack

> [REDACTED — specific framework, database, ORM, real-time library, storage provider, auth strategy, and third-party services removed]

## Deployment

> [REDACTED — specific hosting platform and deployment domains removed]

The backend is deployed with branch-based auto-deployment:

| Branch | Environment | Domain |
|--------|-------------|--------|
| `dev` | Development | [REDACTED] |
| `staging` | Staging | [REDACTED] |
| `prod` | Production | [REDACTED] |

### How Deployment Works

1. Push to `dev`, `staging`, or `prod` branch
2. GitHub Actions CI validates (typecheck, lint, test, build)
3. Hosting platform auto-builds and deploys:
   - `npm run build` (compiles TypeScript)
   - `npm run prisma:deploy` (runs pending migrations)
   - `npm start` (starts production server)
4. Health check at `/health` validates deployment

### Deployment Commands

```bash
git push origin dev      # Deploy to dev
git push origin staging  # Deploy to staging
git push origin prod     # Deploy to production (requires approval)
```

### Environment Variables

Configured in hosting platform dashboard — separate for dev/staging/prod. Staging uses production credentials for external services with an isolated database branch.

## Safety Rules

**NEVER execute these commands without explicit user approval:**

```bash
# File deletion
rm -rf, rm -f, find . -delete

# Git destructive operations
git push --force, git reset --hard

# Production deployments
git push origin prod, git merge ... into prod

# Package management
npm ci --force, npm cache clean --force

# Database destructive commands
npx prisma db push --force-reset
npx prisma migrate reset
npx prisma db seed
npx prisma migrate deploy --force
```

**How to get approval:** Before running any destructive command, STOP and ask the user explicitly: "This command will [describe impact]. Do you want me to proceed?" Wait for a clear "yes" or approval before executing.

## Essential Commands

### Development
```bash
npm run dev          # Start dev server (localhost:4000)
npm run build        # Build TypeScript
npm start            # Start production server
```

### Code Quality
```bash
npm run typecheck    # TypeScript checking
npm run lint         # ESLint
npm test             # Run tests
npm run test:watch   # Tests in watch mode
```

### Database
```bash
npm run prisma:generate   # Generate Prisma client
npm run prisma:migrate    # Run migrations
npm run prisma:studio     # Open Prisma Studio GUI
npm run db:seed           # Seed database
```

### Test Data

> [REDACTED — specific test data seeding tool and commands removed]
>
> General pattern: Have scripts that generate realistic test data at different scales (minimal, standard, full). Makes it easy to spin up a usable dev environment quickly.

## Forbidden Patterns

- ❌ `yarn` (use npm)
- ❌ [REDACTED — forbidden port number] (legacy backend port; this runs on a different port)
- ❌ Skipping typecheck or lint

## Common Gotchas

- **Auth tokens**: JWT access tokens are short-lived. Refresh token rotation is implemented—document your auth architecture if debugging auth issues.
- **[REDACTED — real-time messaging implementation details removed]**
