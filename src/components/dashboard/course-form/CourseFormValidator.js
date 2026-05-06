/**
 * @module CourseFormValidator
 * @description Pure validation functions for the course form.
 *
 * No DOM access. No store access. Accepts a snapshot from CourseFormState
 * and returns a structured result — a map of field names to error messages
 * plus a top-level `valid` flag.
 *
 * Keeping validation pure means:
 *   - It can be unit-tested without a DOM environment.
 *   - CourseForm can call it without knowing how validation works internally.
 *   - Error display is a separate concern handled by CourseFormErrorDisplay.
 *
 * VALIDATION RULES:
 *   code        — required, 1–15 chars, alphanumeric + spaces/hyphens
 *   title       — required, 1–80 chars
 *   creditUnits — must be a positive integer in the allowed set
 *   grade data  — at least one of score or overrideGrade must be present
 *   score       — when present: number 0–100
 */

import { validateCourseCode, validateCourseTitle } from '@/utils/validators.js';
import { CREDIT_UNITS } from '@/utils/constants.js';

/**
 * @typedef {{ valid: boolean, errors: Record<string, string> }} ValidationResult
 */

/**
 * Validates a snapshot from CourseFormState.
 *
 * @param {{ code, title, creditUnits, score, overrideGrade }} snapshot
 * @returns {ValidationResult}
 */
export function validateCourseFormSnapshot(snapshot) {
  const errors = {};

  // ── Course code ─────────────────────────────────────────────────────────
  const codeResult = validateCourseCode(snapshot.code?.trim() ?? '');
  if (!codeResult.valid) errors.code = codeResult.message;

  // ── Course title ─────────────────────────────────────────────────────────
  const titleResult = validateCourseTitle(snapshot.title?.trim() ?? '');
  if (!titleResult.valid) errors.title = titleResult.message;

  // ── Credit units ─────────────────────────────────────────────────────────
  if (!CREDIT_UNITS.includes(snapshot.creditUnits)) {
    errors.creditUnits = 'Select a valid credit unit value.';
  }

  // ── Grade data ───────────────────────────────────────────────────────────
  // At least one grading method must be provided.
  const hasScore = snapshot.score !== null && Number.isFinite(snapshot.score);
  const hasOverride = Boolean(snapshot.overrideGrade);

  if (!hasScore && !hasOverride) {
    errors.grade = 'Enter a score or select a grade letter.';
  }

  // ── Score range ──────────────────────────────────────────────────────────
  if (hasScore && (snapshot.score < 0 || snapshot.score > 100)) {
    errors.score = 'Score must be between 0 and 100.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
