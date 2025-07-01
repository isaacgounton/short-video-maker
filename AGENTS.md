# AGENTS.md

## Build, Lint, and Test Commands
- **Install dependencies:** `pnpm install`
- **Build:** `pnpm build` or `npm run build`
- **Dev server:** `pnpm dev` or `npm run dev`
- **Run all tests:** `pnpm test` or `npm run test`
- **Run a single test:** `pnpm test -t <pattern>` (uses Vitest)
- **Lint:** `pnpm lint` (uses ESLint, config: @remotion/eslint-config-flat)

## Code Style Guidelines
- **Language:** TypeScript (strict types, enums for config)
- **Imports:** Use ES modules, absolute imports preferred for project files
- **Formatting:** Prettier enforced, 2 spaces, single quotes, trailing commas
- **Naming:** camelCase for variables/functions, PascalCase for types/classes/enums
- **Types:** Use explicit types and interfaces, leverage zod for validation
- **Error Handling:** Throw errors with clear messages, use logger for info/errors
- **Config:** Use environment variables, validate with zod schemas
- **Music:** Add new tracks to `static/music/` and update `src/short-creator/music.ts`
- **Testing:** Use Vitest, keep tests isolated and fast
- **UI:** React (tsx), functional components, hooks for state/context
- **Other:** Follow CONTRIBUTING.md for setup and PRs

> No Cursor or Copilot rules detected. If added, include their requirements here.
