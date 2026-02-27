# [Your App] — Frontend Client

Brief description of your frontend application and its role in the overall system.

## Repository Structure

```
src/
├── components/       # Reusable UI components
├── screens/          # Screen-level components / pages
├── navigation/       # Navigation configuration
├── hooks/            # Custom hooks
├── services/         # API clients, external service integrations
├── utils/            # Utility functions
├── types/            # TypeScript type definitions
├── constants/        # App-wide constants
└── assets/           # Static assets (images, fonts)
```

Customize this tree to match your actual structure. Include only the top-level directories that matter for orientation.

## Tech Stack

List your core dependencies so agents know what they're working with:

- **Framework**: e.g., React Native, Next.js, Vue
- **Language**: e.g., TypeScript
- **State Management**: e.g., Zustand, Redux, Context API
- **Navigation**: e.g., React Navigation, Next.js Router
- **Styling**: e.g., Tailwind, StyleSheet, styled-components
- **Data Fetching**: e.g., SWR, React Query, tRPC
- **Testing**: e.g., Jest, Vitest, Playwright

## Key Conventions

Document the patterns agents should follow. Examples:

- **Component structure**: Functional components with hooks, no class components
- **Naming**: PascalCase for components, camelCase for utilities, kebab-case for files
- **Imports**: Absolute imports via path aliases (`@/components/Button`)
- **Error handling**: Error boundaries at screen level, try/catch in async operations

## Logging

Describe how to read and filter logs. This helps agents debug issues autonomously.

- Where logs appear (terminal, browser console, Metro bundler, etc.)
- How to filter for relevant output
- Any structured logging conventions (log levels, prefixes)

## Caching & Storage

Describe your client-side data strategy:

- What gets cached and where (memory, disk, AsyncStorage, MMKV, etc.)
- Cache invalidation patterns
- Offline behavior

## API Integration

How does the frontend talk to the backend?

- Base URL configuration (environment-based)
- Authentication token handling
- Request/response patterns
- Error response format

## Testing

- How to run tests: `npm test`, `npx jest --watch`, etc.
- Test file conventions: `*.test.ts`, `__tests__/`, etc.
- What to test vs. what not to test
- Mocking patterns for API calls, navigation, etc.

## Environment Setup

Steps to get the frontend running locally:

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android
```

List any required environment variables (without actual values):

```
API_URL=
AUTH_SECRET=
ANALYTICS_KEY=
```

## Common Gotchas

Document things that trip people (and agents) up:

- e.g., "Hot reload doesn't pick up changes to navigation config — restart Metro"
- e.g., "iOS shadows require both `shadowOffset` and `shadowOpacity` or they won't render"
- e.g., "The `user` object from auth context can be null during the first render"

## Lessons Learned

Append here as you discover non-obvious insights. Keep entries concise:

- **[Topic]**: What you learned and why it matters
- **[Topic]**: What you learned and why it matters
