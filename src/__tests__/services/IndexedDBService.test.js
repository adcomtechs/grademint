/**
 * @file IndexedDBService.test.js
 * @description Integration tests for IndexedDBService using fake-indexeddb.
 *
 * ISOLATION STRATEGY:
 * Each test receives a completely fresh IDBFactory instance assigned to
 * globalThis.indexedDB. This gives every test its own independent in-memory
 * IDB engine, making the same database name reusable across tests with zero
 * state leakage — and without touching the frozen DB_CONFIG object.
 *
 * WHY NOT vi.spyOn(DB_CONFIG, 'name')?
 * DB_CONFIG is created with Object.freeze(). Frozen properties are
 * non-configurable — Vitest cannot install a getter spy on them.
 * Assigning a fresh IDBFactory per test is the correct isolation mechanism.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDBService } from '@/services/IndexedDBService.js';
import { StorageError } from '@/domain/AppError.js';
import { LoggerConfig, LogLevel } from '@/utils/logger.js';

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Assign a brand-new in-memory IDB engine for every test.
  // Each IDBFactory instance is a fully independent database environment —
  // databases created in one factory are invisible to all others.
  globalThis.indexedDB = new IDBFactory();

  // Silence logger output during tests — errors are expected in guard tests.
  LoggerConfig.setLevel(LogLevel.SILENT);
});

afterEach(() => {
  vi.restoreAllMocks();
  LoggerConfig.reset();
});

// ── Test data factories ───────────────────────────────────────────────────────

let _semCounter = 0;

function makeSem(overrides = {}) {
  const id = `sem-${++_semCounter}`;
  return {
    id,
    label: `Semester ${_semCounter}`,
    courses: [],
    createdAt: Date.now(),
    ...overrides,
  };
}

// ── Helper: open a fresh service ──────────────────────────────────────────────
// Extracted to a function so every test that needs an open IDB gets one
// without repeating the two-line open sequence.

async function openFreshService() {
  const idb = new IndexedDBService();
  await idb.open();
  return idb;
}

// ── open() ────────────────────────────────────────────────────────────────────

describe('IndexedDBService — open()', () => {
  it('opens the database and sets isOpen to true', async () => {
    const idb = await openFreshService();
    expect(idb.isOpen).toBe(true);
  });

  it('creates the semesters object store', async () => {
    const idb = await openFreshService();
    // If the store does not exist, putSemester() throws — success means it exists
    await expect(idb.putSemester(makeSem())).resolves.not.toThrow();
  });

  it('creates the settings object store', async () => {
    const idb = await openFreshService();
    await expect(idb.putSetting('testKey', 'testValue')).resolves.not.toThrow();
  });

  it('returns the instance for chaining', async () => {
    const idb = new IndexedDBService();
    const result = await idb.open();
    expect(result).toBe(idb);
  });

  it('isOpen is false before open() is called', () => {
    const idb = new IndexedDBService();
    expect(idb.isOpen).toBe(false);
  });
});

// ── #requireOpen guard ────────────────────────────────────────────────────────

describe('IndexedDBService — #requireOpen guard', () => {
  it('throws StorageError when syncSemesterDiff() is called before open()', async () => {
    const idb = new IndexedDBService(); // NOT opened
    await expect(
      idb.syncSemesterDiff({ added: [], updated: [], deleted: [] })
    ).rejects.toBeInstanceOf(StorageError);
  });

  it('throws StorageError when getAllSemesters() is called before open()', async () => {
    const idb = new IndexedDBService();
    await expect(idb.getAllSemesters()).rejects.toBeInstanceOf(StorageError);
  });

  it('throws StorageError when getSetting() is called before open()', async () => {
    const idb = new IndexedDBService();
    await expect(idb.getSetting('key')).rejects.toBeInstanceOf(StorageError);
  });

  it('error message includes the calling method name', async () => {
    const idb = new IndexedDBService();
    let caughtError;
    try {
      await idb.putSemester({});
    } catch (err) {
      caughtError = err;
    }
    expect(caughtError).toBeInstanceOf(StorageError);
    expect(caughtError.message).toContain('putSemester');
  });
});

// ── syncSemesterDiff() — additions ───────────────────────────────────────────

describe('IndexedDBService.syncSemesterDiff — additions', () => {
  it('persists a single added semester', async () => {
    const idb = await openFreshService();
    const sem = makeSem();

    await idb.syncSemesterDiff({ added: [sem], updated: [], deleted: [] });

    const all = await idb.getAllSemesters();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(sem.id);
  });

  it('persists multiple added semesters', async () => {
    const idb = await openFreshService();
    const sems = [makeSem(), makeSem(), makeSem()];

    await idb.syncSemesterDiff({ added: sems, updated: [], deleted: [] });

    const all = await idb.getAllSemesters();
    expect(all).toHaveLength(3);
  });

  it('does not disturb existing records when adding new ones', async () => {
    const idb = await openFreshService();
    const existing = makeSem();
    await idb.putSemester(existing);

    const newSem = makeSem();
    await idb.syncSemesterDiff({ added: [newSem], updated: [], deleted: [] });

    const all = await idb.getAllSemesters();
    expect(all).toHaveLength(2);

    const ids = all.map((s) => s.id);
    expect(ids).toContain(existing.id);
    expect(ids).toContain(newSem.id);
  });
});

// ── syncSemesterDiff() — updates ──────────────────────────────────────────────

describe('IndexedDBService.syncSemesterDiff — updates', () => {
  it('overwrites an existing semester record with updated content', async () => {
    const idb = await openFreshService();
    const sem = makeSem({ label: 'Original Label' });
    await idb.putSemester(sem);

    const updated = { ...sem, label: 'Updated Label' };
    await idb.syncSemesterDiff({ added: [], updated: [updated], deleted: [] });

    const all = await idb.getAllSemesters();
    expect(all).toHaveLength(1);
    expect(all[0].label).toBe('Updated Label');
  });

  it('updates only the specified record, leaving others unchanged', async () => {
    const idb = await openFreshService();
    const semA = makeSem({ label: 'A' });
    const semB = makeSem({ label: 'B' });
    await idb.putSemester(semA);
    await idb.putSemester(semB);

    const semAUpdated = { ...semA, label: 'A Updated' };
    await idb.syncSemesterDiff({ added: [], updated: [semAUpdated], deleted: [] });

    const all = await idb.getAllSemesters();
    const bRecord = all.find((s) => s.id === semB.id);
    expect(bRecord.label).toBe('B');
  });
});

// ── syncSemesterDiff() — deletions ────────────────────────────────────────────

describe('IndexedDBService.syncSemesterDiff — deletions', () => {
  it('removes the specified semester by id', async () => {
    const idb = await openFreshService();
    const sem = makeSem();
    await idb.putSemester(sem);

    await idb.syncSemesterDiff({ added: [], updated: [], deleted: [sem.id] });

    const all = await idb.getAllSemesters();
    expect(all).toHaveLength(0);
  });

  it('silently succeeds when deleting a non-existent id', async () => {
    const idb = await openFreshService();
    // IDB delete() is idempotent — deleting a missing key is not an error
    await expect(
      idb.syncSemesterDiff({ added: [], updated: [], deleted: ['ghost-id'] })
    ).resolves.not.toThrow();
  });

  it('removes only the specified semester, leaving others intact', async () => {
    const idb = await openFreshService();
    const semA = makeSem();
    const semB = makeSem();
    await idb.putSemester(semA);
    await idb.putSemester(semB);

    await idb.syncSemesterDiff({ added: [], updated: [], deleted: [semA.id] });

    const all = await idb.getAllSemesters();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(semB.id);
  });
});

// ── syncSemesterDiff() — combined changes ─────────────────────────────────────

describe('IndexedDBService.syncSemesterDiff — combined changes', () => {
  it('handles add + update + delete atomically in one transaction', async () => {
    const idb = await openFreshService();
    const semA = makeSem({ label: 'A' });
    const semB = makeSem({ label: 'B' });
    await idb.putSemester(semA);
    await idb.putSemester(semB);

    const semC = makeSem({ label: 'C' }); // added
    const semAFixed = { ...semA, label: 'A Updated' }; // updated
    // semB → deleted

    await idb.syncSemesterDiff({
      added: [semC],
      updated: [semAFixed],
      deleted: [semB.id],
    });

    const all = await idb.getAllSemesters();
    const ids = all.map((s) => s.id);
    const byId = Object.fromEntries(all.map((s) => [s.id, s]));

    expect(all).toHaveLength(2);
    expect(ids).toContain(semA.id);
    expect(ids).toContain(semC.id);
    expect(ids).not.toContain(semB.id);
    expect(byId[semA.id].label).toBe('A Updated');
    expect(byId[semC.id].label).toBe('C');
  });
});

// ── syncSemesterDiff() — empty diff ───────────────────────────────────────────

describe('IndexedDBService.syncSemesterDiff — empty diff', () => {
  it('resolves without error when all arrays are empty', async () => {
    const idb = await openFreshService();
    await expect(
      idb.syncSemesterDiff({ added: [], updated: [], deleted: [] })
    ).resolves.toBeUndefined();
  });

  it('does not modify existing records when the diff is empty', async () => {
    const idb = await openFreshService();
    const sem = makeSem();
    await idb.putSemester(sem);

    await idb.syncSemesterDiff({ added: [], updated: [], deleted: [] });

    const all = await idb.getAllSemesters();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(sem.id);
  });
});

// ── Settings operations ───────────────────────────────────────────────────────

describe('IndexedDBService — settings', () => {
  it('stores and retrieves a setting by key', async () => {
    const idb = await openFreshService();
    const value = { name: 'Ada Okonkwo', scaleId: '5.0' };
    await idb.putSetting('student', value);

    const retrieved = await idb.getSetting('student');
    expect(retrieved).toEqual(value);
  });

  it('returns null for a key that does not exist', async () => {
    const idb = await openFreshService();
    const result = await idb.getSetting('nonexistent');
    expect(result).toBeNull();
  });

  it('overwrites an existing setting on re-put', async () => {
    const idb = await openFreshService();
    await idb.putSetting('student', { name: 'Original' });
    await idb.putSetting('student', { name: 'Updated' });

    const result = await idb.getSetting('student');
    expect(result.name).toBe('Updated');
  });

  it('deletes a setting by key', async () => {
    const idb = await openFreshService();
    await idb.putSetting('student', { name: 'Alice' });
    await idb.deleteSetting('student');

    const result = await idb.getSetting('student');
    expect(result).toBeNull();
  });

  it('deleteSetting is idempotent for non-existent keys', async () => {
    const idb = await openFreshService();
    await expect(idb.deleteSetting('no-such-key')).resolves.not.toThrow();
  });
});

// ── clearAll() ────────────────────────────────────────────────────────────────

describe('IndexedDBService — clearAll()', () => {
  it('removes all semesters', async () => {
    const idb = await openFreshService();
    await idb.putSemester(makeSem());
    await idb.putSemester(makeSem());

    await idb.clearAll();

    const all = await idb.getAllSemesters();
    expect(all).toHaveLength(0);
  });

  it('removes all settings', async () => {
    const idb = await openFreshService();
    await idb.putSetting('student', { name: 'Alice' });

    await idb.clearAll();

    const result = await idb.getSetting('student');
    expect(result).toBeNull();
  });

  it('clears both stores atomically', async () => {
    const idb = await openFreshService();
    await idb.putSemester(makeSem());
    await idb.putSetting('student', { name: 'Alice' });

    await idb.clearAll();

    const semesters = await idb.getAllSemesters();
    const student = await idb.getSetting('student');

    expect(semesters).toHaveLength(0);
    expect(student).toBeNull();
  });
});

// ── getAllSemesters() ─────────────────────────────────────────────────────────

describe('IndexedDBService — getAllSemesters()', () => {
  it('returns an empty array when the store is empty', async () => {
    const idb = await openFreshService();
    const all = await idb.getAllSemesters();
    expect(all).toEqual([]);
  });

  it('returns all persisted semesters', async () => {
    const idb = await openFreshService();
    const sems = [makeSem(), makeSem(), makeSem()];
    await idb.syncSemesterDiff({ added: sems, updated: [], deleted: [] });

    const all = await idb.getAllSemesters();
    expect(all).toHaveLength(3);
  });
});
