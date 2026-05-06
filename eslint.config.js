/**
 * @file eslint.config.js
 * @description ESLint flat configuration.
 *
 * THREE RULE CATEGORIES:
 *
 * 1. Code quality (js.configs.recommended + custom rules)
 *    Standard JavaScript rules — unused vars, strict equality, etc.
 *
 * 2. Architectural boundaries (eslint-plugin-boundaries)
 *    Enforces the layer dependency contract from ARCHITECTURE.md §3.
 *    A violation is a lint ERROR, not a warning — boundary violations
 *    are never acceptable and must not be suppressed with eslint-disable
 *    comments without a documented architectural justification.
 *
 * 3. Prettier compatibility (eslint-config-prettier)
 *    Must be last in the config array. Turns off all ESLint rules that
 *    would conflict with Prettier's formatting decisions. Without this,
 *    ESLint and Prettier fight over formatting and both fail in CI.
 *
 * ELEMENT TYPES:
 *    Each src/ subdirectory is declared as a named "element type".
 *    The plugin resolves which type a file belongs to by matching its
 *    path against the `pattern` of each element.
 *
 * ALLOWED IMPORT MATRIX:
 *    Each element declares which other elements it may import from.
 *    Imports not listed in `allow` are lint errors.
 *
 * HOW TO ADD A NEW LAYER:
 *    1. Add an entry to the `elements` array below with a unique `type`
 *       and a `pattern` that matches the new directory.
 *    2. Add the new type to the `allow` arrays of elements that are
 *       permitted to import from it.
 *    3. Add an `allow` entry for the new element listing what it may
 *       import from.
 *    4. Update ARCHITECTURE.md §3 to document the new layer.
 *    5. Run `pnpm lint` to confirm no existing file violates the rules.
 */

import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

// ── Layer definitions ─────────────────────────────────────────────────────────
// Each entry maps a directory pattern to a logical layer name.
// Patterns are relative to the project root; ** matches any depth.

const LAYERS = Object.freeze({
  UTILS: 'utils',
  CONFIG: 'config',
  DOMAIN: 'domain',
  SERVICES: 'services',
  CORE: 'core',
  COMPONENTS: 'components',
  DOCS: 'docs',
  STYLES: 'styles',
  ENTRIES: 'entries',
});

export default [
  // ── 1. Base JS recommendations ──────────────────────────────────────────────
  js.configs.recommended,

  // ── 2. Project-wide settings ────────────────────────────────────────────────
  {
    languageOptions: {
      globals: globals.browser,
    },

    rules: {
      'no-unused-vars': [
        'warn',
        {
          // Underscore-prefixed variables are intentionally unused
          // (e.g. _err in catch blocks where only side effects matter).
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      'no-console': 'off', // console.* is mediated by Logger — allowed in logger.js itself
      eqeqeq: 'error',
      'prefer-const': 'error',

      // Disallow direct console.* calls outside of logger.js and test files.
      // All application logging must go through createLogger().
      //
      // NOTE: This is intentionally a 'warn' and not an 'error'. The rule
      // cannot exempt a single file (logger.js) without a plugin, so we
      // rely on lint:ci --max-warnings 0 to make any warning a CI failure.
      // Any console.* usage outside logger.js will fail CI.
      'no-restricted-syntax': [
        'warn',
        {
          selector: "CallExpression[callee.object.name='console']",
          message:
            'Use createLogger() from @/utils/logger.js instead of console.* directly. ' +
            'See ARCHITECTURE.md §8 — Logging Strategy.',
        },
      ],
    },
  },

  // ── 3. Boundary rules ────────────────────────────────────────────────────────
  {
    plugins: {
      boundaries,
    },

    settings: {
      'boundaries/elements': [
        {
          type: LAYERS.UTILS,
          pattern: 'src/utils/**',
        },
        {
          type: LAYERS.CONFIG,
          pattern: 'src/config/**',
        },
        {
          type: LAYERS.DOMAIN,
          pattern: 'src/domain/**',
        },
        {
          type: LAYERS.SERVICES,
          pattern: 'src/services/**',
        },
        {
          type: LAYERS.CORE,
          pattern: 'src/core/**',
        },
        {
          type: LAYERS.COMPONENTS,
          pattern: 'src/components/**',
        },
        {
          type: LAYERS.DOCS,
          pattern: 'src/docs/**',
        },
        {
          type: LAYERS.STYLES,
          pattern: 'src/styles/**',
        },
        {
          type: LAYERS.ENTRIES,
          pattern: 'src/entries/**',
        },
      ],

      // Resolve the @/ alias so the plugin can classify aliased imports.
      // Without this, `import { X } from '@/utils/logger.js'` appears as
      // an unknown external module and triggers boundaries/no-unknown.
      'import/resolver': {
        alias: {
          map: [['@', './src']],
          extensions: ['.js', '.ts'],
        },
      },
    },

    rules: {
      // ── boundaries/dependencies ─────────────────────────────────────────────
      // The core rule: each element type declares which other types it may
      // import from. Any import not listed in `allow` is an error.
      //
      // Read each entry as:
      //   "Files in [from] are allowed to import files in [allow]"
      //
      // The dependency matrix mirrors ARCHITECTURE.md §3 exactly.
      // If you change this matrix, update ARCHITECTURE.md §3 to match.
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: [
            {
              from: { type: LAYERS.UTILS },
              disallow: { to: { type: '*' } },
            },
            {
              from: { type: LAYERS.CONFIG },
              allow: { to: { type: [LAYERS.UTILS] } },
            },
            {
              from: { type: LAYERS.DOMAIN },
              allow: { to: { type: [LAYERS.CONFIG, LAYERS.UTILS] } },
            },
            {
              from: { type: LAYERS.SERVICES },
              allow: { to: { type: [LAYERS.CONFIG, LAYERS.DOMAIN, LAYERS.UTILS] } },
            },
            {
              from: { type: LAYERS.CORE },
              allow: {
                to: { type: [LAYERS.CONFIG, LAYERS.SERVICES, LAYERS.DOMAIN, LAYERS.UTILS] },
              },
            },
            {
              from: { type: LAYERS.COMPONENTS },
              allow: {
                to: {
                  type: [
                    LAYERS.CONFIG,
                    LAYERS.CORE,
                    LAYERS.SERVICES,
                    LAYERS.DOMAIN,
                    LAYERS.UTILS,
                    LAYERS.STYLES,
                  ],
                },
              },
            },
            {
              from: { type: LAYERS.DOCS },
              allow: { to: { type: [LAYERS.CONFIG, LAYERS.UTILS] } },
            },
            {
              from: { type: LAYERS.STYLES },
              disallow: { to: { type: '*' } },
            },
            {
              from: { type: LAYERS.ENTRIES },
              allow: {
                to: {
                  type: [
                    LAYERS.CONFIG,
                    LAYERS.DOCS,
                    LAYERS.COMPONENTS,
                    LAYERS.CORE,
                    LAYERS.SERVICES,
                    LAYERS.DOMAIN,
                    LAYERS.UTILS,
                  ],
                },
              },
            },
          ],
        },
      ],

      // ── boundaries/no-unknown ───────────────────────────────────────────────
      // Flags imports from paths that don't match any declared element type.
      // This catches typos in import paths and detects new src/ directories
      // that were not registered in the elements array above.
      //
      // Set to 'warn' rather than 'error' because third-party packages
      // (node_modules) and Node built-ins are legitimately "unknown" to the
      // plugin — they are not element types. The warning appears only for
      // unclassified src/ paths.
      'boundaries/no-unknown': 'warn',
    },
  },

  // ── 4. Per-file overrides ────────────────────────────────────────────────────

  // logger.js is the one source file permitted to call console.* directly.
  // It is the implementation behind createLogger() — the rule would be
  // circular if applied here.
  {
    files: ['src/utils/logger.js'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },

  // Test files have relaxed rules:
  //   - boundaries/dependencies is disabled: tests may import from any layer
  //     to set up the subject under test. Enforcing boundaries in tests
  //     would prevent unit tests from importing domain entities directly.
  //   - boundaries/no-unknown is disabled for the same reason.
  //   - no-restricted-syntax is disabled: test helpers may call console.*
  //     directly (e.g. when spying on it with vi.spyOn).
  //   - no-unused-vars is disabled: test spies and stubs are often assigned
  //     but only used for their side effects.
  {
    files: ['src/__tests__/**/*.test.js', 'src/__tests__/**/*.spec.js'],
    rules: {
      'boundaries/dependencies': 'off',
      'boundaries/no-unknown': 'off',
      'no-restricted-syntax': 'off',
      'no-unused-vars': 'off',
    },
  },

  // vite.config.js and vitest.config.js live outside src/ and are not part
  // of the element type system. Boundary and unknown-import rules do not
  // apply to them. no-restricted-syntax is also off: build tool configs
  // may legitimately log to the console.
  {
    files: ['*.config.js', '*.config.mjs'],
    rules: {
      'boundaries/dependencies': 'off',
      'boundaries/no-unknown': 'off',
      'no-restricted-syntax': 'off',
    },
  },

  // ── 5. Prettier compatibility (MUST be last) ─────────────────────────────────
  // Disables all ESLint rules that would conflict with Prettier's formatting.
  // This must be the final entry so it can override any formatting-related
  // rules set in earlier configs. Adding a new config block after this line
  // risks re-enabling a rule that Prettier owns.
  prettierConfig,
];
