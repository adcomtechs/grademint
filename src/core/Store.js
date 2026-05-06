/**
 * @module Store
 * @description Centralised state management — in-memory store with subscriber notifications.
 *
 * PATTERNS:
 * - Closure — `state` is private; only accessible via the returned API
 * - structuredClone() — deep-clones state for immutable snapshots (no library needed)
 * - Subscriber pattern — subscribe() returns an unsubscribe function (standard cleanup)
 *
 * The store itself is synchronous. IndexedDB persistence is handled externally
 * by subscribing to store changes (see bootstrap.js). This keeps the reducer pure.
 */

import { EventEmitter } from './EventEmitter.js';
import { EVENTS }       from '../utils/constants.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Store');

export function createStore(initialState, reducer) {
  // ── Private state (closure variable) ──────────────────────────────
  let state    = structuredClone(initialState);
  const bus    = new EventEmitter();

  /** Returns a deep-cloned snapshot — callers cannot mutate internal state */
  function getState() { return structuredClone(state); }

  /**
   * Dispatch an action through the reducer.
   * This is the ONLY way to change state.
   * @param {{ type: string, payload?: * }} action
   */
  function dispatch(action) {
    if (!action?.type) {
      // TypeError is appropriate here — invalid usage of the store API
      const err = new TypeError('[Store] dispatch requires an action with `type`.');
      log.error('Invalid dispatch call', err, { action });
      throw err;
    }
    const prev = state;
    state = reducer(structuredClone(state), action);
    if (state !== prev) {
      bus.emit(EVENTS.STATE_CHANGED, {
        state: getState(),
        action,
        prevState: structuredClone(prev),
      });
    }
  }
  /**
   * Subscribe to state changes.
   * Returns an unsubscribe function — store it and call it on component unmount.
   * @param {(payload: { state, action, prevState }) => void} listener
   * @returns {() => void} unsubscribe
   */
  function subscribe(listener) {
    bus.on(EVENTS.STATE_CHANGED, listener);
    return () => bus.off(EVENTS.STATE_CHANGED, listener);
  }

  return { getState, dispatch, subscribe };
}
