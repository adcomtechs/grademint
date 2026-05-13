/**
 * @file BaseComponent.test.js
 * @description Unit tests for the BaseComponent error boundary.
 *
 * Tests use a concrete TestComponent subclass to exercise the base
 * class behaviour without coupling the tests to any real component.
 *
 * Environment: jsdom — required because BaseComponent interacts with
 * the DOM (container element, clearElement, appendChild).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseComponent } from '@/components/common/BaseComponent.js';

// ── Minimal store stub ────────────────────────────────────────────────────────

function makeStore(state = {}) {
  return {
    getState: () => state,
    dispatch: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  };
}

// ── Concrete subclass for testing ─────────────────────────────────────────────

class TestComponent extends BaseComponent {
  constructor(container, store, renderImpl) {
    super(container, store);
    // Allow tests to inject any render implementation.
    this._renderImpl =
      renderImpl ??
      (() => {
        container.innerHTML = '<p class="rendered">OK</p>';
      });
  }

  render() {
    this._renderImpl();
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

let container;
let store;

beforeEach(() => {
  container = document.createElement('div');
  store = makeStore();
  // Reset console.error mock between tests.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ── Successful render ─────────────────────────────────────────────────────────

describe('BaseComponent — successful render', () => {
  it('renders content into the container on mount()', () => {
    const component = new TestComponent(container, store);
    component.mount();
    expect(container.querySelector('.rendered')).not.toBeNull();
  });

  it('does not set _renderFailed after a successful mount', () => {
    const component = new TestComponent(container, store);
    component.mount();
    expect(component._renderFailed).toBe(false);
  });
});

// ── Error boundary — mount phase ──────────────────────────────────────────────

describe('BaseComponent — error boundary during mount', () => {
  it('sets _renderFailed to true when render() throws', () => {
    const component = new TestComponent(container, store, () => {
      throw new Error('render boom');
    });
    component.mount();
    expect(component._renderFailed).toBe(true);
  });

  it('renders the fallback error UI into the container', () => {
    const component = new TestComponent(container, store, () => {
      throw new Error('render boom');
    });
    component.mount();
    expect(container.querySelector('.component-error-boundary')).not.toBeNull();
    expect(container.querySelector('.component-error-message')).not.toBeNull();
  });

  it('logs the error with the component class name', () => {
    const component = new TestComponent(container, store, () => {
      throw new Error('render boom');
    });
    component.mount();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('TestComponent'),
      expect.any(Error)
    );
  });

  it('does not throw — the exception is fully contained', () => {
    const component = new TestComponent(container, store, () => {
      throw new Error('render boom');
    });
    expect(() => component.mount()).not.toThrow();
  });
});

// ── Error boundary — safeRender ───────────────────────────────────────────────

describe('BaseComponent — safeRender()', () => {
  it('is a no-op after _renderFailed is true', () => {
    const component = new TestComponent(container, store, () => {
      throw new Error('render boom');
    });
    component.mount(); // first call sets _renderFailed = true

    // Replace render with a working implementation
    component._renderImpl = () => {
      container.innerHTML = '<p class="recovered">recovered</p>';
    };

    // safeRender should NOT call render because _renderFailed is still true
    component.safeRender();
    expect(container.querySelector('.recovered')).toBeNull();
  });

  it('calls render() normally when _renderFailed is false', () => {
    const component = new TestComponent(container, store);
    component.mount();
    container.innerHTML = ''; // clear it manually

    component.safeRender();
    expect(container.querySelector('.rendered')).not.toBeNull();
  });
});

// ── Error boundary — mount resets error state ─────────────────────────────────

describe('BaseComponent — mount() resets error state', () => {
  it('clears _renderFailed and recovers on subsequent mount()', () => {
    let shouldThrow = true;

    const component = new TestComponent(container, store, () => {
      if (shouldThrow) throw new Error('first render fails');
      container.innerHTML = '<p class="recovered">recovered</p>';
    });

    // First mount — fails
    component.mount();
    expect(component._renderFailed).toBe(true);

    // Fix the underlying issue
    shouldThrow = false;

    // Second mount — should recover
    component.mount();
    expect(component._renderFailed).toBe(false);
    expect(container.querySelector('.recovered')).not.toBeNull();
  });
});

// ── Constructor guards ────────────────────────────────────────────────────────

describe('BaseComponent — constructor guards', () => {
  it('throws when instantiated directly', () => {
    expect(() => new BaseComponent(document.createElement('div'), store)).toThrow(TypeError);
  });

  it('throws when container is not an Element', () => {
    expect(() => new TestComponent('#not-an-element', store)).toThrow(TypeError);
  });
});
