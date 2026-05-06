/**
 * @file vite.config.js
 * @description Vite build configuration.
 *
 * ESM NOTE:
 * This project uses "type": "module" in package.json, which means all .js
 * files — including this config — are native ES modules. CommonJS globals
 * (__dirname, __filename, require) do not exist in this context.
 *
 * The correct ESM equivalent for __dirname is:
 *   const __dirname = fileURLToPath(new URL('.', import.meta.url));
 *
 * ENTRY POINTS:
 * The application has two HTML entry points:
 *   - index.html   → the main dashboard SPA
 *   - docs.html    → the static documentation page
 *
 * Both are at project root, which is Vite's default root. No special
 * resolution is needed beyond naming them explicitly in rollupOptions.
 *
 * BROWSER TARGET:
 * build.target declares the minimum browser versions the output must run on.
 * Vite uses this to decide which syntax transforms and polyfills to apply.
 * Without an explicit target, Vite defaults to 'modules' — browsers that
 * support native ES modules — which is broadly correct but undocumented and
 * subject to change across Vite major versions.
 *
 * The declared targets below cover browsers released from roughly 2020–2021
 * and support all APIs this app requires: ES2020 syntax, IndexedDB,
 * dynamic import(), and import.meta. Adjust the list if a different support
 * floor is required.
 *
 * MANUAL CHUNKS:
 * The manualChunks function is a placeholder for future runtime dependencies.
 * This project currently has no runtime dependencies — all packages are
 * devDependencies used only during the build. If a runtime dependency is
 * added (e.g. a charting library), the vendor chunk will activate
 * automatically, allowing browsers to cache it independently of app code.
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  // Base public path — './' ensures assets resolve correctly when the
  // app is served from a subdirectory (e.g. GitHub Pages, nested deployments).
  base: './',

  // ── Path Aliases ──────────────────────────────────────────────────────────
  // '@/' maps to 'src/', eliminating '../../' chains in component imports.
  //
  // Usage in any source file:
  //   import { formatGPA } from '@/utils/formatters.js';
  //   import { Semester }  from '@/domain/Semester.js';
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  // ── Build ─────────────────────────────────────────────────────────────────
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,

    // Explicit browser target — pins the minimum supported environment.
    // ES2020 covers: optional chaining, nullish coalescing, BigInt, Promise.allSettled.
    // The per-browser pins below are the versions that shipped full ES2020
    // support alongside IndexedDB v2, dynamic import(), and import.meta.
    // Update this list if the support floor is deliberately raised or lowered.
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],

    rollupOptions: {
      // Two HTML entry points — one per page.
      input: {
        main: resolve(__dirname, 'index.html'),
        docs: resolve(__dirname, 'docs.html'),
      },

      output: {
        // Placeholder vendor chunk split.
        //
        // This project currently has no runtime dependencies — all packages
        // in package.json are devDependencies and are never bundled into the
        // browser output. This function is a no-op today but activates
        // automatically if a runtime dependency is added, keeping vendor code
        // in a separately cacheable chunk without any further configuration.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },

  // ── Dev Server ────────────────────────────────────────────────────────────
  server: {
    open: true,
    port: 3005,

    // Prevent port collision from failing silently.
    // If 3005 is taken, Vite will error rather than silently increment.
    strictPort: true,
  },
});

// /**
//  * @file vite.config.js
//  * @description Vite build configuration.
//  *
//  * ESM NOTE:
//  * This project uses "type": "module" in package.json, which means all .js
//  * files — including this config — are native ES Modules. CommonJS globals
//  * (__dirname, __filename, require) do not exist in this context.
//  *
//  * The correct ESM equivalent for __dirname is:
//  *   const __dirname = fileURLToPath(new URL('.', import.meta.url));
//  *
//  * ENTRY POINTS:
//  * The application has two HTML entry points:
//  *   - index.html   → the main dashboard SPA
//  *   - docs.html    → the static documentation page
//  *
//  * Both are at project root, which is Vite's default root. No special
//  * resolution is needed beyond naming them explicitly in rollupOptions.
//  */

// import { defineConfig } from 'vite';
// import { resolve } from 'path';
// import { fileURLToPath } from 'url';

// // Derive __dirname equivalent for ESM context.
// // import.meta.url is the file:// URL of this config file.
// // new URL('.', import.meta.url) resolves to the directory containing it.
// // fileURLToPath converts that URL back to a filesystem path string.
// const __dirname = fileURLToPath(new URL('.', import.meta.url));

// export default defineConfig({
//   // Base public path — './' ensures assets resolve correctly when the
//   // app is served from a subdirectory (e.g. GitHub Pages, nested deployments).
//   base: './',

//   // ── Path Aliases ──────────────────────────────────────────────────────────
//   // '@/' maps to 'src/', eliminating '../../' chains in component imports.
//   //
//   // Usage in any source file:
//   //   import { formatGPA } from '@/utils/formatters.js';
//   //   import { Semester }  from '@/domain/Semester.js';
//   //
//   // No other aliases are defined yet. Add here as new top-level src/
//   // directories are introduced.
//   resolve: {
//     alias: {
//       '@': resolve(__dirname, 'src'),
//     },
//   },

//   // ── Build ─────────────────────────────────────────────────────────────────
//   build: {
//     outDir: 'dist',
//     emptyOutDir: true,
//     sourcemap: false,

//     rollupOptions: {
//       // Two real HTML entry points — one per page.
//       // 'calculator.html' has been removed: it does not exist in the project.
//       // If a dedicated calculator page is added in future, register it here.
//       input: {
//         main: resolve(__dirname, 'index.html'),
//         docs: resolve(__dirname, 'docs.html'),
//       },

//       output: {
//         // Separate vendor code from application code.
//         // Browser can cache vendor chunk independently of app changes.
//         manualChunks(id) {
//           if (id.includes('node_modules')) {
//             return 'vendor';
//           }
//         },
//       },
//     },
//   },

//   // ── Dev Server ────────────────────────────────────────────────────────────
//   server: {
//     open: true,
//     port: 3005,

//     // Prevent port collision from failing silently.
//     // If 3005 is taken, Vite will error rather than silently increment.
//     strictPort: true,
//   },
// });
