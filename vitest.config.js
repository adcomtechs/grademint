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
 * COVERAGE THRESHOLDS:
 * The thresholds block makes `vitest run --coverage` exit with a non-zero
 * code when coverage falls below the declared minimums. Without thresholds,
 * the Coverage CI step always passes regardless of actual coverage, giving
 * a false sense of safety. Adjust values upward as the test suite matures —
 * never downward without a documented justification.
 *
 * REPORTERS:
 * - 'text'  — prints the summary table to stdout (visible in CI logs).
 * - 'html'  — writes a browsable report to coverage/index.html for local
 *              inspection. Not used by CI directly.
 * - 'lcov'  — writes coverage/lcov.info, the standard format consumed by
 *              coverage services (Codecov, Coveralls) and IDE integrations.
 *              Add this to CI artifact uploads if you integrate a service.
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    // 'node' environment: no DOM, no browser APIs.
    // Correct for pure domain/utils/services tests.
    //
    // Components that touch the DOM require 'jsdom'. When that test suite
    // is added, configure it as a separate project entry rather than
    // switching the global environment — domain tests must not pay the
    // jsdom startup cost.
    //
    // Example project config when ready:
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

      // Only measure coverage on source files, not tests or build artifacts.
      include: ['src/**/*.js'],
      exclude: ['src/__tests__/**', 'src/entries/**', 'src/styles/**'],

      // ── Coverage thresholds ───────────────────────────────────────────────
      // vitest exits non-zero when any metric falls below its threshold.
      // This makes `pnpm coverage` a real quality gate in CI — not just a
      // reporting step.
      //
      // Thresholds are intentionally conservative at project launch.
      // Raise them as the test suite grows. Never lower them without a
      // documented architectural reason (e.g. deliberately untested
      // platform-specific code paths).
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
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
//  */

// import { defineConfig } from 'vitest/config';
// import { resolve } from 'path';
// import { fileURLToPath } from 'url';

// const __dirname = fileURLToPath(new URL('.', import.meta.url));

// export default defineConfig({
//   test: {
//     // 'node' environment: no DOM, no browser APIs.
//     // Correct for pure domain/utils/services tests.
//     // Components that touch the DOM will use 'jsdom' in a future suite.
//     environment: 'node',

//     // No globals (describe, it, expect injected automatically).
//     // Explicit imports keep test files self-documenting and IDE-friendly.
//     globals: false,

//     // Test file discovery — only files matching this pattern are collected.
//     include: ['src/__tests__/**/*.test.js'],

//     coverage: {
//       provider: 'v8',
//       reporter: ['text', 'html'],
//       // Only measure coverage on source files — not on test files themselves.
//       include: ['src/**/*.js'],
//       exclude: ['src/__tests__/**', 'src/entries/**', 'src/styles/**'],
//     },
//   },

//   resolve: {
//     alias: {
//       '@': resolve(__dirname, 'src'),
//     },
//   },
// });
