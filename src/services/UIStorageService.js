/**
 * @module UIStorageService
 * @description Thin localStorage wrapper for UI-only preferences.
 *
 * WHY localStorage and NOT IndexedDB for UI state?
 * - UI preferences (active tab, scroll position) are tiny and transient
 * - They don't need async — we want them synchronously on page load to prevent
 *   a flash of wrong state (e.g., wrong tab selected for a moment)
 * - Losing UI prefs on storage clear is acceptable; losing academic data is not
 *
 * Separation of concerns:
 *   IndexedDB → academic data (semesters, courses, student profile)
 *   localStorage → UI state (active semester tab, etc.)
 */

export class UIStorageService {
  #prefix;

  constructor(prefix = 'gpa_ui__') {
    this.#prefix = prefix;
  }

  #key(k) {
    return `${this.#prefix}${k}`;
  }

  /** @returns {T} */
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(this.#key(key));
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  set(key, value) {
    try {
      localStorage.setItem(this.#key(key), JSON.stringify(value));
    } catch {
      /* quota */
    }
  }

  remove(key) {
    localStorage.removeItem(this.#key(key));
  }

  has(key) {
    return localStorage.getItem(this.#key(key)) !== null;
  }
}

/** Singleton — shared across both pages */
export const uiStorage = new UIStorageService();
