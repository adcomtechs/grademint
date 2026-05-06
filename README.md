# GPA Pro

GPA Pro is a framework-free, local-first GPA and CGPA calculator for students. It supports multiple grading scales, semester/course tracking, academic insights, transcript output, what-if planning, and client-side persistence with IndexedDB.

## Features

- Real-time semester GPA and cumulative GPA calculation
- 5.0, 4.0, and 7.0 grading scales
- Semester/course management with local persistence
- Academic insights, analytics, transcript, and what-if views
- Exportable versioned JSON backups
- Import/restore service with persistence-first recovery behavior
- Documentation page with search, FAQ, and grade lookup widget
- Route-level lazy loading for heavier views
- Production CSP and deploy-aware metadata support

## Tech Stack

- Vanilla JavaScript ES modules
- Vite multi-page build
- IndexedDB for academic data
- localStorage for small UI preferences
- Vitest + fake-indexeddb + jsdom
- ESLint flat config with architectural boundary enforcement
- Prettier

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

The dev server defaults to Vite on port `3005`.

## Scripts

```bash
pnpm dev          # Start Vite dev server
pnpm build        # Production build
pnpm preview      # Preview production build
pnpm lint         # ESLint
pnpm lint:ci      # ESLint with zero warnings allowed
pnpm test         # Unit/integration tests
pnpm coverage     # Coverage report
pnpm format       # Format source files
pnpm format:check # Check formatting
```

## Deployment

Build output is written to `dist/`:

```bash
pnpm build
```

Set `VITE_PUBLIC_ORIGIN` in the deployment environment to emit canonical and Open Graph URLs at runtime:

```bash
VITE_PUBLIC_ORIGIN=https://your-production-domain.example pnpm build
```

Source maps are disabled for production builds by default.

## Quality Gates

CI runs:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint:ci`
3. `pnpm test`
4. `pnpm build`
5. `pnpm coverage`

## Project Structure

```text
src/
  components/   DOM-rendering components and shared UI primitives
  config/       Deploy/runtime configuration helpers
  core/         Store, reducer, router, bootstrap, event bus
  docs/         Documentation page behaviours
  domain/       Pure business entities and typed errors
  entries/      HTML entry scripts
  services/     IndexedDB, reset, GPA, portability, UI storage
  styles/       CSS
  utils/        Focused utility modules and compatibility barrels
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the dependency matrix and runtime design.
