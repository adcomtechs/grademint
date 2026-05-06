/**
 * @file diff.test.js
 * @description Unit tests for the diffSemesters utility.
 *
 * Because diffSemesters is a pure function, every test requires zero
 * mocking. The tests verify the three categories of change independently
 * and in combination.
 */

import { describe, it, expect } from 'vitest';
import { diffSemesters } from '@/utils/diff.js';

// ── Test data ─────────────────────────────────────────────────────────────────

const semA = { id: 'sem-a', label: '100L First', courses: [], createdAt: 1000 };
const semB = { id: 'sem-b', label: '100L Second', courses: [], createdAt: 2000 };
const semC = { id: 'sem-c', label: '200L First', courses: [], createdAt: 3000 };

// ── No changes ────────────────────────────────────────────────────────────────

describe('diffSemesters — no changes', () => {
  it('returns empty arrays when prev and next are identical', () => {
    const result = diffSemesters([semA, semB], [semA, semB]);
    expect(result.added).toHaveLength(0);
    expect(result.updated).toHaveLength(0);
    expect(result.deleted).toHaveLength(0);
  });

  it('returns empty arrays when both prev and next are empty', () => {
    const result = diffSemesters([], []);
    expect(result.added).toHaveLength(0);
    expect(result.updated).toHaveLength(0);
    expect(result.deleted).toHaveLength(0);
  });
});

// ── Additions ─────────────────────────────────────────────────────────────────

describe('diffSemesters — additions', () => {
  it('detects a single added semester', () => {
    const result = diffSemesters([semA], [semA, semB]);
    expect(result.added).toHaveLength(1);
    expect(result.added[0].id).toBe('sem-b');
    expect(result.updated).toHaveLength(0);
    expect(result.deleted).toHaveLength(0);
  });

  it('detects multiple added semesters', () => {
    const result = diffSemesters([], [semA, semB, semC]);
    expect(result.added).toHaveLength(3);
    expect(result.updated).toHaveLength(0);
    expect(result.deleted).toHaveLength(0);
  });
});

// ── Deletions ─────────────────────────────────────────────────────────────────

describe('diffSemesters — deletions', () => {
  it('detects a single deleted semester by id', () => {
    const result = diffSemesters([semA, semB], [semA]);
    expect(result.deleted).toHaveLength(1);
    expect(result.deleted[0]).toBe('sem-b');
    expect(result.added).toHaveLength(0);
    expect(result.updated).toHaveLength(0);
  });

  it('detects all semesters as deleted when next is empty', () => {
    const result = diffSemesters([semA, semB], []);
    expect(result.deleted).toHaveLength(2);
    expect(result.added).toHaveLength(0);
    expect(result.updated).toHaveLength(0);
  });
});

// ── Updates ───────────────────────────────────────────────────────────────────

describe('diffSemesters — updates', () => {
  it('detects a content change in an existing semester', () => {
    const semAModified = { ...semA, label: '100L First Semester (Renamed)' };
    const result = diffSemesters([semA, semB], [semAModified, semB]);
    expect(result.updated).toHaveLength(1);
    expect(result.updated[0].id).toBe('sem-a');
    expect(result.updated[0].label).toBe('100L First Semester (Renamed)');
    expect(result.added).toHaveLength(0);
    expect(result.deleted).toHaveLength(0);
  });

  it('detects a course addition as an update to the containing semester', () => {
    const semAWithCourse = {
      ...semA,
      courses: [
        {
          id: 'c1',
          code: 'MTH 101',
          title: 'Maths',
          creditUnits: 3,
          score: 70,
          gradeKey: null,
          inputMode: 'score',
          scaleId: '5.0',
          createdAt: 999,
        },
      ],
    };
    const result = diffSemesters([semA], [semAWithCourse]);
    expect(result.updated).toHaveLength(1);
    expect(result.updated[0].id).toBe('sem-a');
    expect(result.added).toHaveLength(0);
    expect(result.deleted).toHaveLength(0);
  });

  it('does not flag a semester as updated when its content is identical', () => {
    // Simulate React-style immutable update: new object reference, same content
    const semACopy = JSON.parse(JSON.stringify(semA));
    const result = diffSemesters([semA], [semACopy]);
    expect(result.updated).toHaveLength(0);
  });
});

// ── Combined ──────────────────────────────────────────────────────────────────

describe('diffSemesters — combined changes', () => {
  it('correctly handles add + update + delete in one diff', () => {
    const semAModified = { ...semA, label: 'Updated' };
    // prev: [semA, semB]
    // next: [semAModified (updated), semC (added)]  — semB deleted
    const result = diffSemesters([semA, semB], [semAModified, semC]);

    expect(result.added).toHaveLength(1);
    expect(result.added[0].id).toBe('sem-c');

    expect(result.updated).toHaveLength(1);
    expect(result.updated[0].id).toBe('sem-a');

    expect(result.deleted).toHaveLength(1);
    expect(result.deleted[0]).toBe('sem-b');
  });
});

// ── Performance characteristic ────────────────────────────────────────────────

describe('diffSemesters — unchanged records are not included in any output', () => {
  it('produces empty arrays for 100 identical semesters', () => {
    const semesters = Array.from({ length: 100 }, (_, i) => ({
      id: `sem-${i}`,
      label: `Semester ${i}`,
      courses: [],
      createdAt: i,
    }));
    const result = diffSemesters(semesters, semesters);
    expect(result.added).toHaveLength(0);
    expect(result.updated).toHaveLength(0);
    expect(result.deleted).toHaveLength(0);
  });
});
