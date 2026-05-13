/**
 * @module selector
 * @description Declarative state subscription utilities.
 *
 * These utilities decouple the *what* (which state slices a component
 * depends on) from the *how* (the mechanics of detecting changes). Components
 * declare their dependencies as a selector function; the infrastructure
 * handles serialisation, caching, and comparison.
 *
 * DESIGN DECISION — why JSON.stringify for equality?
 *
 * The store's dispatch() passes structuredClone'd objects to subscribers,
 * which means reference equality (===) on nested objects is always false —
 * even when the content is unchanged. Structural equality via JSON.stringify
 * is the correct tool for this store's contract.
 *
 * PERFORMANCE:
 * watchState() serialises only the SELECTED TUPLE (the return value of the
 * selector) and caches the previous serialisation. This means:
 *
 *   - 1 JSON.stringify call per dispatch per subscription (regardless of
 *     how many slices the selector covers)
 *   - 1 string comparison (extremely fast)
 *
 * This replaces the previous pattern of 2N JSON.stringify calls per dispatch
 * (N slices × prev and next) scattered across 6 components.
 */

/**
 * Subscribes to a store and invokes a callback whenever the selected
 * state slice changes.
 *
 * The selector function is called on every state change. Its return value
 * is serialised and compared to the previous serialisation. The callback
 * fires only when the selected value has genuinely changed.
 *
 * USAGE:
 * @example
 * // In afterMount():
 * const unsub = watchState(
 *   this.store,
 *   (s) => [s.semesters, s.student],   // select the slices you care about
 *   () => this.safeRender()            // called only when they change
 * );
 * this.addSubscription(unsub);
 *
 * @template T
 * @param {ReturnType<import('../core/Store.js').createStore>} store
 *   The application store returned by createStore().
 *
 * @param {(state: object) => T} selector
 *   Pure function that extracts the relevant state slice(s).
 *   Return a primitive for a single slice, or an array/object for multiple.
 *   Must be free of side effects — it is called on every state change.
 *
 * @param {() => void} callback
 *   Called synchronously when the selected value changes.
 *   Receives no arguments — the component re-reads the store itself
 *   via store.getState() inside its render() if it needs the new values.
 *
 * @returns {() => void} Unsubscribe function — pass to addSubscription().
 */
export function watchState(store, selector, callback) {
  // Establish the baseline — serialise the selected slice at subscription
  // time so the first real change is correctly detected.
  let prevJson = JSON.stringify(selector(store.getState()));

  return store.subscribe(({ state }) => {
    const nextJson = JSON.stringify(selector(state));

    if (nextJson !== prevJson) {
      prevJson = nextJson;
      callback();
    }
  });
}
