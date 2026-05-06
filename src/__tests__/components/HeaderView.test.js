/**
 * @file HeaderView.test.js
 * @description Unit tests for HeaderView.
 *
 * Verifies that the component renders the header shell, synchronises
 * student context, responds to store changes, and cleans up after unmount.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeaderView } from '@/components/layout/HeaderView.js';

// ── Store stub ────────────────────────────────────────────────────────────────

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
    _dispatch(nextState) {
      const prevState = state;
      state = nextState;
      listeners.forEach((l) => l({ state, prevState }));
    },
    _listenerCount: () => listeners.length,
  };
}

// ── DOM setup ─────────────────────────────────────────────────────────────────

function createHeaderElement() {
  const el = document.createElement('header');
  el.id = 'app-header';
  document.body.append(el);
  return el;
}

beforeEach(() => {
  // Clean the document body between tests
  document.body.innerHTML = '';
});

// ── Initial render ────────────────────────────────────────────────────────────

describe('HeaderView — initial render on mount()', () => {
  it('renders brand, SVG logo, nav links, and dashboard actions', () => {
    const el = createHeaderElement();
    const store = makeStore({ student: { name: '' } });

    new HeaderView(el, { store, variant: 'dashboard' }).mount();

    expect(el.querySelector('.brand-name')?.textContent).toBe('GPAPro');
    expect(el.querySelector('svg.brand-mark')).not.toBeNull();
    expect(el.querySelector('a[href="#analytics"][data-view="analytics"]')).not.toBeNull();
    expect(el.querySelector('#btn-export')).not.toBeNull();
    expect(el.querySelector('#btn-settings')).not.toBeNull();
    expect(el.querySelector('#btn-add-semester')).not.toBeNull();
  });

  it('renders docs variant without dashboard actions', () => {
    const el = createHeaderElement();

    new HeaderView(el, { variant: 'docs' }).mount();

    expect(el.querySelector('.header-nav a[href="/"]')?.textContent).toBe('Calculator');
    expect(el.querySelector('.header-nav a[href="/docs.html"]')?.classList.contains('is-active')).toBe(
      true
    );
    expect(el.querySelector('#btn-export')).toBeNull();
  });

  it('sets the student name on mount when a name exists', () => {
    const el = createHeaderElement();
    const store = makeStore({ student: { name: 'Adaeze Obi' } });

    new HeaderView(el, { store }).mount();

    expect(el.querySelector('#header-student-name')?.textContent).toBe('— Adaeze Obi');
  });

  it('sets an empty string when the student name is empty', () => {
    const el = createHeaderElement();
    const store = makeStore({ student: { name: '' } });

    new HeaderView(el, { store }).mount();

    expect(el.querySelector('#header-student-name')?.textContent).toBe('');
  });

  it('sets an empty string when student is null', () => {
    const el = createHeaderElement();
    const store = makeStore({ student: null });

    new HeaderView(el, { store }).mount();

    expect(el.querySelector('#header-student-name')?.textContent).toBe('');
  });
});

// ── Reactive updates ──────────────────────────────────────────────────────────

describe('HeaderView — reactive updates', () => {
  it('updates the header when the student name changes', () => {
    const el = createHeaderElement();
    const store = makeStore({ student: { name: 'Alice' } });

    new HeaderView(el, { store }).mount();
    expect(el.querySelector('#header-student-name')?.textContent).toBe('— Alice');

    store._dispatch({ student: { name: 'Bob' } });
    expect(el.querySelector('#header-student-name')?.textContent).toBe('— Bob');
  });

  it('clears the header when the student name is set to empty', () => {
    const el = createHeaderElement();
    const store = makeStore({ student: { name: 'Alice' } });

    new HeaderView(el, { store }).mount();
    store._dispatch({ student: { name: '' } });

    expect(el.querySelector('#header-student-name')?.textContent).toBe('');
  });

  it('does NOT update when an unrelated state slice changes', () => {
    const el = createHeaderElement();
    const store = makeStore({ student: { name: 'Alice' }, semesters: [] });

    new HeaderView(el, { store }).mount();
    const initialText = el.querySelector('#header-student-name')?.textContent;

    // Change semesters — HeaderView only watches student.name
    store._dispatch({ student: { name: 'Alice' }, semesters: [{ id: 'x' }] });

    expect(el.querySelector('#header-student-name')?.textContent).toBe(initialText);
  });

  it('handles multiple name changes in sequence', () => {
    const el = createHeaderElement();
    const store = makeStore({ student: { name: 'Alice' } });

    new HeaderView(el, { store }).mount();

    store._dispatch({ student: { name: 'Bob' } });
    store._dispatch({ student: { name: 'Charlie' } });
    store._dispatch({ student: { name: '' } });

    expect(el.querySelector('#header-student-name')?.textContent).toBe('');
  });
});

// ── Unmount ───────────────────────────────────────────────────────────────────

describe('HeaderView — unmount()', () => {
  it('stops reacting to store changes after unmount', () => {
    const el = createHeaderElement();
    const store = makeStore({ student: { name: 'Alice' } });

    // const view = new HeaderView(store).mount();
    // mount() returns void — construct separately
    const headerView = new HeaderView(el, { store });
    headerView.mount();

    headerView.unmount();

    store._dispatch({ student: { name: 'Bob' } });

    // After unmount, the DOM should not have been updated
    // Note: the element still shows '— Alice' from the mount-time sync
    expect(el.querySelector('#header-student-name')?.textContent).not.toBe('— Bob');
  });

  it('removes the store subscription on unmount', () => {
    const el = createHeaderElement();
    const store = makeStore({ student: { name: 'Alice' } });
    const headerView = new HeaderView(el, { store });

    headerView.mount();
    const countAfterMount = store._listenerCount();

    headerView.unmount();
    const countAfterUnmount = store._listenerCount();

    expect(countAfterUnmount).toBeLessThan(countAfterMount);
  });

  it('unmount() is safe to call multiple times without throwing', () => {
    const el = createHeaderElement();
    const store = makeStore({ student: { name: 'Alice' } });
    const headerView = new HeaderView(el, { store });

    headerView.mount();

    expect(() => {
      headerView.unmount();
      headerView.unmount(); // second call — should be a no-op
    }).not.toThrow();
  });
});
