# Contributing

Use Node 22+ and npm. Install with `npm ci`, then `npm run dev`.

Before opening a pull request, run `npm run check`, `npm run verify:public`, and `npm run test:e2e`. Install the Playwright browser once with `npx playwright install chromium`.

Keep fixtures and screenshots fictional. Never commit local imports or original private workflow documents. Extend the versioned contracts and their validation together. Preserve source text exactly, distinguish references from execution order, and test import/export changes with meaningful roundtrips.

Describe the problem, resulting behavior, and validation in the pull request. Include a desktop and mobile screenshot for material visual changes. See [the architecture](docs/ARCHITECTURE.md) and [repository instructions](AGENTS.md) for the data and privacy boundaries.
