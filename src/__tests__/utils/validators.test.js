/**
 * @file validators.test.js
 * @description Unit tests for the validators utility module.
 *
 * Validators are pure functions: (input) → { valid, message }.
 * No mocking required. Tests focus on boundary conditions and
 * the runValidators combinator.
 */

import { describe, it, expect } from 'vitest';
import {
  validateScore,
  validateCourseCode,
  validateCourseTitle,
  validateCreditUnits,
  validateSemesterLabel,
  validateGradeKey,
  validateInputMode,
  runValidators,
} from '@/utils/validators.js';

// ── validateScore ─────────────────────────────────────────────────────────────

describe('validateScore', () => {
  it('accepts valid scores within [0, 100]', () => {
    expect(validateScore(0).valid).toBe(true);
    expect(validateScore(50).valid).toBe(true);
    expect(validateScore(100).valid).toBe(true);
  });

  it('rejects empty, null, and undefined', () => {
    expect(validateScore('').valid).toBe(false);
    expect(validateScore(null).valid).toBe(false);
    expect(validateScore(undefined).valid).toBe(false);
  });

  it('rejects scores below 0', () => {
    expect(validateScore(-1).valid).toBe(false);
  });

  it('rejects scores above 100', () => {
    expect(validateScore(101).valid).toBe(false);
  });

  it('rejects non-numeric strings', () => {
    expect(validateScore('abc').valid).toBe(false);
  });

  it('accepts numeric strings that represent valid scores', () => {
    expect(validateScore('75').valid).toBe(true);
  });
});

// ── validateCourseCode ────────────────────────────────────────────────────────

describe('validateCourseCode', () => {
  it('accepts standard Nigerian course codes', () => {
    expect(validateCourseCode('CSC 201').valid).toBe(true);
    expect(validateCourseCode('MTH101').valid).toBe(true);
  });

  it('rejects empty strings and whitespace-only strings', () => {
    expect(validateCourseCode('').valid).toBe(false);
    expect(validateCourseCode('   ').valid).toBe(false);
  });

  it('rejects codes longer than 15 characters', () => {
    expect(validateCourseCode('A'.repeat(16)).valid).toBe(false);
  });

  it('accepts codes at exactly the 15 character boundary', () => {
    expect(validateCourseCode('A'.repeat(15)).valid).toBe(true);
  });
});

// ── validateCreditUnits ───────────────────────────────────────────────────────

describe('validateCreditUnits', () => {
  it('accepts all values in the CREDIT_UNITS set [1,2,3,4,5,6]', () => {
    [1, 2, 3, 4, 5, 6].forEach((cu) => {
      expect(validateCreditUnits(cu).valid).toBe(true);
    });
  });

  it('rejects values outside the allowed set', () => {
    expect(validateCreditUnits(0).valid).toBe(false);
    expect(validateCreditUnits(7).valid).toBe(false);
    expect(validateCreditUnits(2.5).valid).toBe(false);
  });
});

// ── validateGradeKey ──────────────────────────────────────────────────────────

describe('validateGradeKey', () => {
  it('accepts valid grade letters for the 5.0 scale', () => {
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach((letter) => {
      expect(validateGradeKey(letter, '5.0').valid).toBe(true);
    });
  });

  it('rejects a letter that does not exist in the 5.0 scale', () => {
    expect(validateGradeKey('A+', '5.0').valid).toBe(false);
  });

  it('accepts valid grade letters for the 4.0 scale', () => {
    ['A+', 'A', 'A−', 'B+', 'B', 'F'].forEach((letter) => {
      expect(validateGradeKey(letter, '4.0').valid).toBe(true);
    });
  });

  it('rejects empty and whitespace strings', () => {
    expect(validateGradeKey('', '5.0').valid).toBe(false);
    expect(validateGradeKey('  ', '5.0').valid).toBe(false);
  });
});

// ── validateInputMode ─────────────────────────────────────────────────────────

describe('validateInputMode', () => {
  it('accepts the three valid modes', () => {
    ['score', 'grade', 'both'].forEach((mode) => {
      expect(validateInputMode(mode).valid).toBe(true);
    });
  });

  it('rejects unknown modes', () => {
    expect(validateInputMode('auto').valid).toBe(false);
    expect(validateInputMode('').valid).toBe(false);
  });
});

// ── runValidators ─────────────────────────────────────────────────────────────

describe('runValidators', () => {
  it('returns success when all validators pass', () => {
    const result = runValidators(
      () => ({ valid: true, message: '' }),
      () => ({ valid: true, message: '' })
    );
    expect(result.valid).toBe(true);
  });

  it('returns the first failure and stops evaluating', () => {
    let secondCalled = false;
    const result = runValidators(
      () => ({ valid: false, message: 'first failure' }),
      () => {
        secondCalled = true;
        return { valid: false, message: 'second' };
      }
    );
    expect(result.valid).toBe(false);
    expect(result.message).toBe('first failure');
    expect(secondCalled).toBe(false); // short-circuits on first failure
  });

  it('returns success for an empty validator list', () => {
    expect(runValidators().valid).toBe(true);
  });
});
