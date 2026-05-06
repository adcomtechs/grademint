/**
 * @module ScoreField
 * @description Score input with a progress bar and a live grade preview card.
 *
 * RENDERS:
 *   .cf-score-section
 *     .cf-score-field
 *       label + input[type=number] + .cf-score-bar
 *     .cf-grade-card    ← updates live as score is typed
 *
 * CROSS-FIELD COMMUNICATION:
 * Accepts an `onScoreChange(score: number|null)` callback used by
 * CourseForm in 'both' mode to sync the suggested grade into GradePickerField.
 *
 * ERROR STATE:
 * setError(true/false) toggles the input--error class; cleared automatically
 * on reset() and when the user types a new value.
 */

import { FormField } from '../../common/FormField.js';
import { createElement, clearElement } from '../../../utils/dom.js';
import { gradeFromScore } from '../../../utils/helpers.js';
import { DEFAULT_SCALE_ID } from '../../../utils/constants.js';

/** Monotonically increasing ID used to pair <label> with <input>. */
let _uid = 0;

export class ScoreField extends FormField {
  /**
   * @param {HTMLElement} container
   * @param {{
   *   scaleId?:       string,
   *   initialScore?:  number | null,
   *   onScoreChange?: (score: number | null) => void,
   * }} options
   */
  constructor(
    container,
    { scaleId = DEFAULT_SCALE_ID, initialScore = null, onScoreChange = null } = {}
  ) {
    super(container);
    this._scaleId = scaleId;
    this._initialScore = initialScore;
    this._onScoreChange = onScoreChange;

    // DOM refs populated by render() — used by getValue(), reset(), setError()
    this._scoreInput = null;
    this._barFill = null;
    this._gradeLetter = null;
    this._gradePts = null;
    this._gradeCard = null;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  render() {
    clearElement(this.container);

    const id = `sf-score-${++_uid}`;

    this._scoreInput = createElement('input', {
      id,
      className: 'form-input cf-score-input',
      type: 'number',
      min: '0',
      max: '100',
      placeholder: '75',
      autocomplete: 'off',
      value: this._initialScore !== null ? String(this._initialScore) : '',
    });

    this._barFill = createElement('div', {
      className: 'cf-score-bar-fill',
      style: { width: '0%' },
    });

    const bar = createElement('div', { className: 'cf-score-bar' }, this._barFill);

    this._gradeLetter = createElement('span', { className: 'cf-grade-letter' }, '—');
    this._gradePts = createElement('span', { className: 'cf-grade-pts' }, '');
    this._gradeCard = createElement(
      'div',
      { className: 'cf-grade-card', 'aria-live': 'polite', 'aria-label': 'Computed grade' },
      this._gradeLetter,
      this._gradePts
    );

    // Seed preview if an initial score was supplied
    if (this._initialScore !== null) {
      this._updatePreview(this._initialScore);
    }

    this.container.append(
      createElement(
        'div',
        { className: 'cf-score-section' },
        createElement(
          'div',
          { className: 'cf-score-field' },
          createElement('label', { className: 'form-label', for: id }, 'Score (0–100)'),
          this._scoreInput,
          bar
        ),
        this._gradeCard
      )
    );

    this.addListener(this._scoreInput, 'input', () => {
      // Clear error styling as soon as the user starts correcting
      this._scoreInput.classList.remove('input--error');

      const raw = this._scoreInput.value;
      if (!raw && raw !== '0') {
        this._clearPreview();
        this._onScoreChange?.(null);
        return;
      }
      const n = Math.max(0, Math.min(Number(raw), 100));
      this._updatePreview(n);
      this._onScoreChange?.(n);
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns the current score value, or null if the input is empty/invalid.
   * @returns {number | null}
   */
  getValue() {
    const raw = this._scoreInput?.value;
    if (raw === null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Clears the score input and resets the preview card and bar.
   */
  reset() {
    if (this._scoreInput) this._scoreInput.value = '';
    this._clearPreview();
    this._scoreInput?.classList.remove('input--error');
  }

  /**
   * Adds or removes the error highlight on the score input.
   * Called by CourseForm._validate() when mode validation fails.
   * @param {boolean} hasError
   */
  setError(hasError) {
    this._scoreInput?.classList.toggle('input--error', hasError);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Updates the grade card and progress bar to reflect a given score.
   * @param {number} n  Score in range [0, 100]
   */
  _updatePreview(n) {
    const { letter, points, cssClass } = gradeFromScore(n, this._scaleId);
    const modClass = cssClass.replace('grade-badge--', '');

    this._barFill.style.width = `${n}%`;
    this._gradeLetter.textContent = letter;
    this._gradePts.textContent = `${points.toFixed(1)} pts`;
    this._gradeCard.className = `cf-grade-card cf-grade-card--${modClass}`;
  }

  /** Resets the grade card and progress bar to their empty state. */
  _clearPreview() {
    this._barFill.style.width = '0%';
    this._gradeLetter.textContent = '—';
    this._gradePts.textContent = '';
    this._gradeCard.className = 'cf-grade-card';
  }
}
