/**
 * @file gpaColors.test.js
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import { gpaColor, gradeLetterColor, gpaDifficulty } from '@/utils/gpaColors.js';

describe('gpaColor', () => {
  it('returns gold for First Class (≥ 4.5)', () => {
    expect(gpaColor(5.0)).toContain('246,211,101');
    expect(gpaColor(4.5)).toContain('246,211,101');
  });

  it('returns green for Second Upper (3.5 – 4.49)', () => {
    expect(gpaColor(4.49)).toContain('168,230,207');
    expect(gpaColor(3.5)).toContain('168,230,207');
  });

  it('returns blue for Second Lower (2.4 – 3.49)', () => {
    expect(gpaColor(3.49)).toContain('116,185,224');
    expect(gpaColor(2.4)).toContain('116,185,224');
  });

  it('returns amber for Third Class (1.5 – 2.39)', () => {
    expect(gpaColor(2.39)).toContain('246,173,85');
    expect(gpaColor(1.5)).toContain('246,173,85');
  });

  it('returns rose for values below 1.5', () => {
    expect(gpaColor(0)).toContain('255,139,148');
    expect(gpaColor(1.49)).toContain('255,139,148');
  });

  it('respects the alpha parameter', () => {
    const result = gpaColor(5.0, 0.5);
    expect(result).toBe('rgba(246,211,101,0.5)');
  });

  it('defaults alpha to 1', () => {
    expect(gpaColor(5.0)).toBe('rgba(246,211,101,1)');
  });
});

describe('gradeLetterColor', () => {
  const cases = [
    ['A', '#f6d365'],
    ['A+', '#f6d365'],
    ['A−', '#f6d365'],
    ['B', '#a8e6cf'],
    ['B+', '#a8e6cf'],
    ['C', '#74b9e0'],
    ['D', '#f6ad55'],
    ['E', '#a0aec0'],
    ['F', '#ff8b94'],
  ];

  cases.forEach(([letter, expected]) => {
    it(`returns correct colour for grade "${letter}"`, () => {
      expect(gradeLetterColor(letter)).toBe(expected);
    });
  });

  it('returns fallback colour for null/undefined', () => {
    expect(gradeLetterColor(null)).toBe('#ff8b94');
    expect(gradeLetterColor(undefined)).toBe('#ff8b94');
  });
});

describe('gpaDifficulty', () => {
  const maxGPA = 5.0;

  it('returns Easy when ratio ≤ 0.60', () => {
    expect(gpaDifficulty(3.0, maxGPA).label).toBe('Easy');
  });

  it('returns Moderate when ratio is 0.61 – 0.75', () => {
    expect(gpaDifficulty(3.5, maxGPA).label).toBe('Moderate');
  });

  it('returns Hard when ratio is 0.76 – 0.88', () => {
    expect(gpaDifficulty(4.2, maxGPA).label).toBe('Hard');
  });

  it('returns Very Hard when ratio is 0.89 – 1.00', () => {
    expect(gpaDifficulty(4.9, maxGPA).label).toBe('Very Hard');
  });

  it('returns Impossible when ratio exceeds 1.00', () => {
    expect(gpaDifficulty(5.5, maxGPA).label).toBe('Impossible');
  });

  it('includes a CSS class string in all results', () => {
    [3.0, 3.5, 4.2, 4.9, 5.5].forEach((gpa) => {
      const result = gpaDifficulty(gpa, maxGPA);
      expect(result.cls).toMatch(/^wi-difficulty--/);
    });
  });
});
