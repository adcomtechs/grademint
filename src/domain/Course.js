/**
 * @module Course
 * @description The Course entity model — supports three input modes.
 *
 * ── DUAL-INPUT DESIGN ────────────────────────────────────────────────────────
 *
 * Students don't always have access to both their raw score AND their letter
 * grade. Three real-world scenarios drive this design:
 *
 *   1. Score only — the most common case. Student knows they scored 72/100.
 *      Grade and points are computed automatically from the active scale.
 *
 *   2. Grade only — student received a result slip showing "B" but no score.
 *      This is common for continuous assessment components, external courses,
 *      and transfer credits. The grade is stored directly; no score is needed
 *      to compute quality points.
 *
 *   3. Both — student has both score and grade and they may not match
 *      perfectly (e.g. a score of 69.5 rounds to B by arithmetic, but the
 *      lecturer submitted an A after moderation). In this mode the student
 *      enters both; the explicit gradeKey takes precedence for GPA computation.
 *
 * ── DATA MODEL ───────────────────────────────────────────────────────────────
 *
 *   #score     — number | null  (null when inputMode is 'grade')
 *   #gradeKey  — string | null  (null when inputMode is 'score')
 *   #inputMode — 'score' | 'grade' | 'both'
 *   #scaleId   — which GRADE_SCALE entry to use for grade ↔ points lookup
 *
 * ── GETTER RESOLUTION ────────────────────────────────────────────────────────
 *
 *   get grade():
 *     'score' → computed from score via scale lookup
 *     'grade' → return #gradeKey directly
 *     'both'  → return #gradeKey (the explicit choice overrides the computed value)
 *
 *   get gradePoint():
 *     'score' → points from scale lookup of computed grade
 *     'grade' → points looked up by #gradeKey
 *     'both'  → points looked up by #gradeKey (explicit grade drives GPA)
 *
 * ── IMMUTABILITY ─────────────────────────────────────────────────────────────
 *
 * All private fields are read-only after construction. The `with()` method
 * returns a NEW Course instance with patched fields — it never mutates `this`.
 * This is the same approach used by React state, Redux, and Immer.
 *
 * ── PATTERNS DEMONSTRATED ────────────────────────────────────────────────────
 * - Private class fields (#) — truly private at the language level (ES2022)
 * - Computed getters — grade, gradePoint, qualityPoints derived on access
 * - Static factory method — Course.fromJSON() as a named constructor
 * - Symbol.iterator — makes Course natively iterable (for...of, spread, destructuring)
 * - Immutable update pattern — with() returns a new instance
 * - Defensive toJSON() — explicit field list prevents accidentally serialising
 *   computed getters or internal state
 */

import { DEFAULT_SCALE_ID, INPUT_MODES } from '../utils/constants.js';
import { ValidationError } from './AppError.js';
import {
  runValidators,
  validateCourseTitle,
  validateCourseCode,
  validateCreditUnits,
  validateCourseForMode,
  validateInputMode,
} from '../utils/validators.js';
import { gradeFromScore, gradeEntryFromLetter } from '../utils/helpers.js';

export class Course {
  // ── Private fields ─────────────────────────────────────────────────────────

  /** @type {string} */ #id;
  /** @type {string} */ #code;
  /** @type {string} */ #title;
  /** @type {number} */ #creditUnits;

  /** @type {number|null}        Raw percentage score. Null for grade-only mode. */
  #score;

  /** @type {string|null}        Explicit grade letter (e.g. 'A', 'B+').
   *  Null in score-only mode where the grade is always computed. */
  #gradeKey;

  /** @type {'score'|'grade'|'both'}  How this course's grade was entered. */
  #inputMode;

  /** @type {string}             ID of the scale used for this course's grade points. */
  #scaleId;

  /** @type {number}             Unix timestamp (ms) when the course was created. */
  #createdAt;

  // ── Constructor ────────────────────────────────────────────────────────────

  /**
   * @param {{
   *   id?:          string,
   *   code:         string,
   *   title:        string,
   *   creditUnits:  number,
   *   score?:       number | null,
   *   gradeKey?:    string | null,
   *   inputMode?:   'score' | 'grade' | 'both',
   *   scaleId?:     string,
   *   createdAt?:   number
   * }} data
   * @throws {ValidationError} if required fields fail validation
   */
  constructor({
    id,
    code,
    title,
    creditUnits,
    score = null,
    gradeKey = null,
    inputMode = INPUT_MODES.SCORE,
    scaleId = DEFAULT_SCALE_ID,
    createdAt,
  } = {}) {
    // ── Validate common fields (independent of inputMode) ───────────────────
    const baseCheck = runValidators(
      () => validateCourseTitle(title),
      () => validateCourseCode(code),
      () => validateCreditUnits(creditUnits),
      () => validateInputMode(inputMode)
    );
    if (!baseCheck.valid) throw new ValidationError(baseCheck.message);

    // ── Validate the mode-specific field combination ─────────────────────────
    // This checks: score present if needed, gradeKey present if needed.
    const modeCheck = validateCourseForMode({ inputMode, score, gradeKey, scaleId });
    if (!modeCheck.valid) throw new ValidationError(modeCheck.message);

    // ── Assign fields ────────────────────────────────────────────────────────
    this.#id = id ?? crypto.randomUUID();
    this.#code = code.trim().toUpperCase();
    this.#title = title.trim();
    this.#creditUnits = Number(creditUnits);
    this.#inputMode = inputMode;
    this.#scaleId = scaleId ?? DEFAULT_SCALE_ID;
    this.#createdAt = createdAt ?? Date.now();

    // Normalise score/gradeKey per mode:
    // In 'score' mode  → score is a number, gradeKey is null (computed on demand)
    // In 'grade' mode  → gradeKey is a string, score is null (never needed)
    // In 'both'  mode  → both are stored as-is
    this.#score = inputMode === INPUT_MODES.GRADE ? null : Number(score);
    this.#gradeKey = inputMode === INPUT_MODES.SCORE ? null : String(gradeKey).trim();
  }

  // ── Public Getters (read-only external API) ────────────────────────────────

  get id() {
    return this.#id;
  }
  get code() {
    return this.#code;
  }
  get title() {
    return this.#title;
  }
  get creditUnits() {
    return this.#creditUnits;
  }
  get score() {
    return this.#score;
  }
  get gradeKey() {
    return this.#gradeKey;
  }
  get inputMode() {
    return this.#inputMode;
  }
  get scaleId() {
    return this.#scaleId;
  }
  get createdAt() {
    return this.#createdAt;
  }

  /**
   * The letter grade for this course.
   *
   * Resolution:
   * - 'score' mode  → computed from #score via scale lookup
   * - 'grade' mode  → returns #gradeKey directly (the student's explicit choice)
   * - 'both'  mode  → returns #gradeKey (explicit overrides computed)
   *
   * @returns {string}  e.g. 'A', 'B+', 'C'
   */
  get grade() {
    if (this.#inputMode === INPUT_MODES.SCORE) {
      // Grade is fully determined by the score — no manual override possible
      return gradeFromScore(this.#score, this.#scaleId).letter;
    }
    // 'grade' or 'both' — return the explicitly stored grade key
    return this.#gradeKey;
  }

  /**
   * The numeric grade point for this course on the stored scale.
   *
   * Resolution:
   * - 'score' mode  → points from scale lookup of the computed grade
   * - 'grade' mode  → points looked up by #gradeKey letter
   * - 'both'  mode  → points from #gradeKey (explicit grade drives GPA)
   *
   * This is the value that feeds directly into GPA arithmetic.
   *
   * @returns {number}  e.g. 5.0, 4.0, 3.3
   */
  get gradePoint() {
    if (this.#inputMode === INPUT_MODES.SCORE) {
      return gradeFromScore(this.#score, this.#scaleId).points;
    }
    // 'grade' or 'both' — look up the grade key in the scale
    const entry = gradeEntryFromLetter(this.#gradeKey, this.#scaleId);
    // Defensive: if the entry is not found (stale data), fall back to 0
    return entry?.points ?? 0;
  }

  /**
   * Quality points = gradePoint × creditUnits.
   *
   * This is the fundamental unit of GPA arithmetic:
   *   GPA = Σ(qualityPoints) / Σ(creditUnits)
   *
   * Being a computed getter rather than a stored field ensures it is always
   * in sync with gradePoint and creditUnits — no possibility of stale data.
   *
   * @returns {number}
   */
  get qualityPoints() {
    return this.gradePoint * this.#creditUnits;
  }

  /**
   * CSS modifier class for the grade badge element.
   * Matches the grade-badge--* rules in main.css.
   * @returns {string}  e.g. 'grade-badge--A', 'grade-badge--F'
   */
  get gradeCssClass() {
    if (this.#inputMode === INPUT_MODES.SCORE) {
      return gradeFromScore(this.#score, this.#scaleId).cssClass;
    }
    return gradeEntryFromLetter(this.#gradeKey, this.#scaleId)?.cssClass ?? 'grade-badge--F';
  }

  /**
   * Whether this course has a stored score (true in 'score' and 'both' modes).
   * Useful for conditionally rendering the score column in the transcript.
   * @returns {boolean}
   */
  get hasScore() {
    return this.#inputMode !== INPUT_MODES.GRADE && this.#score !== null;
  }

  /**
   * Whether this course used an explicit grade selection (true in 'grade' and 'both').
   * @returns {boolean}
   */
  get hasExplicitGrade() {
    return this.#inputMode !== INPUT_MODES.SCORE && this.#gradeKey !== null;
  }

  // ── Static Factory Methods ─────────────────────────────────────────────────

  /**
   * Named constructor — creates a Course from a plain object (e.g. from IndexedDB).
   *
   * WHY a named factory instead of just `new Course(obj)`?
   * It communicates intent: this is a restoration from persisted data,
   * not a fresh user input. In the future, fromJSON() could include
   * migration logic (e.g. adding default fields for old data that pre-dates
   * the inputMode field) without changing the main constructor.
   *
   * @param {Object} obj
   * @returns {Course}
   */
  static fromJSON(obj) {
    // Migration: if old data has no inputMode (pre-dual-input), default to 'score'
    // This means all historical courses are treated as score-input, which is correct.
    if (!obj.inputMode) {
      return new Course({ ...obj, inputMode: INPUT_MODES.SCORE });
    }
    return new Course(obj);
  }

  /**
   * Derive grade info from a raw score without constructing a full Course.
   * Convenience wrapper used by CourseForm's live preview.
   *
   * @param {number|string} score
   * @param {string}        [scaleId]
   * @returns {{ letter: string, points: number, cssClass: string }}
   */
  static gradeFromScore(score, scaleId = DEFAULT_SCALE_ID) {
    return gradeFromScore(score, scaleId);
  }

  // ── Instance Methods ───────────────────────────────────────────────────────

  /**
   * Returns a NEW Course with the given fields patched (immutable update).
   *
   * This follows the same pattern as Array.prototype.with() (ES2023):
   * "return a new instance with this one field changed" instead of mutating.
   *
   * @param {Partial<ConstructorParameters<typeof Course>[0]>} changes
   * @returns {Course}
   */
  with(changes) {
    return new Course({ ...this.toJSON(), ...changes });
  }

  /**
   * Returns a plain-object representation for JSON serialisation and IndexedDB.
   *
   * NOTE: JSON.stringify calls toJSON() automatically if it exists on an object.
   * The explicit field list here (rather than `{ ...this }`) is intentional —
   * computed getters like `grade` and `qualityPoints` are NOT included because
   * they can be re-derived from the stored data. Storing them would create a
   * second source of truth that could fall out of sync.
   *
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.#id,
      code: this.#code,
      title: this.#title,
      creditUnits: this.#creditUnits,
      score: this.#score,
      gradeKey: this.#gradeKey,
      inputMode: this.#inputMode,
      scaleId: this.#scaleId,
      createdAt: this.#createdAt,
    };
  }

  /** Human-readable debug string. */
  toString() {
    const gradeInfo =
      this.#inputMode === INPUT_MODES.SCORE ? `score=${this.#score}` : `grade=${this.#gradeKey}`;
    return `[Course ${this.#code} | ${this.grade} (${this.gradePoint}pts) × ${this.#creditUnits}CU | ${gradeInfo} | scale ${this.#scaleId}]`;
  }

  /**
   * Symbol.iterator — makes Course natively iterable.
   *
   * This is how for...of, spread, and destructuring work on custom objects.
   * The browser checks for [Symbol.iterator] before attempting to iterate.
   *
   * Fields yielded: code, title, grade, gradePoint, creditUnits
   * This matches the column order of the course table in the transcript view.
   *
   * @example
   * const [code, title, grade] = course;
   * for (const field of course) { console.log(field); }
   */
  [Symbol.iterator]() {
    const fields = [this.#code, this.#title, this.grade, this.gradePoint, this.#creditUnits];
    let i = 0;
    return {
      next: () =>
        i < fields.length ? { value: fields[i++], done: false } : { value: undefined, done: true },
      // The iterator itself is iterable — required by the iterator protocol
      [Symbol.iterator]() {
        return this;
      },
    };
  }
}
