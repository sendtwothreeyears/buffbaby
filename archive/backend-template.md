# [Your App] — Backend Service

Brief description of your backend service and its role in the overall system.

## Repository Structure

```
src/
├── routes/           # API route handlers
├── middleware/        # Express/Fastify middleware
├── services/         # Business logic layer
├── models/           # Database models / Prisma schema
├── utils/            # Utility functions
├── types/            # TypeScript type definitions
├── jobs/             # Background jobs / workers
└── config/           # Configuration and environment
```

Customize this tree to match your actual structure.

## Tech Stack

- **Runtime**: e.g., Node.js, Deno, Bun
- **Framework**: e.g., Express, Fastify, Hono
- **Language**: e.g., TypeScript
- **Database**: e.g., PostgreSQL, MongoDB, SQLite
- **ORM**: e.g., Prisma, Drizzle, TypeORM
- **Auth**: e.g., JWT, session-based, OAuth provider
- **Hosting**: e.g., Railway, Vercel, AWS, self-hosted
- **Testing**: e.g., Jest, Vitest, supertest

## Key Conventions

- **Route structure**: RESTful, versioned (`/api/v1/users`), or describe your pattern
- **Error handling**: How errors are formatted and returned to clients
- **Validation**: Where and how input is validated (middleware, Zod schemas, etc.)
- **Naming**: Database columns (snake_case), API fields (camelCase), etc.

## Database

- **Schema location**: e.g., `prisma/schema.prisma`
- **Migration workflow**: How to create and apply migrations
- **Seeding**: How to seed development data
- **Key relationships**: Brief description of the core data model

```bash
# Run migrations
npx prisma migrate dev

# Generate client after schema changes
npx prisma generate

# Seed database
npx prisma db seed
```

## API Patterns

Document your API conventions so agents produce consistent endpoints:

- **Authentication**: How requests are authenticated (Bearer token, cookies, API keys)
- **Response format**: Standard response shape (e.g., `{ data, error, meta }`)
- **Pagination**: Cursor-based, offset-based, or none
- **Rate limiting**: If applicable, how it works

## Deployment

How the backend gets deployed:

- **Environments**: dev, staging, production
- **Deploy trigger**: e.g., push to `main`, manual deploy, CI/CD pipeline
- **Environment variables**: List required vars (without actual values)
- **Health check**: Endpoint and expected response

```bash
# Deploy to staging
git push origin dev

# Deploy to production (requires approval)
git push origin prod
```

## Testing

- How to run tests: `npm test`
- Test database setup (separate DB, in-memory, transactions)
- API test patterns (supertest, curl examples)
- What to test: routes, services, edge cases
- What NOT to test: framework internals, third-party libraries

## Background Jobs

If applicable, describe:
- Job queue system (Bull, Agenda, custom)
- How to add new jobs
- Monitoring and retry behavior

## Logging & Monitoring

- Log format and levels
- Where logs are viewable (console, log service, dashboard)
- Key metrics to watch
- Error tracking integration (Sentry, etc.)

## Common Gotchas

- e.g., "Prisma client must be regenerated after schema changes (`npx prisma generate`)"
- e.g., "Environment variables on Railway are not available during build — use runtime checks"
- e.g., "The auth middleware skips OPTIONS requests for CORS preflight"

## Lessons Learned

Append here as you discover non-obvious insights:

- **[Topic]**: What you learned and why it matters
- **[Topic]**: What you learned and why it matters
