/**
 * @module IndexedDBService
 * @description Async repository over the IndexedDB browser API.
 *
 * TRANSACTION STRATEGY:
 *
 * The public API exposes two categories of write operation:
 *
 *   Atomic batch:
 *     syncSemesterDiff()   — commits an entire diff in ONE transaction.
 *                            Used by the persistence middleware in bootstrap.js.
 *                            Guarantees all-or-nothing: no partial writes.
 *
 *   Single-record:
 *     putSemester()        — used during explicit import or migration flows
 *     deleteSemester()     — used during explicit delete flows
 *     putSetting()         — settings are independent, single-record writes
 *     getSetting()         — read-only, always safe
 *
 * The distinction matters: the persistence middleware must be atomic because
 * a state transition is a logical unit. A student adding one course and
 * renaming the semester in the same action should never produce a database
 * where the course was saved but the rename was not.
 *
 * ENCAPSULATION:
 * All transaction management is private. Callers receive resolved Promises
 * or thrown StorageErrors — they never interact with IDBTransaction directly.
 */

import { DB_CONFIG } from '../utils/constants.js';
import { StorageError } from '../domain/AppError.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('IndexedDBService');

export class IndexedDBService {
  /** @type {IDBDatabase|null} */
  #db = null;

  // ── Database lifecycle ──────────────────────────────────────────────────────

  /**
   * Opens (and if needed, upgrades) the IndexedDB database.
   * Must be awaited before any read/write operation.
   *
   * @returns {Promise<this>}
   * @throws {StorageError}
   */
  open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(DB_CONFIG.stores.SEMESTERS)) {
          db.createObjectStore(DB_CONFIG.stores.SEMESTERS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(DB_CONFIG.stores.SETTINGS)) {
          db.createObjectStore(DB_CONFIG.stores.SETTINGS, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.#db = event.target.result;

        this.#db.onversionchange = () => {
          this.#db.close();
          log.warn('Database version changed — page reload required', {
            dbName: DB_CONFIG.name,
          });
        };

        resolve(this);
      };

      request.onerror = (event) => {
        reject(new StorageError(`IndexedDB failed to open: ${event.target.error?.message}`));
      };

      request.onblocked = () => {
        reject(
          new StorageError('IndexedDB open blocked — close other tabs using this app and retry.')
        );
      };
    });
  }

  // ── Atomic batch write ──────────────────────────────────────────────────────

  /**
   * Commits an entire semester diff as a single atomic IDB transaction.
   *
   * This is the PRIMARY write path for the persistence middleware.
   * All operations — puts for added/updated records, deletes for removed
   * records — execute inside one `readwrite` transaction. The IDB engine
   * guarantees that either all operations succeed (oncomplete fires) or
   * none are persisted (onerror/onabort fires and the Promise rejects).
   *
   * EARLY EXIT:
   * If the diff is empty (no records changed), the method returns immediately
   * without opening a transaction. Opening an empty transaction has measurable
   * overhead (~0.5–2ms) and zero benefit — the early exit eliminates it.
   *
   * OPERATION ORDER:
   * Puts are issued before deletes. IDB processes requests within a
   * transaction in issue order, so if a record is somehow both in `updated`
   * and `deleted` (which diffSemesters() prevents, but we defend against
   * here), the delete wins — which is the safer outcome.
   *
   * @param {import('../utils/diff.js').SemesterDiff} diff
   *   The result of diffSemesters(prevState.semesters, state.semesters).
   *
   * @returns {Promise<void>}
   * @throws {StorageError} if the transaction fails or is aborted
   */
  async syncSemesterDiff({ added, updated, deleted }) {
    this.#requireOpen('syncSemesterDiff');

    // Guard: nothing to do — skip the transaction entirely.
    const hasWrites = added.length > 0 || updated.length > 0;
    const hasDeletes = deleted.length > 0;

    if (!hasWrites && !hasDeletes) return;

    log.debug('Syncing semester diff', {
      added: added.length,
      updated: updated.length,
      deleted: deleted.length,
    });

    return new Promise((resolve, reject) => {
      let tx;

      try {
        tx = this.#db.transaction(DB_CONFIG.stores.SEMESTERS, 'readwrite');
      } catch (err) {
        // transaction() can throw synchronously if the store name is wrong
        // or the database is closing. Convert to StorageError immediately.
        reject(new StorageError(`Failed to open sync transaction: ${err.message}`));
        return;
      }

      const store = tx.objectStore(DB_CONFIG.stores.SEMESTERS);

      // ── Issue all put operations ────────────────────────────────────────────
      // put() handles both insert (new key) and update (existing key) — the
      // IDB `put` method is an upsert by design.
      for (const semester of [...added, ...updated]) {
        const req = store.put(semester);

        // Per-request error handler: abort the transaction on any individual
        // failure. The transaction's onerror will then fire with the cause.
        req.onerror = (event) => {
          log.error('put() failed inside syncSemesterDiff', null, {
            semesterId: semester.id,
            idbError: event.target.error?.message,
          });
          // Aborting here triggers tx.onabort, which rejects the Promise.
          tx.abort();
        };
      }

      // ── Issue all delete operations ─────────────────────────────────────────
      // delete() by key. If the key does not exist, IDB silently succeeds —
      // this is correct behaviour (idempotent delete).
      for (const id of deleted) {
        const req = store.delete(id);

        req.onerror = (event) => {
          log.error('delete() failed inside syncSemesterDiff', null, {
            semesterId: id,
            idbError: event.target.error?.message,
          });
          tx.abort();
        };
      }

      // ── Transaction lifecycle handlers ──────────────────────────────────────

      tx.oncomplete = () => {
        log.debug('Semester diff committed', {
          added: added.length,
          updated: updated.length,
          deleted: deleted.length,
        });
        resolve();
      };

      tx.onerror = (event) => {
        // tx.onerror fires when a request error is not handled at the
        // request level and bubbles up, OR when tx.abort() is called
        // after a handled request error. We handle both cases here.
        const message = event.target.error?.message ?? 'Unknown IDB error';
        reject(new StorageError(`Semester sync transaction failed: ${message}`));
      };

      tx.onabort = (event) => {
        // onabort fires when tx.abort() is called explicitly (from a
        // per-request error handler above) or when the browser aborts
        // the transaction (e.g., storage quota exceeded, browser shutdown).
        const message = event.target.error?.message ?? 'Transaction aborted';
        reject(new StorageError(`Semester sync transaction aborted: ${message}`));
      };
    });
  }

  // ── Single-record semester operations ──────────────────────────────────────

  /**
   * Retrieves all semesters as plain objects.
   * @returns {Promise<Object[]>}
   */
  async getAllSemesters() {
    this.#requireOpen('getAllSemesters');
    return this.#promisify(this.#store(DB_CONFIG.stores.SEMESTERS).getAll());
  }

  /**
   * Inserts or updates a single semester record.
   * Used for explicit single-record operations (import, migration).
   * For persistence middleware writes, use syncSemesterDiff() instead.
   *
   * @param {Object} semesterJSON
   * @returns {Promise<void>}
   */
  async putSemester(semesterJSON) {
    this.#requireOpen('putSemester');
    return this.#promisify(this.#store(DB_CONFIG.stores.SEMESTERS, 'readwrite').put(semesterJSON));
  }

  /**
   * Deletes a semester by its ID.
   * Idempotent: deleting a non-existent key succeeds silently.
   *
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deleteSemester(id) {
    this.#requireOpen('deleteSemester');
    return this.#promisify(this.#store(DB_CONFIG.stores.SEMESTERS, 'readwrite').delete(id));
  }

  /**
   * Replaces the entire semesters store atomically.
   * Used only by ResetService — not by the persistence middleware.
   *
   * @param {Object[]} semestersJSON
   * @returns {Promise<void>}
   */
  async syncAllSemesters(semestersJSON) {
    this.#requireOpen('syncAllSemesters');

    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction(DB_CONFIG.stores.SEMESTERS, 'readwrite');
      const store = tx.objectStore(DB_CONFIG.stores.SEMESTERS);

      store.clear();
      semestersJSON.forEach((s) => store.put(s));

      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(new StorageError(e.target.error?.message));
      tx.onabort = (e) =>
        reject(new StorageError(`syncAllSemesters aborted: ${e.target.error?.message}`));
    });
  }

  // ── Settings operations ────────────────────────────────────────────────────

  /**
   * Retrieves a setting by key. Returns null if not found.
   * @param {string} key
   * @returns {Promise<*>}
   */
  async getSetting(key) {
    this.#requireOpen('getSetting');
    const record = await this.#promisify(this.#store(DB_CONFIG.stores.SETTINGS).get(key));
    return record?.value ?? null;
  }

  /**
   * Writes a setting key→value pair.
   * @param {string} key
   * @param {*}      value
   * @returns {Promise<void>}
   */
  async putSetting(key, value) {
    this.#requireOpen('putSetting');
    return this.#promisify(this.#store(DB_CONFIG.stores.SETTINGS, 'readwrite').put({ key, value }));
  }

  /**
   * Deletes a setting by key.
   * @param {string} key
   * @returns {Promise<void>}
   */
  async deleteSetting(key) {
    this.#requireOpen('deleteSetting');
    return this.#promisify(this.#store(DB_CONFIG.stores.SETTINGS, 'readwrite').delete(key));
  }

  // ── Full reset ─────────────────────────────────────────────────────────────

  /**
   * Wipes all data from both object stores in a single atomic transaction.
   * Only called by ResetService.resetApp().
   * @returns {Promise<void>}
   */
  async clearAll() {
    this.#requireOpen('clearAll');

    const stores = Object.values(DB_CONFIG.stores);

    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction(stores, 'readwrite');
      stores.forEach((name) => tx.objectStore(name).clear());

      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(new StorageError(e.target.error?.message));
      tx.onabort = (e) => reject(new StorageError(`clearAll aborted: ${e.target.error?.message}`));
    });
  }

  // ── State accessor ─────────────────────────────────────────────────────────

  /** @returns {boolean} */
  get isOpen() {
    return this.#db !== null;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Wraps an IDBRequest in a Promise.
   * @param {IDBRequest} request
   * @returns {Promise<*>}
   */
  #promisify(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) =>
        reject(new StorageError(e.target.error?.message ?? 'IDB request failed'));
    });
  }

  /**
   * Returns an object store from a new transaction.
   * @param {string}              storeName
   * @param {'readonly'|'readwrite'} [mode='readonly']
   * @returns {IDBObjectStore}
   */
  #store(storeName, mode = 'readonly') {
    return this.#db.transaction(storeName, mode).objectStore(storeName);
  }

  /**
   * Asserts that the database is open before any operation.
   * Throws a StorageError with the calling method's name if not.
   *
   * Centralises what was previously a repeated inline check across every
   * method — eliminates the risk of forgetting the guard on a new method.
   *
   * @param {string} callerName - Used in the error message for diagnostics
   * @throws {StorageError}
   */
  #requireOpen(callerName) {
    if (!this.#db) {
      throw new StorageError(
        `IndexedDBService.${callerName}() called before open() completed. ` +
          `Ensure initApp() is awaited before any store operation.`
      );
    }
  }
}
