/**
 * @module EditCourseFormState
 * @description Mutable value container for an edit-course session.
 *
 * Mirrors CourseFormState but is seeded from an existing Course domain object
 * rather than starting empty. The inputMode property is derived — never stored
 * explicitly — for the same reason as in CourseFormState: mode is an emergent
 * property of what data is present, not an upfront decision.
 *
 * No DOM. No store. Pure JS. Fully testable without a browser.
 */

import { DEFAULT_SCALE_ID, INPUT_MODES } from '@/utils/constants.js';

export class EditCourseFormState {
  /**
   * @param {import('@/domain/Course.js').Course} course  The course being edited.
   */
  constructor(course) {
    this._code = course.code ?? '';
    this._title = course.title ?? '';
    this._creditUnits = course.creditUnits ?? 3;
    this._scaleId = course.scaleId ?? DEFAULT_SCALE_ID;

    // Score — null when the course was entered grade-only
    this._score = course.hasScore ? (course.score ?? null) : null;

    // Override grade — the manually chosen letter (may differ from computed)
    // In edit context, if the original mode was GRADE or BOTH, restore gradeKey.
    // If it was SCORE-only, start with no override (grade is computed live).
    const hadExplicitGrade =
      course.inputMode === INPUT_MODES.GRADE || course.inputMode === INPUT_MODES.BOTH;
    this._overrideGrade = hadExplicitGrade ? (course.gradeKey ?? null) : null;

    // Whether the override picker is currently visible
    this._isOverrideOpen = hadExplicitGrade && Boolean(course.gradeKey);
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
  get scaleId() {
    return this._scaleId;
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

  /** Derived — same logic as CourseFormState. */
  get inputMode() {
    const hasScore = this._score !== null && Number.isFinite(this._score);
    const hasGrade = Boolean(this._overrideGrade);
    if (hasScore && hasGrade) return INPUT_MODES.BOTH;
    if (hasGrade) return INPUT_MODES.GRADE;
    return INPUT_MODES.SCORE;
  }

  /**
   * Returns a plain snapshot for validation and dispatch.
   * @returns {{ code, title, creditUnits, scaleId, score, overrideGrade, inputMode, isOverrideOpen }}
   */
  snapshot() {
    return {
      code: this._code,
      title: this._title,
      creditUnits: this._creditUnits,
      scaleId: this._scaleId,
      score: this._score,
      overrideGrade: this._overrideGrade,
      inputMode: this.inputMode,
      isOverrideOpen: this._isOverrideOpen,
    };
  }
}
