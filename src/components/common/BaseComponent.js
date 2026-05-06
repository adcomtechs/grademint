/**
 * @module BaseComponent
 * @description Abstract base class defining the component lifecycle.
 *
 * PATTERNS DEMONSTRATED:
 *
 * 1. Abstract Class — `new.target` check throws if BaseComponent itself
 *    is instantiated directly.
 *
 * 2. Template Method Pattern — mount() is the fixed algorithm skeleton:
 *      beforeMount? → render() → afterMount?
 *    Subclasses override the steps, not the sequence.
 *
 * 3. WeakMap for private per-instance state — holds component-local state
 *    without exposing it as a public property.
 *
 * 4. AbortController — cancels all registered event listeners in bulk
 *    on unmount via a single abort() call.
 *
 * 5. Error Boundary — safeRender() wraps render() in a try/catch.
 *    A failed render produces a localised fallback UI inside this.container
 *    rather than propagating an exception that would crash the caller.
 *    The _renderFailed flag prevents re-render loops: once a component
 *    has entered the error state, store subscription updates are ignored
 *    until the component is explicitly remounted.
 */

import { clearElement, showToast } from '../../utils/dom.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('BaseComponent');

/** @type {WeakMap<BaseComponent, Record<string, *>>} */
const _state = new WeakMap();

export class BaseComponent {
  /**
   * @param {Element} container - DOM node this component renders into
   * @param {ReturnType<import('../../core/Store.js').createStore>} store
   */
  constructor(container, store) {
    if (new.target === BaseComponent) {
      throw new TypeError(
        'BaseComponent is abstract. Extend it — do not instantiate it directly.'
      );
    }
    if (!(container instanceof Element)) {
      throw new TypeError(
        `BaseComponent: container must be an Element, got ${typeof container}`
      );
    }

    this.container = container;
    this.store     = store;

    _state.set(this, {});

    /** @type {AbortController} */
    this._ctrl = new AbortController();

    /** @type {Array<() => void>} */
    this._unsubs = [];

    /**
     * Guards against re-render loops after a render failure.
     * Once true, safeRender() becomes a no-op until remount.
     * Reset to false at the start of each mount() call.
     * @type {boolean}
     */
    this._renderFailed = false;
  }

  // ── Local state ───────────────────────────────────────────────────────────

  get localState() {
    return _state.get(this);
  }

  /**
   * Merges a patch into local state and triggers a safe re-render.
   * @param {Record<string, *>} patch
   */
  setState(patch) {
    _state.set(this, { ..._state.get(this), ...patch });
    this.safeRender();
  }

  // ── Event listener management ─────────────────────────────────────────────

  /**
   * Registers a DOM event listener removed automatically on unmount.
   * @param {EventTarget} target
   * @param {string} type
   * @param {EventListenerOrEventListenerObject} listener
   * @param {AddEventListenerOptions} [opts]
   */
  addListener(target, type, listener, opts = {}) {
    target.addEventListener(type, listener, { ...opts, signal: this._ctrl.signal });
  }

  /**
   * Registers a store subscription cleaned up on unmount.
   * @param {() => void} unsubFn
   */
  addSubscription(unsubFn) {
    this._unsubs.push(unsubFn);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** @abstract — subclasses MUST implement render() */
  render() {
    throw new Error(`${this.constructor.name} must implement render()`);
  }

  /**
   * Safe render — wraps render() in an error boundary.
   *
   * Called by:
   *   - mount()                  (initial render)
   *   - setState()               (local state updates)
   *   - store subscribers        (global state updates, via afterMount hooks)
   *
   * If render() throws:
   *   1. _renderFailed is set to true — prevents further re-render attempts
   *   2. A fallback error UI replaces the component's container content
   *   3. A toast notifies the user that part of the UI failed
   *   4. The error is logged with component context for debugging
   *
   * If _renderFailed is already true, safeRender() is a no-op.
   * The component stays in its error state until explicitly remounted.
   *
   * @param {'mount' | 'update'} [phase='update'] - lifecycle phase label for logging
   */
  safeRender(phase = 'update') {
    if (this._renderFailed) return;

    try {
      this.render();
    } catch (err) {
      this._handleRenderError(err, phase);
    }
  }

  /**
   * Template Method: mount sequence.
   * Subclasses hook in via beforeMount() and afterMount().
   *
   * Each mount() call resets _renderFailed, allowing a component that
   * previously errored to recover if the underlying issue has been resolved
   * (e.g. the store now contains valid data after a user action).
   */
  mount() {
    // Reset error state — a fresh mount is a fresh start.
    this._renderFailed = false;

    try {
      this.beforeMount?.();
      this.render();
      this.afterMount?.();
    } catch (err) {
      this._handleRenderError(err, 'mount');
    }
  }

  /**
   * Tears down the component cleanly.
   */
  unmount() {
    this._ctrl.abort();
    this._unsubs.forEach((fn) => fn());
    this._unsubs = [];
    clearElement(this.container);
  }

  // ── Error boundary ────────────────────────────────────────────────────────

  /**
   * Handles a render failure by:
   *   1. Marking the component as failed (prevents re-render loops)
   *   2. Logging the error with full context
   *   3. Rendering a localised fallback UI into this.container
   *   4. Emitting a user-visible toast notification
   *
   * The fallback UI is intentionally minimal — it communicates failure
   * without introducing new dependencies that could themselves throw.
   * It uses only direct DOM API calls (no createElement from dom.js)
   * to eliminate any risk of a secondary failure in the error handler.
   *
   * @param {Error}  err   - The caught error
   * @param {string} phase - 'mount' | 'update' — where the failure occurred
   */
  _handleRenderError(err, phase) {
    this._renderFailed = true;

    // ── 1. Log with context ──────────────────────────────────────────────────
    // console.error(
    //   `[${this.constructor.name}] Render failed during "${phase}":`,
    //   err
    // );
    log.error(`Render failed during "${phase}" in ${this.constructor.name}`, err, {
      component: this.constructor.name,
      phase,
    });

    // ── 2. Fallback UI ───────────────────────────────────────────────────────
    // Deliberately avoids importing createElement or any utility that could
    // itself throw. Direct DOM API only.
    try {
      clearElement(this.container);

      const wrapper = document.createElement('div');
      wrapper.className = 'component-error-boundary';
      wrapper.setAttribute('role', 'alert');
      wrapper.setAttribute('aria-live', 'assertive');

      const icon = document.createElement('span');
      icon.className = 'component-error-icon';
      icon.textContent = '⚠';
      icon.setAttribute('aria-hidden', 'true');

      const message = document.createElement('p');
      message.className = 'component-error-message';
      message.textContent = 'This section could not be displayed.';

      const detail = document.createElement('p');
      detail.className = 'component-error-detail';
      // Only expose error details in non-production environments.
      // In production, the technical detail is logged but not shown to users.
      detail.textContent =
        import.meta.env?.DEV === true
          ? `${this.constructor.name}: ${err?.message ?? String(err)}`
          : 'Reload the page or clear your data if this persists.';

      wrapper.append(icon, message, detail);
      this.container.appendChild(wrapper);
    } catch (fallbackErr) {
      // The fallback itself failed — log and do nothing further.
      // The container may be in a broken state but the app keeps running.
     log.error(`Fallback UI render failed in ${this.constructor.name}`, fallbackErr, {
       component: this.constructor.name,
     });
    }

    // ── 3. Toast notification ────────────────────────────────────────────────
    // Wrapped in try/catch — a toast failure must never mask the original error.
    try {
      showToast(
        `A UI section failed to render (${this.constructor.name}). ` +
        `The rest of the application is unaffected.`,
        'error',
        6000
      );
    } catch {
      // Toast system unavailable — already logged above.
    }
  }
}