/**
 * @file selector.test.js
 * @description Unit tests for the watchState() subscription utility.
 *
 * Tests verify:
 *   1. Callback fires when selected state changes
 *   2. Callback does NOT fire when unselected state changes
 *   3. Callback does NOT fire when selected state is structurally identical
 *      but a new object reference (the store's structuredClone behaviour)
 *   4. The unsubscribe function correctly stops the subscription
 *   5. Baseline is established at subscription time (not at first change)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { watchState } from '@/utils/selector.js';

// ── Minimal store stub ────────────────────────────────────────────────────────
// Replicates the store.subscribe() contract without the full Store implementation.

function makeStore(initialState) {
  let state = initialState;
  let listeners = [];

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter((l) => l !== listener);
      };
    },
    // Test helper — simulates a dispatch by updating state and notifying subscribers
    _dispatch(nextState) {
      const prevState = state;
      state = nextState;
      listeners.forEach((l) => l({ state, prevState }));
    },
    _listenerCount: () => listeners.length,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('watchState — callback invocation', () => {
  it('fires the callback when the selected slice changes', () => {
    const store = makeStore({ count: 0, name: 'Alice' });
    const callback = vi.fn();

    watchState(store, (s) => s.count, callback);
    store._dispatch({ count: 1, name: 'Alice' });

    expect(callback).toHaveBeenCalledOnce();
  });

  it('does NOT fire the callback when an unselected slice changes', () => {
    const store = makeStore({ count: 0, name: 'Alice' });
    const callback = vi.fn();

    // Selector only watches 'count' — changing 'name' should not trigger it
    watchState(store, (s) => s.count, callback);
    store._dispatch({ count: 0, name: 'Bob' });

    expect(callback).not.toHaveBeenCalled();
  });

  it('does NOT fire when the selected object is structurally identical (new reference)', () => {
    // Simulates the store's structuredClone behaviour:
    // prevState.semesters !== state.semesters (different reference)
    // but JSON.stringify(both) === JSON.stringify(both) (identical content)
    const semesters = [{ id: 'sem-1', label: 'First', courses: [] }];
    const store = makeStore({ semesters });
    const callback = vi.fn();

    watchState(store, (s) => s.semesters, callback);

    // Dispatch a new reference with identical content
    store._dispatch({ semesters: JSON.parse(JSON.stringify(semesters)) });

    expect(callback).not.toHaveBeenCalled();
  });

  it('fires when a nested property inside the selected slice changes', () => {
    const store = makeStore({ student: { name: 'Alice', scaleId: '5.0' } });
    const callback = vi.fn();

    watchState(store, (s) => s.student, callback);
    store._dispatch({ student: { name: 'Alice', scaleId: '4.0' } });

    expect(callback).toHaveBeenCalledOnce();
  });

  it('fires when any item in a selected tuple changes', () => {
    const store = makeStore({ a: 1, b: 2, c: 3 });
    const callback = vi.fn();

    // Selector returns a tuple of two slices
    watchState(store, (s) => [s.a, s.b], callback);

    // Only 'b' changes — should still fire because it is in the tuple
    store._dispatch({ a: 1, b: 99, c: 3 });

    expect(callback).toHaveBeenCalledOnce();
  });

  it('does NOT fire when none of the tuple items change', () => {
    const store = makeStore({ a: 1, b: 2, c: 3 });
    const callback = vi.fn();

    watchState(store, (s) => [s.a, s.b], callback);

    // Only 'c' changes — not in the tuple
    store._dispatch({ a: 1, b: 2, c: 99 });

    expect(callback).not.toHaveBeenCalled();
  });

  it('fires on each subsequent change, not just the first', () => {
    const store = makeStore({ count: 0 });
    const callback = vi.fn();

    watchState(store, (s) => s.count, callback);
    store._dispatch({ count: 1 });
    store._dispatch({ count: 2 });
    store._dispatch({ count: 3 });

    expect(callback).toHaveBeenCalledTimes(3);
  });
});

// ── Baseline at subscription time ─────────────────────────────────────────────

describe('watchState — baseline behaviour', () => {
  it('does not invoke the callback on subscription (no immediate call)', () => {
    const store = makeStore({ count: 0 });
    const callback = vi.fn();

    watchState(store, (s) => s.count, callback);

    // No dispatch — callback should not have been called yet
    expect(callback).not.toHaveBeenCalled();
  });

  it('uses the state at subscription time as the baseline for comparison', () => {
    const store = makeStore({ count: 5 });
    const callback = vi.fn();

    watchState(store, (s) => s.count, callback);

    // Dispatch the SAME value as the initial state
    store._dispatch({ count: 5 });

    // Baseline was 5, new value is 5 — no change, no callback
    expect(callback).not.toHaveBeenCalled();
  });
});

// ── Unsubscribe ───────────────────────────────────────────────────────────────

describe('watchState — unsubscribe', () => {
  it('returns an unsubscribe function', () => {
    const store = makeStore({ count: 0 });
    const unsub = watchState(store, (s) => s.count, vi.fn());
    expect(typeof unsub).toBe('function');
  });

  it('stops firing the callback after unsubscribe is called', () => {
    const store = makeStore({ count: 0 });
    const callback = vi.fn();

    const unsub = watchState(store, (s) => s.count, callback);

    store._dispatch({ count: 1 }); // fires — subscribed
    unsub();
    store._dispatch({ count: 2 }); // does not fire — unsubscribed

    expect(callback).toHaveBeenCalledOnce();
  });

  it('removes the listener from the store after unsubscribe', () => {
    const store = makeStore({ count: 0 });
    const unsub = watchState(store, (s) => s.count, vi.fn());

    expect(store._listenerCount()).toBe(1);
    unsub();
    expect(store._listenerCount()).toBe(0);
  });
});

// ── Multiple independent subscriptions ───────────────────────────────────────

describe('watchState — multiple subscriptions', () => {
  it('handles multiple independent subscriptions on the same store', () => {
    const store = makeStore({ a: 1, b: 2 });
    const callbackA = vi.fn();
    const callbackB = vi.fn();

    watchState(store, (s) => s.a, callbackA);
    watchState(store, (s) => s.b, callbackB);

    // Only 'a' changes
    store._dispatch({ a: 99, b: 2 });

    expect(callbackA).toHaveBeenCalledOnce();
    expect(callbackB).not.toHaveBeenCalled();
  });

  it('unsubscribing one does not affect the other', () => {
    const store = makeStore({ a: 1, b: 2 });
    const callbackA = vi.fn();
    const callbackB = vi.fn();

    const unsubA = watchState(store, (s) => s.a, callbackA);
    watchState(store, (s) => s.b, callbackB);

    unsubA();
    store._dispatch({ a: 99, b: 99 });

    expect(callbackA).not.toHaveBeenCalled(); // unsubscribed
    expect(callbackB).toHaveBeenCalledOnce(); // still active
  });
});
