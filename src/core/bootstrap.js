/**
 * @module bootstrap
 * @description Shared application bootstrap — opens IndexedDB, hydrates the
 * store, and wires the persistence middleware (store → IDB on every change).
 *
 * RESPONSIBILITIES (exactly three):
 *   1. Create the store
 *   2. Open IndexedDB and hydrate the store from persisted data
 *   3. Attach the persistence middleware (store → IDB on state change)
 *
 * EXPLICITLY NOT RESPONSIBLE FOR:
 *   - Any DOM manipulation (moved to HeaderView)
 *   - Mounting components (responsibility of each page entry point)
 *   - Routing (responsibility of ViewRouter)
 */

import { createStore } from './Store.js';
import { reducer, initialState } from './reducer.js';
import { IndexedDBService } from '../services/IndexedDBService.js';
import { showToast } from '../utils/dom.js';
import { diffSemesters } from '../utils/diff.js';
import { createLogger } from '../utils/logger.js';
import { createRetryPolicy, isRetryableIdbError } from '../utils/retry.js';

const log = createLogger('Bootstrap');

/** @type {IndexedDBService | null} */
let _idb = null;

// ADD after the _idb declaration, at module scope.
// The policy is created once and reused for every persistence operation —
// all IDB writes share the same retry configuration.
//
// Configuration rationale:
//   maxAttempts 3  — first attempt + 2 retries. Three attempts covers the
//                    vast majority of transient IDB blips without making
//                    the user wait an unreasonable amount of time.
//   baseDelayMs 150 — 150ms before first retry. Long enough to let a
//                     transient quota spike resolve; short enough to be
//                     imperceptible to the user in the success case.
//   maxDelayMs 3000 — caps the total wait to ~3s even in pathological cases.
//   jitter true     — decorrelates retries when multiple tabs fail together.
//   isRetryable     — uses the IDB-specific predicate that classifies
//                     transient vs permanent errors precisely.

let _retryPersist; // initialised in initApp() after the logger is available

/**
 * Returns the initialised IndexedDBService instance, or null if IDB
 * was unavailable at boot time.
 * @returns {IndexedDBService | null}
 */
export function getIdb() {
  return _idb;
}

/**
 * Initialises the application: creates the store, opens IndexedDB,
 * hydrates persisted state, and attaches the persistence middleware.
 *
 * Does NOT touch the DOM. All DOM concerns belong in components
 * mounted by the page entry point (dashboard.js, docs.js).
 *
 * @returns {Promise<ReturnType<typeof createStore>>}
 */
export async function initApp() {
  // ── 1. Create store ──────────────────────────────────────────────────────
  const store = createStore(initialState, reducer);

  // ── 2. Open IndexedDB ────────────────────────────────────────────────────
  try {
    _idb = new IndexedDBService();
    await _idb.open();
  } catch (err) {
    // console.warn('[Bootstrap] IndexedDB unavailable — running without persistence:', err.message);
    log.warn('IndexedDB unavailable — running without persistence', err);
    showToast('Storage unavailable — data will not persist after reload.', 'warning', 6000);
    return store;
  }

  // ── 3. Hydrate store from IndexedDB ─────────────────────────────────────
  try {
    const [semesters, student, previousRecord] = await Promise.all([
      _idb.getAllSemesters(),
      _idb.getSetting('student'),
      _idb.getSetting('previousRecord'),
    ]);

    const payload = {};
    if (semesters?.length) payload.semesters = semesters;
    if (student) payload.student = student;
    if (previousRecord) payload.previousRecord = previousRecord;

    if (Object.keys(payload).length > 0) {
      store.dispatch({ type: 'HYDRATE', payload });
    }
  } catch (err) {
    // console.error('[Bootstrap] Failed to load data from IndexedDB:', err);
    log.error('Failed to load data from IndexedDB', err);
    showToast('Could not load saved data. Starting fresh.', 'error');
  }

  // ── 4. Build the retry policy (logger is available now) ──────────────────────
  _retryPersist = createRetryPolicy({
    maxAttempts: 3,
    baseDelayMs: 150,
    maxDelayMs: 3_000,
    jitter: true,
    isRetryable: isRetryableIdbError,
    onRetry: (err, attempt, delayMs) => {
      log.warn('IDB write failed — retrying', {
        attempt,
        delayMs,
        error: err.message,
      });
    },
  });

  // ── 5. Persistence middleware ─────────────────────────────────────────────────
  // ── 5. Persistence middleware ─────────────────────────────────────────────────
  store.subscribe(async ({ state, prevState }) => {
    if (!_idb?.isOpen) return;

    try {
      // Semesters — atomic diff-based sync, wrapped in retry policy
      if (state.semesters !== prevState?.semesters) {
        const diff = diffSemesters(prevState?.semesters ?? [], state.semesters);
        await _retryPersist(() => _idb.syncSemesterDiff(diff));
      }

      // Student profile
      if (JSON.stringify(state.student) !== JSON.stringify(prevState?.student)) {
        await _retryPersist(() => _idb.putSetting('student', state.student));
      }

      // Previous record
      if (JSON.stringify(state.previousRecord) !== JSON.stringify(prevState?.previousRecord)) {
        await _retryPersist(() => _idb.putSetting('previousRecord', state.previousRecord));
      }
    } catch (err) {
      // Reaches here only after all retry attempts are exhausted,
      // or for non-retryable errors (immediate re-throw from withRetry).
      log.error('Persistence failed after all retry attempts', err, {
        semesterCount: state.semesters?.length,
      });
      showToast('⚠️ Could not save your changes. Storage may be full.', 'warning');
    }
  });

  return store;
}
