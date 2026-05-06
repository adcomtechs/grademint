/**
 * @file GPACalculatorService.test.js
 * @description Unit tests for all static methods on GPACalculatorService.
 *
 * GPACalculatorService is a static utility class with zero DOM or IDB
 * dependencies. Every method is a pure function of its inputs — ideal
 * for exhaustive unit testing with no mocking required.
 *
 * Test structure mirrors the method groups in the source:
 *   1. Core GPA arithmetic
 *   2. Honor classification
 *   3. Analytics / aggregation
 *   4. What-If calculator
 */

import { describe, it, expect } from 'vitest';
import { GPACalculatorService } from '@/services/GPACalculatorService.js';
import { Semester } from '@/domain/Semester.js';
import { Course } from '@/domain/Course.js';

// ── Test data factories ───────────────────────────────────────────────────────
// Pure functions that return plain-object course/semester data.
// Using factories instead of inline literals prevents test-to-test coupling
// and makes it trivial to build varied scenarios.

/**
 * Creates a minimal valid course plain object.
 * @param {Partial<{ score: number, creditUnits: number }>} overrides
 */
function makeCourse(overrides = {}) {
  return {
    code: 'TST 101',
    title: 'Test Course',
    creditUnits: overrides.creditUnits ?? 3,
    score: overrides.score ?? 70,
    inputMode: 'score',
    scaleId: '5.0',
    ...overrides,
  };
}

/**
 * Creates a Semester instance with the given courses.
 * @param {object[]} coursePlainObjects
 * @param {string}   [label]
 */
function makeSemester(coursePlainObjects, label = 'Test Semester') {
  return Semester.fromJSON({
    id: 'test-sem-' + Math.random(),
    label,
    courses: coursePlainObjects,
    createdAt: Date.now(),
  });
}

// ── 1. Core GPA arithmetic ────────────────────────────────────────────────────

describe('GPACalculatorService — semesterGPA', () => {
  it('returns 0 when the course list is empty', () => {
    expect(GPACalculatorService.semesterGPA([])).toBe(0);
  });

  it('computes the weighted average correctly for a single course', () => {
    // A grade (5.0 pts) × 3 CU = 15 QP / 3 CU = 5.00
    const sem = makeSemester([makeCourse({ score: 75, creditUnits: 3 })]);
    expect(GPACalculatorService.semesterGPA(sem.courses)).toBe(5);
  });

  it('weights heavier courses more than lighter ones', () => {
    // Course A: 3 CU, score 70 → A (5.0) → 15 QP
    // Course B: 1 CU, score 40 → E (1.0) →  1 QP
    // Total: 16 QP / 4 CU = 4.00
    const sem = makeSemester([
      makeCourse({ score: 70, creditUnits: 3 }),
      makeCourse({ score: 40, creditUnits: 1 }),
    ]);
    expect(GPACalculatorService.semesterGPA(sem.courses)).toBe(4);
  });

  it('produces 0 GPA when all courses are failed', () => {
    const sem = makeSemester([
      makeCourse({ score: 0, creditUnits: 3 }),
      makeCourse({ score: 10, creditUnits: 2 }),
    ]);
    expect(GPACalculatorService.semesterGPA(sem.courses)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GPACalculatorService — cumulativeGPA', () => {
  it('returns 0 with no semesters', () => {
    expect(GPACalculatorService.cumulativeGPA([])).toBe(0);
  });

  it('equals semesterGPA when there is only one semester', () => {
    const sem = makeSemester([makeCourse({ score: 70, creditUnits: 3 })]);
    expect(GPACalculatorService.cumulativeGPA([sem])).toBe(
      GPACalculatorService.semesterGPA(sem.courses)
    );
  });

  it('correctly accumulates quality points across multiple semesters', () => {
    // Sem 1: 3 CU, all A (5.0) → 15 QP
    // Sem 2: 3 CU, all C (3.0) → 9 QP
    // CGPA: 24 QP / 6 CU = 4.00
    const sem1 = makeSemester([makeCourse({ score: 75, creditUnits: 3 })]);
    const sem2 = makeSemester([makeCourse({ score: 55, creditUnits: 3 })]);
    expect(GPACalculatorService.cumulativeGPA([sem1, sem2])).toBe(4);
  });

  it('is not thrown off by empty semesters with no courses', () => {
    const sem1 = makeSemester([makeCourse({ score: 75, creditUnits: 3 })]);
    const emptySem = makeSemester([]);
    // Empty semester contributes 0 CU and 0 QP — should not affect result
    expect(GPACalculatorService.cumulativeGPA([sem1, emptySem])).toBe(
      GPACalculatorService.cumulativeGPA([sem1])
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GPACalculatorService — cgpaWithPreviousRecord', () => {
  it('equals cumulativeGPA when previousRecord is null', () => {
    const sem = makeSemester([makeCourse({ score: 70, creditUnits: 3 })]);
    expect(GPACalculatorService.cgpaWithPreviousRecord([sem], null)).toBe(
      GPACalculatorService.cumulativeGPA([sem])
    );
  });

  it('equals cumulativeGPA when previousRecord has zero credit units', () => {
    const sem = makeSemester([makeCourse({ score: 70, creditUnits: 3 })]);
    const prev = { creditUnits: 0, qualityPoints: 0 };
    expect(GPACalculatorService.cgpaWithPreviousRecord([sem], prev)).toBe(
      GPACalculatorService.cumulativeGPA([sem])
    );
  });

  it('correctly merges previous institutional record into the CGPA', () => {
    // Previous: 45 CU at 3.80 CGPA → 171 QP
    // Current:  3 CU, all A (5.0) → 15 QP
    // Combined: 186 QP / 48 CU ≈ 3.875
    const sem = makeSemester([makeCourse({ score: 75, creditUnits: 3 })]);
    const prev = { creditUnits: 45, qualityPoints: 171 };
    const result = GPACalculatorService.cgpaWithPreviousRecord([sem], prev);
    expect(result).toBeCloseTo(186 / 48, 5);
  });

  it('returns 0 when there are no semesters and previousRecord is null', () => {
    expect(GPACalculatorService.cgpaWithPreviousRecord([], null)).toBe(0);
  });
});

// ── 2. Honor classification ───────────────────────────────────────────────────

describe('GPACalculatorService — getHonorClassification (5.0 scale)', () => {
  const cases = [
    { cgpa: 5.0, expected: 'First Class' },
    { cgpa: 4.5, expected: 'First Class' },
    { cgpa: 4.49, expected: 'Second Class Upper' },
    { cgpa: 3.5, expected: 'Second Class Upper' },
    { cgpa: 3.49, expected: 'Second Class Lower' },
    { cgpa: 2.4, expected: 'Second Class Lower' },
    { cgpa: 2.39, expected: 'Third Class' },
    { cgpa: 1.5, expected: 'Third Class' },
    { cgpa: 1.49, expected: 'Pass' },
    { cgpa: 1.0, expected: 'Pass' },
    { cgpa: 0.99, expected: 'Fail' },
    { cgpa: 0.0, expected: 'Fail' },
  ];

  cases.forEach(({ cgpa, expected }) => {
    it(`classifies CGPA ${cgpa.toFixed(2)} as "${expected}"`, () => {
      const honor = GPACalculatorService.getHonorClassification(cgpa, '5.0');
      expect(honor?.label).toBe(expected);
    });
  });

  it('returns a non-null result for every value in [0, 5]', () => {
    // Boundary exhaustion — no GPA value on the 5.0 scale should produce null
    for (let cgpa = 0; cgpa <= 5.0; cgpa += 0.1) {
      expect(GPACalculatorService.getHonorClassification(cgpa, '5.0')).not.toBeNull();
    }
  });
});

// ── 3. Analytics / aggregation ────────────────────────────────────────────────

describe('GPACalculatorService — aggregateStats', () => {
  it('returns zeros for an empty semester list', () => {
    const stats = GPACalculatorService.aggregateStats([]);
    expect(stats).toEqual({ semesterCount: 0, totalCU: 0, courseCount: 0 });
  });

  it('counts courses and credit units across all semesters', () => {
    const sem1 = makeSemester([makeCourse({ creditUnits: 3 }), makeCourse({ creditUnits: 2 })]);
    const sem2 = makeSemester([makeCourse({ creditUnits: 4 })]);
    const stats = GPACalculatorService.aggregateStats([sem1, sem2]);
    expect(stats.semesterCount).toBe(2);
    expect(stats.courseCount).toBe(3);
    expect(stats.totalCU).toBe(9);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GPACalculatorService — trendDirection', () => {
  it('returns "neutral" with fewer than two semesters that have courses', () => {
    expect(GPACalculatorService.trendDirection([])).toBe('neutral');
    const oneSem = makeSemester([makeCourse({ score: 70 })]);
    expect(GPACalculatorService.trendDirection([oneSem])).toBe('neutral');
  });

  it('returns "up" when the latest semester GPA is meaningfully higher', () => {
    const low = makeSemester([makeCourse({ score: 50 })]); // C → 3.0
    const high = makeSemester([makeCourse({ score: 75 })]); // A → 5.0
    expect(GPACalculatorService.trendDirection([low, high])).toBe('up');
  });

  it('returns "down" when the latest semester GPA is meaningfully lower', () => {
    const high = makeSemester([makeCourse({ score: 75 })]); // A → 5.0
    const low = makeSemester([makeCourse({ score: 50 })]); // C → 3.0
    expect(GPACalculatorService.trendDirection([high, low])).toBe('down');
  });

  it('returns "stable" when the difference is less than 0.05', () => {
    // Both semesters score in the A range → GPA difference is 0
    const sem1 = makeSemester([makeCourse({ score: 72 })]);
    const sem2 = makeSemester([makeCourse({ score: 74 })]);
    expect(GPACalculatorService.trendDirection([sem1, sem2])).toBe('stable');
  });

  it('ignores empty semesters when calculating trend', () => {
    const low = makeSemester([makeCourse({ score: 50 })]);
    const empty = makeSemester([]);
    const high = makeSemester([makeCourse({ score: 75 })]);
    // empty should be skipped; only low and high are compared
    expect(GPACalculatorService.trendDirection([low, empty, high])).toBe('up');
  });
});

// ── 4. What-If calculator ─────────────────────────────────────────────────────

describe('GPACalculatorService — requiredGPAForTarget', () => {
  const base = { currentCGPA: 3.4, currentCU: 60, scaleId: '5.0' };

  it('returns achievable=false when plannedCU is 0 or negative', () => {
    const result = GPACalculatorService.requiredGPAForTarget({
      ...base,
      targetCGPA: 3.5,
      plannedCU: 0,
    });
    expect(result.achievable).toBe(false);
  });

  it('returns achievable=false when targetCGPA exceeds scale maximum', () => {
    const result = GPACalculatorService.requiredGPAForTarget({
      ...base,
      targetCGPA: 5.5,
      plannedCU: 30,
    });
    expect(result.achievable).toBe(false);
  });

  it('marks as achievable when target is already met', () => {
    // Current CGPA 3.40, target 3.00 — already there
    const result = GPACalculatorService.requiredGPAForTarget({
      ...base,
      targetCGPA: 3.0,
      plannedCU: 30,
    });
    expect(result.achievable).toBe(true);
    // expect(result.requiredGPA).toBeLessThanOrEqual(0);
    expect(result.requiredGPA).toBe(0);
  });

  it('returns achievable=false when required GPA exceeds scale max', () => {
    // currentCGPA 1.00, target 4.50, only 1 planned CU — mathematically impossible
    const result = GPACalculatorService.requiredGPAForTarget({
      currentCGPA: 1.0,
      currentCU: 60,
      targetCGPA: 4.5,
      plannedCU: 1,
      scaleId: '5.0',
    });
    expect(result.achievable).toBe(false);
    expect(result.requiredGPA).toBeGreaterThan(5);
  });

  it('computes the correct required GPA for a realistic scenario', () => {
    // currentCGPA 3.40, currentCU 60, target 3.50, plannedCU 60
    // Required QP = 3.50 × 120 − 3.40 × 60 = 420 − 204 = 216
    // Required GPA = 216 / 60 = 3.60
    const result = GPACalculatorService.requiredGPAForTarget({
      ...base,
      targetCGPA: 3.5,
      plannedCU: 60,
    });
    expect(result.achievable).toBe(true);
    expect(result.requiredGPA).toBeCloseTo(3.6, 5);
  });

  // ADD these test suites to the existing file

  describe('GPACalculatorService — computeProjectedCGPA', () => {
    it('returns baseCGPA when scenarios array is empty', () => {
      expect(GPACalculatorService.computeProjectedCGPA(3.5, 60, [])).toBe(3.5);
    });

    it('correctly combines base record with hypothetical scenarios', () => {
      // base: 3.00 CGPA × 60 CU = 180 QP
      // scenario: 5.00 GPA × 15 CU = 75 QP
      // projected: 255 QP / 75 CU = 3.40
      const result = GPACalculatorService.computeProjectedCGPA(3.0, 60, [{ gpa: 5.0, cu: 15 }]);
      expect(result).toBeCloseTo(255 / 75, 5);
    });

    it('handles multiple scenarios additively', () => {
      const result = GPACalculatorService.computeProjectedCGPA(3.0, 60, [
        { gpa: 5.0, cu: 15 },
        { gpa: 5.0, cu: 15 },
      ]);
      expect(result).toBeCloseTo((180 + 75 + 75) / 90, 5);
    });

    it('returns 0 when baseCU and all scenario CU are 0', () => {
      expect(GPACalculatorService.computeProjectedCGPA(0, 0, [])).toBe(0);
    });
  });

  describe('GPACalculatorService — buildProjectionPoints', () => {
    it('returns a baseline point when realSemesters have no courses', () => {
      const emptySem = makeSemester([]);
      const points = GPACalculatorService.buildProjectionPoints([emptySem], [], 3.5, 6);
      expect(points).toHaveLength(1);
      expect(points[0].isHypo).toBe(false);
      expect(points[0].cgpa).toBe(3.5);
      expect(points[0].label).toBe('Current');
    });

    it('marks real semester points as isHypo: false', () => {
      const sem = makeSemester([makeCourse({ score: 75, creditUnits: 3 })]);
      const points = GPACalculatorService.buildProjectionPoints([sem], [], 0, 0);
      expect(points[0].isHypo).toBe(false);
    });

    it('marks hypothetical scenario points as isHypo: true', () => {
      const sem = makeSemester([makeCourse({ score: 75, creditUnits: 3 })]);
      const scenario = { id: 1, label: 'Hypo Sem', gpa: 4.0, cu: 15 };
      const points = GPACalculatorService.buildProjectionPoints([sem], [scenario], 0, 0);
      const hypoPoint = points.find((p) => p.label === 'Hypo Sem');
      expect(hypoPoint?.isHypo).toBe(true);
    });

    it('accumulates running CGPA across real + hypothetical points', () => {
      const sem = makeSemester([makeCourse({ score: 75, creditUnits: 6 })]);
      const scenario = { id: 1, label: 'H1', gpa: 3.0, cu: 6 };
      const points = GPACalculatorService.buildProjectionPoints([sem], [scenario], 0, 0);
      // After real sem: 60 CU, 300 QP, CGPA = 5.00
      // After hypo:    120 CU, 480 QP, CGPA = 4.00
      expect(points[0].cgpa).toBeCloseTo(5.0, 2);
      expect(points[1].cgpa).toBeCloseTo(4.0, 2);
    });
  });
});
