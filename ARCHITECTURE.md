# GPA Pro Architecture

> Version: 2.0.0  
> Status: Active  
> App type: Vite multi-page, framework-free, local-first web app

## Overview

GPA Pro is a client-only GPA/CGPA calculator. It has two HTML entry points:

- `index.html`: dashboard SPA
- `docs.html`: documentation and grade guide

The dashboard stores academic data in IndexedDB, keeps small UI preferences in localStorage, and renders all UI with vanilla JavaScript components.

## Runtime Shape

```text
index.html
  -> src/entries/dashboard.js
     -> initApp()
     -> mount dashboard shell components
     -> register hash routes
     -> lazy-load heavy route views on first activation

docs.html
  -> src/entries/docs.js
     -> apply deploy metadata
     -> wire docs search, FAQ, sidebar tracker, grade widget, smooth scroll
```

Heavy dashboard views are loaded with dynamic imports:

- `AnalyticsPanel`
- `TranscriptView`
- `WhatIfView`
- supporting chart code

This keeps the initial dashboard chunk smaller while preserving direct hash navigation.

## Directory Contract

```text
src/
  components/
    common/       BaseComponent, FatalErrorView, shared form primitives
    dashboard/    GPA rings, semester manager, analytics, transcript, what-if
    layout/       Header/shell components
    profile/      Profile/settings sections
  config/         Deploy/runtime metadata helpers
  core/           Store, reducer, bootstrap, router, event bus
  docs/           Documentation-page behaviours
  domain/         Course, Semester, typed application errors
  entries/        Page entry scripts
  services/       GPA, IndexedDB, reset, data portability, UI storage
  styles/         CSS files
  utils/          DOM utilities, timing, logger, retry, selectors, validators
```

## Dependency Matrix

Architectural boundaries are enforced by `eslint-plugin-boundaries` in `eslint.config.js`.

| From | May Import |
| --- | --- |
| `utils` | no internal layers |
| `config` | `utils` |
| `domain` | `config`, `utils` |
| `services` | `config`, `domain`, `utils` |
| `core` | `config`, `services`, `domain`, `utils` |
| `components` | `config`, `core`, `services`, `domain`, `utils`, `styles` |
| `docs` | `config`, `utils` |
| `styles` | no internal layers |
| `entries` | `config`, `docs`, `components`, `core`, `services`, `domain`, `utils` |

The rule uses `boundaries/dependencies` with `default: "disallow"` so new cross-layer imports fail unless deliberately added to the matrix.

## State Flow

```text
User action
  -> component event handler
  -> store.dispatch(action)
  -> reducer returns next state
  -> Store emits state:changed
     -> UI subscribers re-render selected slices
     -> bootstrap persistence subscriber writes IndexedDB
```

The UI updates synchronously from memory. Persistence is asynchronous and retried for transient IndexedDB errors.

## Persistence

IndexedDB stores:

- `semesters`: semester/course records
- `settings`: student profile and previous institutional record

localStorage stores:

- active semester tab and other UI-only preferences via `UIStorageService`

Persistence rules:

- Semester changes are persisted as diffs with atomic IndexedDB transactions.
- Full restore writes IndexedDB first, then hydrates memory.
- Reset clears IndexedDB first, then resets memory and UI cache.
- If storage restore/reset fails, in-memory state is not silently mutated.

## Import/Export Recovery

`DataPortabilityService` owns backup and restore semantics:

- `createExportPayload(state)`
- `createExportJson(state)`
- `parseImportJson(json)`
- `normalizeImportedState(state)`
- `restoreImportedState(store, idb, importedState)`

Exports are versioned envelopes. Imports accept both versioned exports and legacy raw state objects.

## DOM Utilities

`src/utils/dom.js` is a compatibility barrel over focused modules:

- `elementFactory.js`: `$`, `$$`, `createElement`, `clearElement`
- `modal.js`: `openModal`, `confirmDialog`, focus trap, focus restore
- `toast.js`: `showToast`
- `timing.js`: `debounce`, `throttle`

## Error Handling

- Component render failures are isolated by `BaseComponent`.
- Fatal entry boot failures render `FatalErrorView`.
- Technical error details are logged through `createLogger()` and are not shown in production UI.

## Metadata And CSP

`src/config/metadata.js` applies canonical and Open Graph URLs only when `VITE_PUBLIC_ORIGIN` exists.

Both HTML pages define a production CSP allowing:

- self-hosted scripts
- Google Fonts styles and font files
- self/data/blob images
- no object embeds

## Testing

The suite covers:

- domain and GPA arithmetic
- validators, selectors, retry, logger, diff
- components under jsdom
- IndexedDB with fake-indexeddb
- reset recovery
- import/export restore recovery
- ESLint boundary configuration

CI runs install, strict lint, tests, build, and coverage.

## Build

Vite builds two entry points and emits route-level chunks. Production source maps are disabled.
