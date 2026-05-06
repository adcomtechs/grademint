/**
 * @module validators
 * @description Pure validation functions — same input, same output, no side effects.
 *
 * DESIGN PHILOSOPHY:
 * Each function returns a ValidationResult object ({ valid: boolean, message: string })
 * rather than throwing. This allows callers to handle validation failures gracefully
 * (showing field errors) rather than catching exceptions.
 *
 * The runValidators() combinator is a higher-order function — it accepts an array of
 * zero-argument functions (thunks) and returns the first failure, or success if all pass.
 * This pattern avoids repetitive if/return chains and makes adding new validators trivial.
 *
 * NEW in this version:
 * - validateGradeKey()  — validates a grade letter against a specific scale
 * - validateInputMode() — validates that the inputMode is one of the allowed values
 * - validateCourseForMode() — validates the combination of fields required by inputMode
 */

import {
  GRADE_SCALES,
  DEFAULT_SCALE_ID,
  INPUT_MODES,
  CREDIT_UNITS,
  MAX_SCORE,
  MIN_SCORE,
} from './constants.js';

/**
 * @typedef {{ valid: boolean, message: string, field?: string }} ValidationResult
 */

// ── Individual Field Validators ──────────────────────────────────────────────

/**
 * Validates a raw percentage score.
 * Accepts string or number; converts internally with Number().
 * @param {*} score
 * @returns {ValidationResult}
 */
export function validateScore(score) {
  const num = Number(score);
  if (score === '' || score === null || score === undefined)
    return { valid: false, message: 'Score is required.' };
  if (!Number.isFinite(num)) return { valid: false, message: 'Score must be a valid number.' };
  if (num < MIN_SCORE || num > MAX_SCORE)
    return { valid: false, message: `Score must be between ${MIN_SCORE} and ${MAX_SCORE}.` };
  return { valid: true, message: '' };
}

/**
 * Validates a course code (e.g. "CSC 201", "MTH 101").
 * @param {*} code
 * @returns {ValidationResult}
 */
export function validateCourseCode(code) {
  if (typeof code !== 'string' || !code.trim())
    return { valid: false, message: 'Course code is required.' };
  if (code.trim().length > 15)
    return { valid: false, message: 'Course code must not exceed 15 characters.' };
  return { valid: true, message: '' };
}

/**
 * Validates a course title (non-empty, max 80 characters).
 * @param {*} title
 * @returns {ValidationResult}
 */
export function validateCourseTitle(title) {
  if (typeof title !== 'string' || !title.trim())
    return { valid: false, message: 'Course title is required.' };
  if (title.trim().length > 80)
    return { valid: false, message: 'Title must not exceed 80 characters.' };
  return { valid: true, message: '' };
}

/**
 * Validates credit units against the allowed set.
 * @param {*} units
 * @returns {ValidationResult}
 */
export function validateCreditUnits(units) {
  if (!CREDIT_UNITS.includes(Number(units)))
    return { valid: false, message: `Units must be one of: ${CREDIT_UNITS.join(', ')}.` };
  return { valid: true, message: '' };
}

/**
 * Validates a semester label.
 * @param {*} label
 * @returns {ValidationResult}
 */
export function validateSemesterLabel(label) {
  if (typeof label !== 'string' || !label.trim())
    return { valid: false, message: 'Semester name is required.' };
  if (label.trim().length > 50)
    return { valid: false, message: 'Name must not exceed 50 characters.' };
  return { valid: true, message: '' };
}

/**
 * Validates a student name.
 * @param {*} name
 * @returns {ValidationResult}
 */
export function validateStudentName(name) {
  if (typeof name !== 'string' || !name.trim())
    return { valid: false, message: 'Name is required.' };
  if (name.trim().length > 60)
    return { valid: false, message: 'Name must not exceed 60 characters.' };
  return { valid: true, message: '' };
}

// ── NEW: Grade Key Validator ─────────────────────────────────────────────────

/**
 * Validates that a grade letter (e.g. 'A', 'B+', 'C') exists in the given scale.
 *
 * This is needed for grade-only and both-input modes where the student picks
 * a grade from a list rather than entering a score.
 *
 * WHY check against the scale?
 * Different scales have different letters (e.g. the 4.0 scale has 'A−', 'B+', etc.
 * while the 5.0 scale has only 'A'–'F'). Hardcoding 'A'–'F' as valid would break
 * the 4.0 scale. By looking up the scale's grades array, we validate against exactly
 * the letters the current scale supports.
 *
 * @param {*}      gradeKey - Grade letter to validate (e.g. 'A', 'B+')
 * @param {string} [scaleId] - The scale to validate against
 * @returns {ValidationResult}
 */
export function validateGradeKey(gradeKey, scaleId = DEFAULT_SCALE_ID) {
  if (typeof gradeKey !== 'string' || !gradeKey.trim())
    return { valid: false, message: 'A grade must be selected.' };

  const scale = GRADE_SCALES[scaleId] ?? GRADE_SCALES[DEFAULT_SCALE_ID];
  const exists = scale.grades.some((g) => g.letter === gradeKey.trim());

  if (!exists) {
    const valid = scale.grades.map((g) => g.letter).join(', ');
    return {
      valid: false,
      message: `"${gradeKey}" is not a valid grade for the ${scale.label}. Valid grades: ${valid}.`,
    };
  }

  return { valid: true, message: '' };
}

// ── NEW: Input Mode Validator ────────────────────────────────────────────────

/**
 * Validates that an inputMode is one of the recognised values.
 *
 * INPUT_MODES is a frozen constant so the valid set never changes at runtime.
 * This validator guards against stale or corrupted data in IndexedDB where
 * an old inputMode value might not match the current INPUT_MODES enum.
 *
 * @param {*} mode
 * @returns {ValidationResult}
 */
export function validateInputMode(mode) {
  const valid = Object.values(INPUT_MODES);
  if (!valid.includes(mode))
    return { valid: false, message: `Input mode must be one of: ${valid.join(', ')}.` };
  return { valid: true, message: '' };
}

// ── NEW: Combined Mode Validator ─────────────────────────────────────────────

/**
 * Validates the combination of fields required for a given inputMode.
 *
 * WHY a combined validator?
 * In 'score' mode, score is required but gradeKey is optional.
 * In 'grade' mode, gradeKey is required but score must be absent or null.
 * In 'both'  mode, both are required.
 *
 * Rather than duplicating this branching logic in CourseForm._submit() and
 * Course constructor, we centralise it here. Callers pass the raw field values;
 * this function checks the right ones based on the mode.
 *
 * @param {{ inputMode: string, score: *, gradeKey: *, scaleId?: string }} fields
 * @returns {ValidationResult}
 */
export function validateCourseForMode({ inputMode, score, gradeKey, scaleId = DEFAULT_SCALE_ID }) {
  switch (inputMode) {
    case INPUT_MODES.SCORE:
      return validateScore(score);

    case INPUT_MODES.GRADE:
      return validateGradeKey(gradeKey, scaleId);

    case INPUT_MODES.BOTH: {
      // Both must be valid; report the first failure
      const scoreResult = validateScore(score);
      if (!scoreResult.valid) return scoreResult;
      return validateGradeKey(gradeKey, scaleId);
    }

    default:
      return { valid: false, message: `Unknown input mode: "${inputMode}".` };
  }
}

// ── Higher-Order Combinator ──────────────────────────────────────────────────

/**
 * Runs a series of validator thunks (zero-argument functions that return
 * ValidationResult) in order, returning the first failure or a success.
 *
 * Using thunks (functions) rather than pre-computed results means validation
 * is lazy — if the first check fails, later checks are never called.
 *
 * @param {...() => ValidationResult} fns
 * @returns {ValidationResult}
 *
 * @example
 * const result = runValidators(
 *   () => validateCourseCode(code),
 *   () => validateCourseTitle(title),
 *   () => validateCreditUnits(creditUnits),
 * );
 */
export function runValidators(...fns) {
  for (const fn of fns) {
    const result = fn();
    if (!result.valid) return result;
  }
  return { valid: true, message: '' };
}
