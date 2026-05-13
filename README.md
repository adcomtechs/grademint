# GPA Pro

GPA Pro is a framework-free, local-first GPA and CGPA calculator for students. It supports multiple grading scales, semester/course tracking, academic insights, transcript output, what-if planning, import/export backups, and browser-only persistence with IndexedDB.

The npm package/repo name is `grademint`, but the implemented product surface uses the `GPA Pro` brand.

## Features

- Real-time semester GPA and cumulative GPA calculation
- 5.0, 4.0, and 7.0 grading scales
- Score, letter-grade, and mixed course entry modes
- Semester tabs, overview mode, course editing, and delete/reset flows
- Student profile and previous academic record support
- Academic insights, analytics, transcript, and what-if views
- Hash-based dashboard navigation with lazy-loaded heavy views
- Versioned JSON export and import/restore support
- Local-first persistence with IndexedDB and localStorage
- Documentation page with search, FAQ, grade lookup, sidebar tracking, and smooth scroll
- Production CSP and deploy-aware metadata support

## Tech Stack

- Vanilla JavaScript ES modules
- Vite multi-page build
- IndexedDB for academic records and settings
- localStorage for small UI preferences
- Vitest with fake-indexeddb and per-file jsdom environments
- ESLint flat config with architectural boundary enforcement
- Prettier

There are currently no runtime npm dependencies.

## Requirements

- Node `>=20.19.0 <25`
- pnpm `>=10.0.0 <11`

This repo declares the package manager in `package.json`:

```bash
corepack enable
corepack prepare pnpm@10.19.0 --activate
```

## Getting Started

```bash
pnpm install
pnpm dev
```

The dev server is configured for port `3005` with `strictPort: true`.

Open:

- `http://localhost:3005/` for the dashboard
- `http://localhost:3005/docs.html` for the docs and grade guide

## Scripts

```bash
pnpm dev          # Start Vite dev server
pnpm build        # Production build
pnpm preview      # Preview production build
pnpm lint         # ESLint
pnpm lint:ci      # ESLint with zero warnings allowed
pnpm lint:fix     # ESLint autofix
pnpm test         # Unit/integration tests
pnpm test:watch   # Watch-mode tests
pnpm coverage     # Coverage report with thresholds
pnpm format       # Format source files
pnpm format:check # Check formatting
```

## Project Structure

```text
src/
  components/   DOM-rendering components and shared UI primitives
  config/       Deploy/runtime metadata helpers
  core/         Store, reducer, router, bootstrap, event emitter
  docs/         Documentation page behaviours
  domain/       Pure business entities and typed errors
  entries/      HTML entry scripts
  services/     IndexedDB, reset, GPA, portability, UI storage
  styles/       Feature/page CSS
  utils/        Constants, DOM helpers, logger, retry, selectors, validators
  __tests__/    Vitest tests
```

## Runtime Design

`index.html` loads `src/entries/dashboard.js`, which bootstraps the store, hydrates IndexedDB data, mounts the dashboard components, and registers hash routes for `dashboard`, `analytics`, `transcript`, `whatif`, and `profile`.

`docs.html` loads `src/entries/docs.js`, which mounts the docs header and wires the documentation interactions.

IndexedDB stores semesters plus student/profile settings. localStorage is reserved for UI-only preferences such as the active semester tab. Export/import uses versioned JSON envelopes and restores persistence before mutating the in-memory store.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the dependency matrix and full runtime design.

## Deployment

Build output is written to `dist/`:

```bash
pnpm build
```

Set `VITE_PUBLIC_ORIGIN` in the deployment environment to emit canonical and Open Graph URLs:

```bash
VITE_PUBLIC_ORIGIN=https://your-production-domain.example pnpm build
```

The Vite config uses `base: './'`, so the built app can be served from a domain root or subdirectory. Production source maps are disabled by default.

## Quality Gates

CI runs:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint:ci`
3. `pnpm format:check`
4. `pnpm coverage`
5. `pnpm build`
6. smoke checks for `dist/index.html` and `dist/docs.html`
7. upload of the `dist/` artifact

Coverage thresholds are enforced in `vitest.config.js`.
