# GradeMint Architecture

> Version: 2.0.0
> Status: Active
> App type: Vite multi-page, framework-free, local-first web app

## Overview

GradeMint is a client-only GPA/CGPA calculator. It ships as two Vite HTML entry points:

- `index.html`: the dashboard application
- `docs.html`: the documentation and grade guide page

The dashboard keeps academic records in IndexedDB, small UI preferences in localStorage, and all live application state in a vanilla JavaScript store. The app has no runtime framework and no runtime npm dependencies; Vite, Vitest, ESLint, Prettier, fake-indexeddb, and jsdom are build/test tooling only.

## Runtime Shape

```text
index.html
  -> src/entries/dashboard.js
     -> apply dashboard metadata
     -> initApp()
        -> create store
        -> open IndexedDB
        -> hydrate semesters, student profile, and previous record
        -> subscribe persistence middleware
     -> mount HeaderView, GPARings, SemesterManager, AcademicInsights, ProfileView
     -> register hash routes with ViewRouter
     -> lazy-load AnalyticsPanel, TranscriptView, and WhatIfView on first activation
     -> wire add-semester, settings, and export actions

docs.html
  -> src/entries/docs.js
     -> apply docs metadata
     -> mount docs HeaderView variant
     -> wire search, FAQ accordion, sidebar tracking, grade widget, and smooth scroll
```

Dashboard navigation is hash-based. `ViewRouter` registers named DOM views, toggles visibility, updates nav link state, and writes the current view with `history.replaceState()` so in-app navigation does not fill the browser history stack.

The registered dashboard views are:

- `dashboard`
- `analytics`
- `transcript`
- `whatif`
- `profile`

## Directory Contract

```text
src/
  components/
    common/       BaseComponent, FatalErrorView, onboarding modal, shared form fields
    dashboard/    GPA rings, semester management, insights, analytics, transcript, what-if
    layout/       Header shell and app navigation
    profile/      Student profile, previous record, and reset/import sections
  config/         Deploy/runtime metadata helpers
  core/           Store, reducer, bootstrap, router, event emitter
  docs/           Documentation-page behaviours
  domain/         Course, Semester, typed application errors
  entries/        Page entry scripts
  services/       GPA, IndexedDB, reset, data portability, UI storage
  styles/         CSS grouped by feature/page
  utils/          Constants, DOM utilities, timing, logger, retry, selectors, validators
  __tests__/      Vitest unit/integration tests
```

## Dependency Matrix

Architectural boundaries are enforced by `eslint-plugin-boundaries` in `eslint.config.js`.

| From         | May Import                                                            |
| ------------ | --------------------------------------------------------------------- |
| `utils`      | no internal layers                                                    |
| `config`     | `utils`                                                               |
| `domain`     | `config`, `utils`                                                     |
| `services`   | `config`, `domain`, `utils`                                           |
| `core`       | `config`, `services`, `domain`, `utils`                               |
| `components` | `config`, `core`, `services`, `domain`, `utils`, `styles`             |
| `docs`       | `config`, `utils`                                                     |
| `styles`     | no internal layers                                                    |
| `entries`    | `config`, `docs`, `components`, `core`, `services`, `domain`, `utils` |

The rule uses `boundaries/dependencies` with `default: "disallow"`, so new cross-layer imports fail unless deliberately added to the matrix. Tests and build configs are exempt where needed because they are not runtime architecture layers.

## State Flow

```text
User action
  -> component event handler
  -> store.dispatch(action)
  -> reducer returns next state
  -> Store emits state:changed
     -> mounted components re-render selected state
     -> bootstrap persistence subscriber writes IndexedDB/settings
```

The UI updates synchronously from memory. Persistence is asynchronous, diff-based for semester records, and retried for transient IndexedDB errors.

## Persistence

IndexedDB uses the `gpa_pro_db` database with two object stores:

- `semesters`: semester/course records keyed by `id`
- `settings`: key/value records for `student` and `previousRecord`

localStorage stores UI-only preferences through `UIStorageService`, including the active semester tab (`ui_active_sem`) and scroll position (`ui_scroll_y`).

Persistence rules:

- Boot creates the store first, then opens IndexedDB and hydrates memory.
- Semester changes are persisted as diffs through one atomic `syncSemesterDiff()` transaction.
- Student profile and previous-record settings are written independently.
- Persistence retries use a shared IndexedDB retry policy before showing a warning toast.
- Import restore writes persistence first, then hydrates memory.
- Reset clears IndexedDB first, then resets the store and clears UI cache.
- If restore/reset persistence fails, memory is not silently mutated.

## Data Model

The canonical state shape is:

```text
{
  semesters: Semester[],
  activeSemesterId: string | null,
  student: {
    name,
    matricNo,
    dept,
    level,
    session,
    scaleId
  },
  previousRecord: {
    creditUnits,
    qualityPoints
  }
}
```

`src/utils/constants.js` defines the immutable grading registry. The supported scale IDs are `5.0`, `4.0`, and `7.0`; `5.0` is the default. Courses can be entered by raw score, letter grade, or both, with the chosen grade key taking precedence for GPA calculation when present.

## Import And Export

`DataPortabilityService` owns backup and restore semantics:

- `createExportPayload(state)`
- `createExportJson(state)`
- `parseImportJson(json)`
- `normalizeImportedState(state)`
- `restoreImportedState(store, idb, importedState)`

Exports are versioned JSON envelopes containing app name, app version, schema version, export time, and normalized state. Imports accept both current envelopes and legacy raw state objects.

## UI Composition

Components are vanilla JavaScript classes/functions that render DOM directly:

- `BaseComponent` isolates render failures for mounted components.
- `HeaderView` has dashboard and docs variants.
- `GPARings` renders overview/semester GPA summaries and delegates actions through callbacks.
- `SemesterManager` owns semester tabs, course forms, edit modals, and overview panels.
- `AcademicInsights`, `AnalyticsPanel`, `TranscriptView`, and `WhatIfView` derive analytical views from store state.
- `ProfileView` owns student settings, previous record, import/restore, and reset flows.

`src/utils/dom.js` is a compatibility barrel over focused DOM modules:

- `elementFactory.js`: `$`, `$$`, `createElement`, `clearElement`
- `modal.js`: `openModal`, `confirmDialog`, focus trap, focus restore
- `toast.js`: `showToast`
- `timing.js`: `debounce`, `throttle`

## Error Handling And Logging

- Component render failures are contained by `BaseComponent`.
- Fatal dashboard boot failures render `FatalErrorView`.
- IndexedDB failures use typed `StorageError` paths where applicable.
- User-facing recovery uses toasts; technical details go through `createLogger()`.
- Direct `console.*` calls are restricted outside `src/utils/logger.js` and tests.

## Metadata, CSP, And Build

`src/config/metadata.js` applies canonical and Open Graph URLs only when `VITE_PUBLIC_ORIGIN` is present.

Both HTML pages define a production CSP allowing self-hosted scripts, Google Fonts styles/font files, self/data/blob images, and no object embeds.

Vite configuration:

- uses `base: './'` for subdirectory-friendly static deployments
- exposes the `@` alias for `src/`
- builds `index.html` and `docs.html`
- targets ES2020-era browsers with IndexedDB, dynamic import, and `import.meta`
- disables production source maps
- keeps a placeholder vendor chunk split for future runtime dependencies
- starts dev on port `3005` with `strictPort: true`

## Testing And CI

Vitest tests cover:

- component rendering under per-file jsdom environments
- domain/GPA arithmetic
- validators, selectors, retry, logger, diffing, and GPA colors
- IndexedDB with fake-indexeddb
- reset recovery
- import/export normalization and restore recovery
- ESLint boundary configuration

Coverage uses the V8 provider with text, HTML, and lcov reporters. Current thresholds are 80% lines, 80% functions, 75% branches, and 80% statements.

CI runs:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint:ci`
3. `pnpm format:check`
4. `pnpm coverage`
5. `pnpm build`
6. build-output smoke checks for `dist/index.html` and `dist/docs.html`
7. `dist/` artifact upload
