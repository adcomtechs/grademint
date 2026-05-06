/**
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetApp } from '@/services/ResetService.js';
import { uiStorage } from '@/services/UIStorageService.js';
import { UI_KEYS } from '@/utils/constants.js';

beforeEach(() => {
  globalThis.localStorage = {
    removeItem: vi.fn(),
    getItem: vi.fn(),
    setItem: vi.fn(),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.localStorage;
});

function makeStore() {
  return { dispatch: vi.fn() };
}

describe('ResetService — recovery', () => {
  it('clears IndexedDB before resetting memory and UI cache', async () => {
    const store = makeStore();
    const idb = { isOpen: true, clearAll: vi.fn().mockResolvedValue(undefined) };

    await resetApp(store, idb);

    expect(idb.clearAll).toHaveBeenCalledOnce();
    expect(store.dispatch).toHaveBeenCalledWith({ type: 'RESET_ALL' });
    expect(localStorage.removeItem).toHaveBeenCalledWith(`gpa_ui__${UI_KEYS.ACTIVE_SEMESTER_ID}`);
  });

  it('does not reset memory if IndexedDB clear fails', async () => {
    const store = makeStore();
    const idb = { isOpen: true, clearAll: vi.fn().mockRejectedValue(new Error('clear failed')) };
    const removeSpy = vi.spyOn(uiStorage, 'remove');

    await expect(resetApp(store, idb)).rejects.toThrow('clear failed');

    expect(store.dispatch).not.toHaveBeenCalled();
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it('resets memory when storage is unavailable', async () => {
    const store = makeStore();

    await resetApp(store, null);

    expect(store.dispatch).toHaveBeenCalledWith({ type: 'RESET_ALL' });
    expect(localStorage.removeItem).toHaveBeenCalledWith(`gpa_ui__${UI_KEYS.ACTIVE_SEMESTER_ID}`);
  });
});
