/**
 * @module ResetService
 * @description Centralised application reset — coordinates the in-memory
 * store reset and the IndexedDB wipe.
 *
 * DEPENDENCY CHANGE (v2):
 * The IndexedDBService instance is no longer imported from bootstrap.js.
 * Importing a service from a core/ module inverted the dependency direction:
 *   services/ → core/  (wrong)
 *
 * The instance is now received as a parameter, which means:
 *   1. ResetService has no dependency on bootstrap.js at all.
 *   2. The caller (ProfileManager, or any future caller) controls which IDB
 *      instance is used — making this function trivially testable with a mock.
 *   3. The dependency direction is correct:
 *      core/ → services/  (bootstrap calls services, not the other way around)
 *
 * @example
 * import { resetApp }  from '@/services/ResetService.js';
 * import { getIdb }    from '@/core/bootstrap.js';
 *
 * await resetApp(store, getIdb());
 */

import { uiStorage } from './UIStorageService.js';
import { UI_KEYS } from '../utils/constants.js';

/**
 * Wipes ALL application data and resets the store to its initial empty state.
 *
 * The sequence matters:
 *  1. IDB first  — if the async clear fails we bail before touching the store,
 *                  so the user still has their data (no silent data loss).
 *  2. Store reset — RESET_ALL returns initialState from the reducer.
 *  3. UI cache   — clear the active semester preference so there is no stale
 *                  ID pointing at a deleted semester on next mount.
 *
 * @param {ReturnType<import('../core/Store.js').createStore>} store
 * @param {import('./IndexedDBService.js').IndexedDBService | null} idb
 *   The live IndexedDBService instance from getIdb(). May be null if IDB
 *   was unavailable at boot — the function handles this gracefully.
 *
 * @throws {Error} Re-throws IDB errors so the caller can show an error toast.
 */
export async function resetApp(store, idb) {
  // Step 1 — persist layer (async, may throw)
  if (idb?.isOpen) {
    await idb.clearAll();
  }

  // Step 2 — in-memory store (synchronous reducer, triggers re-renders)
  store.dispatch({ type: 'RESET_ALL' });

  // Step 3 — localStorage UI cache
  uiStorage.remove(UI_KEYS.ACTIVE_SEMESTER_ID);
}
