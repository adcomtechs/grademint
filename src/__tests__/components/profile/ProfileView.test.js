/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  document.body.innerHTML = '<div id="toast-container"></div>';
  window.scrollTo = vi.fn();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

// ── Minimal store mock ──────────────────────────────────────────────────────

function makeStore(overrides = {}) {
  const state = {
    semesters: [],
    student: { name: '', matricNo: '', dept: '', level: '', session: '', scaleId: '5.0' },
    previousRecord: { creditUnits: 0, qualityPoints: 0 },
    activeSemesterId: null,
    ...overrides,
  };
  const subs = new Set();
  return {
    getState: () => state,
    dispatch: vi.fn(),
    subscribe: (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

// ── ProfileView ─────────────────────────────────────────────────────────────

import { ProfileView } from '@/components/profile/ProfileView.js';

describe('ProfileView', () => {
  let container, store, onSave;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    store = makeStore();
    onSave = vi.fn();
  });

  it('renders the .pv-root wrapper', () => {
    const view = new ProfileView(container, store, { onSave });
    view.mount();
    expect(container.querySelector('.pv-root')).not.toBeNull();
  });

  it('renders the page heading', () => {
    const view = new ProfileView(container, store, { onSave });
    view.mount();
    expect(container.querySelector('.pv-heading-title')?.textContent).toContain(
      'Profile & Settings'
    );
  });

  it('renders three section host containers', () => {
    const view = new ProfileView(container, store);
    view.mount();
    expect(container.querySelectorAll('.pv-section-host').length).toBe(3);
  });

  it('mounts StudentSection into the first host', () => {
    const view = new ProfileView(container, store);
    view.mount();
    // StudentSection renders a .pv-card with a form-group containing the name input
    expect(container.querySelector('#pv-name')).not.toBeNull();
  });

  it('mounts PreviousRecordSection into the second host', () => {
    const view = new ProfileView(container, store);
    view.mount();
    expect(container.querySelector('#pv-prev-cu')).not.toBeNull();
    expect(container.querySelector('#pv-prev-qp')).not.toBeNull();
  });

  it('mounts DangerZoneSection with reset button', () => {
    const view = new ProfileView(container, store);
    view.mount();
    const dangerCard = container.querySelector('.pv-card--danger');
    expect(dangerCard).not.toBeNull();
    expect(dangerCard.querySelector('.btn--danger')?.textContent).toContain('Reset All Data');
  });

  it('unmount() cleans up all sections', () => {
    const view = new ProfileView(container, store);
    view.mount();
    view.unmount();
    expect(container.children.length).toBe(0);
    expect(view._sections).toHaveLength(0);
  });

  it('activate() does not throw when called', () => {
    const view = new ProfileView(container, store);
    view.mount();
    expect(() => view.activate()).not.toThrow();
  });
});

// ── StudentSection ───────────────────────────────────────────────────────────

import { StudentSection } from '@/components/profile/sections/StudentSection.js';

describe('StudentSection', () => {
  let container, store;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    store = makeStore();
  });

  it('pre-fills name input from store', () => {
    store = makeStore({ student: { ...makeStore().getState().student, name: 'Ada Okafor' } });
    const section = new StudentSection(container, store);
    section.mount();
    expect(container.querySelector('#pv-name').value).toBe('Ada Okafor');
  });

  it('shows validation error when name is empty on save', () => {
    const section = new StudentSection(container, store);
    section.mount();
    container.querySelector('#pv-name').value = '';
    container.querySelector('.btn--primary').click();
    expect(container.querySelector('#pv-name-err').textContent).not.toBe('');
    expect(store.dispatch).not.toHaveBeenCalled();
  });

  it('dispatches SET_STUDENT when name is valid', () => {
    const section = new StudentSection(container, store);
    section.mount();
    container.querySelector('#pv-name').value = 'Ada Okafor';
    container.querySelector('.btn--primary').click();
    expect(store.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_STUDENT' }));
  });

  it('renders a scale select with all available scales', () => {
    const section = new StudentSection(container, store);
    section.mount();
    const options = container.querySelectorAll('#pv-scale option');
    expect(options.length).toBeGreaterThanOrEqual(3); // 5.0, 4.0, 7.0
  });
});

// ── PreviousRecordSection ────────────────────────────────────────────────────

import { PreviousRecordSection } from '@/components/profile/sections/PreviousRecordSection.js';

describe('PreviousRecordSection', () => {
  let container, store, onSave;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    store = makeStore();
    onSave = vi.fn();
  });

  it('renders CU and QP inputs', () => {
    const section = new PreviousRecordSection(container, store, { onSave });
    section.mount();
    expect(container.querySelector('#pv-prev-cu')).not.toBeNull();
    expect(container.querySelector('#pv-prev-qp')).not.toBeNull();
  });

  it('shows no Clear button when previousRecord is empty', () => {
    const section = new PreviousRecordSection(container, store, { onSave });
    section.mount();
    const buttons = [...container.querySelectorAll('.btn')];
    const clearBtn = buttons.find((b) => b.textContent.includes('Clear'));
    expect(clearBtn).toBeUndefined();
  });

  it('shows Clear button when previousRecord has data', () => {
    store = makeStore({ previousRecord: { creditUnits: 45, qualityPoints: 171 } });
    const section = new PreviousRecordSection(container, store, { onSave });
    section.mount();
    const buttons = [...container.querySelectorAll('.btn')];
    const clearBtn = buttons.find((b) => b.textContent.includes('Clear'));
    expect(clearBtn).toBeDefined();
  });

  it('dispatches SET_PREVIOUS_RECORD on save with valid numbers', () => {
    const section = new PreviousRecordSection(container, store, { onSave });
    section.mount();
    container.querySelector('#pv-prev-cu').value = '45';
    container.querySelector('#pv-prev-qp').value = '171';
    container.querySelector('.btn--primary').click();
    expect(store.dispatch).toHaveBeenCalledWith({
      type: 'SET_PREVIOUS_RECORD',
      payload: { creditUnits: 45, qualityPoints: 171 },
    });
  });
});
