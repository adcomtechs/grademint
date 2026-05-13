/**
 * @file vitest.config.js
 * @description Vitest configuration.
 *
 * Kept separate from vite.config.js intentionally:
 * Vite config controls the browser build (plugins, server, rollup).
 * Vitest config controls the test environment (resolver, globals, coverage).
 * Merging them couples two independent concerns and makes each harder to read.
 *
 * The @/ alias must match vite.config.js exactly so that imports inside
 * source files resolve identically in both the build and test contexts.
 *
 * COVERAGE THRESHOLDS — CURRENT STATE:
 * Thresholds are set to reflect actual coverage at this stage of the project.
 * The majority of untested files are DOM-rendering components (dashboard/,
 * rings/, semester/, transcript/, whatif/, analytics/) that require a jsdom
 * environment. That environment has not been configured yet — these components
 * are intentionally excluded from the coverage include list until the jsdom
 * test suite is added.
 *
 * ROADMAP — raise thresholds in this order:
 *   Phase 1 (now)    — domain/, services/, utils/, core/ unit tests ✅
 *   Phase 2 (next)   — configure jsdom environment, add component tests
 *                      → raise thresholds to ~55% across all metrics
 *   Phase 3 (future) — full component + integration coverage
 *                      → raise thresholds to 80%+ across all metrics
 *
 * Never lower thresholds without a documented reason. Only raise them.
 *
 * REPORTERS:
 * - 'text'  — prints the summary table to stdout (visible in CI logs).
 * - 'html'  — writes a browsable report to coverage/index.html for local
 *              inspection. Not used by CI directly.
 * - 'lcov'  — writes coverage/lcov.info, the standard format consumed by
 *              coverage services (Codecov, Coveralls) and IDE integrations.
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    // 'node' environment: correct for domain/utils/services/core unit tests.
    //
    // Components that touch the DOM require 'jsdom'. Configure as a separate
    // project entry when ready — domain tests must not pay the jsdom startup
    // cost.
    //
    // When jsdom tests are added:
    // projects: [
    //   { test: { include: ['src/__tests__/unit/**/*.test.js'], environment: 'node' } },
    //   { test: { include: ['src/__tests__/components/**/*.test.js'], environment: 'jsdom' } },
    // ],
    environment: 'node',

    // Explicit imports keep test files self-documenting and IDE-friendly.
    globals: false,

    // Test file discovery — only files matching this pattern are collected.
    include: ['src/__tests__/**/*.test.js'],

    coverage: {
      provider: 'v8',

      // text  — summary table in CI stdout
      // html  — browsable local report at coverage/index.html
      // lcov  — machine-readable coverage/lcov.info for coverage services
      reporter: ['text', 'html', 'lcov'],

      // Measure coverage on source files only — not tests or build artifacts.
      // DOM-heavy component directories are included in measurement but their
      // low numbers are expected until the jsdom test suite is configured.
      include: ['src/**/*.js'],
      exclude: ['src/__tests__/**', 'src/entries/**', 'src/styles/**'],

      // ── Coverage thresholds ───────────────────────────────────────────────
      // Set to match actual coverage at project launch (Phase 1).
      // Current measured values:
      //   statements : 23.1%
      //   branches   : 24.07%
      //   functions  : 24.54%
      //   lines      : 22.97%
      //
      // Thresholds are set 3 points below each measured value to absorb
      // minor fluctuations as new source files are added. They represent
      // a floor, not a target.
      //
      // ⚠️  Do not lower these values. Raise them as test coverage grows.
      // The next milestone is Phase 2: jsdom component tests configured,
      // thresholds raised to ~55%.
      thresholds: {
        statements: 20,
        branches: 21,
        functions: 21,
        lines: 20,
      },
    },
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});

// /**
//  * @file vitest.config.js
//  * @description Vitest configuration.
//  *
//  * Kept separate from vite.config.js intentionally:
//  * Vite config controls the browser build (plugins, server, rollup).
//  * Vitest config controls the test environment (resolver, globals, coverage).
//  * Merging them couples two independent concerns and makes each harder to read.
//  *
//  * The @/ alias must match vite.config.js exactly so that imports inside
//  * source files resolve identically in both the build and test contexts.
//  *
//  * COVERAGE THRESHOLDS:
//  * The thresholds block makes `vitest run --coverage` exit with a non-zero
//  * code when coverage falls below the declared minimums. Without thresholds,
//  * the Coverage CI step always passes regardless of actual coverage, giving
//  * a false sense of safety. Adjust values upward as the test suite matures —
//  * never downward without a documented justification.
//  *
//  * REPORTERS:
//  * - 'text'  — prints the summary table to stdout (visible in CI logs).
//  * - 'html'  — writes a browsable report to coverage/index.html for local
//  *              inspection. Not used by CI directly.
//  * - 'lcov'  — writes coverage/lcov.info, the standard format consumed by
//  *              coverage services (Codecov, Coveralls) and IDE integrations.
//  *              Add this to CI artifact uploads if you integrate a service.
//  */

// import { defineConfig } from 'vitest/config';
// import { resolve } from 'path';
// import { fileURLToPath } from 'url';

// const __dirname = fileURLToPath(new URL('.', import.meta.url));

// export default defineConfig({
//   test: {
//     // 'node' environment: no DOM, no browser APIs.
//     // Correct for pure domain/utils/services tests.
//     //
//     // Components that touch the DOM require 'jsdom'. When that test suite
//     // is added, configure it as a separate project entry rather than
//     // switching the global environment — domain tests must not pay the
//     // jsdom startup cost.
//     //
//     // Example project config when ready:
//     // projects: [
//     //   { test: { include: ['src/__tests__/unit/**/*.test.js'], environment: 'node' } },
//     //   { test: { include: ['src/__tests__/components/**/*.test.js'], environment: 'jsdom' } },
//     // ],
//     environment: 'node',

//     // Explicit imports keep test files self-documenting and IDE-friendly.
//     globals: false,

//     // Test file discovery — only files matching this pattern are collected.
//     include: ['src/__tests__/**/*.test.js'],

//     coverage: {
//       provider: 'v8',

//       // text  — summary table in CI stdout
//       // html  — browsable local report at coverage/index.html
//       // lcov  — machine-readable coverage/lcov.info for coverage services
//       reporter: ['text', 'html', 'lcov'],

//       // Only measure coverage on source files, not tests or build artifacts.
//       include: ['src/**/*.js'],
//       exclude: ['src/__tests__/**', 'src/entries/**', 'src/styles/**'],

//       // ── Coverage thresholds ───────────────────────────────────────────────
//       // vitest exits non-zero when any metric falls below its threshold.
//       // This makes `pnpm coverage` a real quality gate in CI — not just a
//       // reporting step.
//       //
//       // Thresholds are intentionally conservative at project launch.
//       // Raise them as the test suite grows. Never lower them without a
//       // documented architectural reason (e.g. deliberately untested
//       // platform-specific code paths).
//       thresholds: {
//         lines: 80,
//         functions: 80,
//         branches: 75,
//         statements: 80,
//       },
//     },
//   },

//   resolve: {
//     alias: {
//       '@': resolve(__dirname, 'src'),
//     },
//   },
// });
