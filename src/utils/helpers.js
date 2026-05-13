/**
 * @module helpers
 * @description Pure helper functions for grade and scale operations.
 *
 * These are extracted from constants.js into their own module because they
 * contain logic (loops, lookups), not just data. The separation follows the
 * Single Responsibility Principle: constants.js holds data, helpers.js holds
 * the functions that operate on that data.
 *
 * All functions are pure:
 *   - Same input always produces the same output
 *   - No side effects (no DOM, no storage, no mutations)
 *   - No dependency on global mutable state
 *
 * Being pure makes them trivially testable and safe to call from anywhere.
 */

import { GRADE_SCALES, DEFAULT_SCALE_ID } from './constants.js';

// ── Scale Lookup ──────────────────────────────────────────────────────────────

/**
 * Returns the GradeScale object for the given scaleId.
 * Falls back to the default scale if the ID is unknown or omitted —
 * this "graceful fallback" prevents crashes when old data uses a
 * scale that was later removed from the registry.
 *
 * @param {string} [scaleId] - e.g. '5.0', '4.0', '7.0'
 * @returns {import('./constants.js').GradeScale}
 */
export function getScale(scaleId = DEFAULT_SCALE_ID) {
  return GRADE_SCALES[scaleId] ?? GRADE_SCALES[DEFAULT_SCALE_ID];
}

// ── Score → Grade ─────────────────────────────────────────────────────────────

/**
 * Converts a numeric score to its grade entry for the given scale.
 *
 * Implementation note: we iterate the grades array in order. Because the
 * first match is returned, the order of grades in each scale definition
 * matters — they must be listed highest-to-lowest (or non-overlapping, as
 * is the case here). If no entry matches (score out of range), we return
 * the fallback grade (last entry, always the failing grade).
 *
 * @param {number|string} score - Raw percentage score (0–100)
 * @param {string}        [scaleId]
 * @returns {{ letter: string, points: number, cssClass: string }}
 */
export function gradeFromScore(score, scaleId = DEFAULT_SCALE_ID) {
  const n = Number(score);
  if (!Number.isFinite(n)) return _fallbackGrade(getScale(scaleId));

  const scale = getScale(scaleId);

  for (const entry of scale.grades) {
    if (n >= entry.minScore && n <= entry.maxScore) {
      return {
        letter: entry.letter,
        points: entry.points,
        cssClass: entry.cssClass,
      };
    }
  }

  // Score is out of range — use the fallback grade (always the last entry)
  return _fallbackGrade(scale);
}

// ── Grade Key → Points ────────────────────────────────────────────────────────

/**
 * Looks up a grade letter in a scale and returns its point value.
 *
 * This is the inverse of gradeFromScore: given the letter ('A', 'B+', etc.)
 * return the numeric points. Used for grade-only input mode where the student
 * knows their grade but not their raw score.
 *
 * Returns null if the letter is not found in the scale — callers should
 * validate with validateGradeKey() before calling this.
 *
 * @param {string} letter  - e.g. 'A', 'B+', 'C'
 * @param {string} [scaleId]
 * @returns {{ letter: string, points: number, cssClass: string } | null}
 */
export function gradeEntryFromLetter(letter, scaleId = DEFAULT_SCALE_ID) {
  const scale = getScale(scaleId);
  const entry = scale.grades.find((g) => g.letter === letter);
  if (!entry) return null;
  return { letter: entry.letter, points: entry.points, cssClass: entry.cssClass };
}

// ── Honor Classification ──────────────────────────────────────────────────────

/**
 * Returns the honor classification entry for a given CGPA on a given scale.
 *
 * The honors array in each scale is sorted descending by `min` value,
 * so we find() the first entry whose minimum threshold the GPA meets.
 * This means a GPA of 4.80 correctly matches "First Class" (min: 4.50)
 * before "Second Class Upper" (min: 3.50).
 *
 * Returns null if no honor classification is applicable (shouldn't normally
 * happen since every scale has a catch-all "Fail" entry at min: 0.0).
 *
 * @param {number} gpa
 * @param {string} [scaleId]
 * @returns {{ label: string, cssClass: string, badge: string } | null}
 */
export function honorFromGPA(gpa, scaleId = DEFAULT_SCALE_ID) {
  const scale = getScale(scaleId);
  return scale.honors.find((h) => gpa >= h.min) ?? null;
}

// ── Available Scales ──────────────────────────────────────────────────────────

/**
 * Returns a summary array of all registered grading scales.
 * Used to populate a <select> or pill-selector in the UI.
 *
 * @returns {{ id: string, label: string, maxGPA: number }[]}
 */
export function getAvailableScales() {
  return Object.values(GRADE_SCALES).map(({ id, label, maxGPA }) => ({ id, label, maxGPA }));
}

/**
 * Returns all grade letters (in order) for a given scale.
 * Used to build the grade-picker UI in CourseForm.
 *
 * @param {string} [scaleId]
 * @returns {{ letter: string, points: number, minScore: number, maxScore: number, cssClass: string }[]}
 */
export function getGradeEntries(scaleId = DEFAULT_SCALE_ID) {
  return [...getScale(scaleId).grades]; // defensive spread — return a copy
}

// ── Private ───────────────────────────────────────────────────────────────────

/**
 * Returns the fallback (lowest/fail) grade entry for a scale.
 * The convention in every scale definition is that the last grade is always F.
 * @param {import('./constants.js').GradeScale} scale
 * @returns {{ letter: string, points: number, cssClass: string }}
 */
function _fallbackGrade(scale) {
  const entry = scale.grades.at(-1);
  return { letter: entry.letter, points: entry.points, cssClass: entry.cssClass };
}
