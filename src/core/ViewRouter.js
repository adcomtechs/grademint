/**
 * @module ViewRouter
 * @description Lightweight client-side view switcher for single-page navigation.
 *
 * PATTERN — Explicit View Registration:
 * Each view registers itself with an ID and an optional `onActivate` callback.
 * The router never knows what's inside a view — it only manages visibility
 * and delegates rendering concerns back to the owning component.
 *
 * PATTERN — Hash-based URL sync:
 * Uses history.replaceState (not pushState) so navigation within a single
 * page doesn't pollute the browser history stack with phantom entries.
 * The hash is still preserved for bookmarking / refresh.
 *
 * WHY NOT a full routing library?
 * For a two-view academic app, a library adds 40–80 KB of bundle weight
 * for features (nested routes, lazy loading, transitions) we don't need.
 * This module is ~60 lines and covers the exact use case.
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger('ViewRouter');

export class ViewRouter {
  /** @type {Map<string, HTMLElement>} */
  #views = new Map();

  /** @type {{ link: HTMLElement, viewId: string }[]} */
  #navLinks = [];

  /** @type {Map<string, Function>} */
  #onActivate = new Map();

  /** @type {string|null} */
  #current = null;

  // ── Registration ───────────────────────────────────────────────────────────

  /**
   * Register a DOM element as a named view.
   * @param {string} id        Unique view identifier (matches #hash)
   * @param {HTMLElement} el   The root element to show/hide
   * @param {Function} [onActivate]  Called each time this view becomes active
   */
  register(id, el, onActivate = null) {
    this.#views.set(id, el);
    if (typeof onActivate === 'function') this.#onActivate.set(id, onActivate);
  }

  /**
   * Register a nav link that triggers a view transition.
   * Prevents default navigation — the href is only for semantics / SEO.
   * @param {HTMLElement} link
   * @param {string} viewId
   */
  addNavLink(link, viewId) {
    this.#navLinks.push({ link, viewId });
    link.addEventListener('click', (e) => {
      e.preventDefault();
      this.navigate(viewId);
    });
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  /**
   * Activate a view by id.
   * All other registered views are hidden; nav links update aria + class state.
   * @param {string} id
   */
  navigate(id) {
    if (!this.#views.has(id)) {
      log.warn(`Navigation attempted to unknown view: "${id}"`, {
        requestedView: id,
        registeredViews: [...this.#views.keys()],
      });
      return;
    }

    // Show/hide views
    this.#views.forEach((el, key) => {
      el.hidden = key !== id;
    });

    // Sync nav link states
    this.#navLinks.forEach(({ link, viewId }) => {
      const isActive = viewId === id;
      link.classList.toggle('is-active', isActive);
      link.setAttribute('aria-current', isActive ? 'page' : 'false');
    });

    const prev = this.#current;
    this.#current = id;

    // Update URL hash (replaceState — single history entry)
    history.replaceState({ view: id }, '', `#${id}`);

    // Fire the activation hook (e.g. re-draw charts now that canvas is visible)
    this.#onActivate.get(id)?.(prev);
  }

  /**
   * Initialise routing — navigate to the URL hash if valid, else to defaultView.
   * Call this after all views and links have been registered.
   * @param {string} defaultView
   */
  init(defaultView = '') {
    const hash = location.hash.slice(1);
    this.navigate(this.#views.has(hash) ? hash : defaultView);
  }

  /** @returns {string|null} id of the currently active view */
  get current() {
    return this.#current;
  }
}
