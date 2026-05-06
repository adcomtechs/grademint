/**
 * @vitest-environment node
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createExportJson,
  createExportPayload,
  normalizeImportedState,
  parseImportJson,
  restoreImportedState,
} from '@/services/DataPortabilityService.js';

function makeState(overrides = {}) {
  return {
    semesters: [
      {
        id: 'sem-1',
        label: '100L First Semester',
        courses: [{ id: 'course-1', code: 'GST 101', title: 'Use of English', creditUnits: 2 }],
        createdAt: 1,
      },
    ],
    activeSemesterId: 'sem-1',
    student: {
      name: 'Ada Okafor',
      matricNo: '2024/001',
      dept: 'Computer Science',
      level: '100 Level',
      session: '2024/2025',
      scaleId: '5.0',
    },
    previousRecord: { creditUnits: 12, qualityPoints: 48 },
    ...overrides,
  };
}

function makeStore() {
  return {
    dispatch: vi.fn(),
  };
}

describe('DataPortabilityService — export', () => {
  it('creates a versioned export envelope', () => {
    const payload = createExportPayload(makeState());

    expect(payload.app).toBe('GPA Pro');
    expect(payload.version).toBe('2.0.0');
    expect(payload.schemaVersion).toBe(1);
    expect(payload.state.student.name).toBe('Ada Okafor');
    expect(new Date(payload.exportedAt).toString()).not.toBe('Invalid Date');
  });

  it('serialises export JSON that can be parsed back into state', () => {
    const json = createExportJson(makeState());
    const restored = parseImportJson(json);

    expect(restored.semesters).toHaveLength(1);
    expect(restored.previousRecord.qualityPoints).toBe(48);
  });
});

describe('DataPortabilityService — import validation', () => {
  it('rejects malformed JSON', () => {
    expect(() => parseImportJson('{bad json')).toThrow('not valid JSON');
  });

  it('rejects imports without a semesters array', () => {
    expect(() => parseImportJson(JSON.stringify({ state: { student: {} } }))).toThrow(
      'semesters array'
    );
  });

  it('normalises missing optional profile fields', () => {
    const state = normalizeImportedState({ semesters: [], student: {}, previousRecord: {} });

    expect(state.student.scaleId).toBe('5.0');
    expect(state.previousRecord.creditUnits).toBe(0);
  });
});

describe('DataPortabilityService — restore recovery', () => {
  it('writes imported data to IDB before hydrating memory', async () => {
    const state = makeState();
    const store = makeStore();
    const idb = {
      isOpen: true,
      syncAllSemesters: vi.fn().mockResolvedValue(undefined),
      putSetting: vi.fn().mockResolvedValue(undefined),
    };

    await restoreImportedState(store, idb, state);

    expect(idb.syncAllSemesters).toHaveBeenCalledWith(state.semesters);
    expect(idb.putSetting).toHaveBeenCalledWith('student', state.student);
    expect(idb.putSetting).toHaveBeenCalledWith('previousRecord', state.previousRecord);
    expect(store.dispatch).toHaveBeenCalledWith({ type: 'HYDRATE', payload: state });
  });

  it('does not hydrate memory when storage restore fails', async () => {
    const store = makeStore();
    const idb = {
      isOpen: true,
      syncAllSemesters: vi.fn().mockRejectedValue(new Error('QuotaExceededError')),
      putSetting: vi.fn(),
    };

    await expect(restoreImportedState(store, idb, makeState())).rejects.toThrow(
      'QuotaExceededError'
    );

    expect(store.dispatch).not.toHaveBeenCalled();
    expect(idb.putSetting).not.toHaveBeenCalled();
  });

  it('supports memory-only restore when IndexedDB is unavailable', async () => {
    const state = makeState();
    const store = makeStore();

    await restoreImportedState(store, null, state);

    expect(store.dispatch).toHaveBeenCalledWith({ type: 'HYDRATE', payload: state });
  });
});
