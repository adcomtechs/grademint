/**
 * @module FormField
 * @description Lightweight base class for form field components.
 *
 * DIFFERENCE FROM BaseComponent:
 * FormField components are store-agnostic. They read their initial state
 * from constructor options, expose getValue() and reset() for the parent
 * form to query, and communicate changes upward via callbacks rather than
 * store subscriptions.
 *
 * LIFECYCLE:
 *   new Field(container, options)  → construct
 *   field.mount()                  → render() + afterMount?()
 *   field.getValue()               → read current value
 *   field.reset()                  → restore to default state
 *   field.unmount()                → abort listeners, clear DOM
 *
 * REMOUNT SAFETY:
 * unmount() recreates the AbortController so mount() can be called again
 * without leaking old listeners. In practice fields are not re-mounted —
 * CourseForm creates them fresh each time — but the safety is cheap.
 */

import { clearElement } from '../../utils/dom.js';

export class FormField {
  /**
   * @param {HTMLElement} container  Element this field renders into
   */
  constructor(container) {
    if (!(container instanceof Element)) {
      throw new TypeError(`FormField: container must be an Element, got ${typeof container}`);
    }
    this.container = container;
    this._ctrl = new AbortController();
  }

  // ── Listener management ────────────────────────────────────────────────────

  /**
   * Registers an event listener tied to this field's AbortController.
   * All listeners registered via this method are removed on unmount().
   *
   * @param {EventTarget}                          target
   * @param {string}                               type
   * @param {EventListenerOrEventListenerObject}   fn
   * @param {AddEventListenerOptions}              [opts]
   */
  addListener(target, type, fn, opts = {}) {
    target.addEventListener(type, fn, { ...opts, signal: this._ctrl.signal });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Renders the field and calls afterMount() if defined.
   * Returns `this` for optional chaining: `container.append(field.mount().container)`.
   * @returns {this}
   */
  mount() {
    this.render();
    this.afterMount?.();
    return this;
  }

  /**
   * Aborts all listeners, resets the controller, and clears the DOM.
   * Safe to call multiple times.
   */
  unmount() {
    this._ctrl.abort();
    this._ctrl = new AbortController(); // ready for potential re-mount
    clearElement(this.container);
  }

  // ── Abstract interface ─────────────────────────────────────────────────────

  /** @abstract — subclasses MUST implement */
  render() {
    throw new Error(`${this.constructor.name} must implement render()`);
  }

  /** @abstract — subclasses MUST implement */
  getValue() {
    throw new Error(`${this.constructor.name} must implement getValue()`);
  }

  /** Optional — override to restore initial/default state */
  reset() {}
}
