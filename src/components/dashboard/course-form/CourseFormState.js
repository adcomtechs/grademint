/**
 * @module CourseFormState
 * @description Immutable-style value container for a single CourseForm session.
 *
 * Holds all mutable form values in one place so CourseForm (the orchestrator)
 * never reaches into DOM elements to read values at submit time — it reads from
 * state instead. This makes the submit path deterministic and testable without
 * a DOM environment.
 *
 * NOT a store subscriber. NOT a DOM owner. Pure JS object with no side-effects.
 *
 * inputMode is derived, never stored explicitly:
 *   score only  → 'score'
 *   grade only  → 'grade'
 *   both        → 'both'
 * This makes the mode an emergent property of the data rather than a separate
 * decision the user has to make upfront.
 */

export class CourseFormState {
  constructor() {
    this._code = '';
    this._title = '';
    this._creditUnits = 3;
    this._score = null; // number | null
    this._overrideGrade = null; // string | null — letter chosen via picker
    this._isOverrideOpen = false; // whether the grade picker section is visible
  }

  // ── Setters ────────────────────────────────────────────────────────────────

  setCode(v) {
    this._code = String(v ?? '');
  }
  setTitle(v) {
    this._title = String(v ?? '');
  }
  setCreditUnits(v) {
    this._creditUnits = Number(v) || 3;
  }
  setScore(v) {
    this._score = v === null ? null : Number(v);
  }
  setOverrideGrade(v) {
    this._overrideGrade = v ?? null;
  }
  setOverrideOpen(v) {
    this._isOverrideOpen = Boolean(v);
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  get code() {
    return this._code;
  }
  get title() {
    return this._title;
  }
  get creditUnits() {
    return this._creditUnits;
  }
  get score() {
    return this._score;
  }
  get overrideGrade() {
    return this._overrideGrade;
  }
  get isOverrideOpen() {
    return this._isOverrideOpen;
  }

  /**
   * Derives inputMode from current state.
   * No explicit mode tracking — the mode is always inferrable from the data.
   * @returns {'score' | 'grade' | 'both'}
   */
  get inputMode() {
    const hasScore = this._score !== null && Number.isFinite(this._score);
    const hasGrade = Boolean(this._overrideGrade);
    if (hasScore && hasGrade) return 'both';
    if (hasGrade) return 'grade';
    return 'score';
  }

  /**
   * Returns a plain snapshot suitable for dispatch and validation.
   * No class references — safe to pass to pure functions.
   * @returns {{ code, title, creditUnits, score, overrideGrade, inputMode, isOverrideOpen }}
   */
  snapshot() {
    return {
      code: this._code,
      title: this._title,
      creditUnits: this._creditUnits,
      score: this._score,
      overrideGrade: this._overrideGrade,
      inputMode: this.inputMode,
      isOverrideOpen: this._isOverrideOpen,
    };
  }

  /** Resets all values to defaults. */
  reset() {
    this._code = '';
    this._title = '';
    this._creditUnits = 3;
    this._score = null;
    this._overrideGrade = null;
    this._isOverrideOpen = false;
  }
}
