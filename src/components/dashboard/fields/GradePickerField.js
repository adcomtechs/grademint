/**
 * @module GradePickerField
 * @description Visual grade letter picker — a grid of large clickable buttons.
 *
 * RENDERS:
 *   .cf-grade-section
 *     p.form-label  "Select Grade"
 *     .cf-grade-grid[role=listbox]
 *       button.cf-grade-btn  × N   (one per grade letter in the active scale)
 *     p.cf-grade-hint  (optional)
 *
 * CROSS-FIELD COMMUNICATION:
 * suggestGrade(letter) applies the .is-suggested class to the button that
 * matches the computed grade in 'both' mode, giving the student a visual
 * cue of what their score corresponds to before they confirm or override.
 *
 * ERROR STATE:
 * setError(true) marks the field-level container so CSS can highlight it.
 * Cleared on reset() and when the user makes a selection.
 */

import { FormField } from '../../common/FormField.js';
import { createElement, clearElement } from '../../../utils/dom.js';
import { getGradeEntries } from '../../../utils/helpers.js';
import { DEFAULT_SCALE_ID } from '../../../utils/constants.js';

export class GradePickerField extends FormField {
  /**
   * @param {HTMLElement} container
   * @param {{
   *   scaleId?:       string,
   *   initialGrade?:  string | null,
   *   showHint?:      boolean,
   * }} options
   */
  constructor(
    container,
    { scaleId = DEFAULT_SCALE_ID, initialGrade = null, showHint = true } = {}
  ) {
    super(container);
    this._scaleId = scaleId;
    this._initialGrade = initialGrade;
    this._showHint = showHint;

    // Mutable state — updated by click handlers
    this._selectedGrade = initialGrade;
    /** @type {HTMLButtonElement[]} */
    this._buttons = [];
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  render() {
    clearElement(this.container);

    const entries = getGradeEntries(this._scaleId);
    this._selectedGrade = this._initialGrade;
    this._buttons = [];

    const grid = createElement('div', {
      className: 'cf-grade-grid',
      role: 'listbox',
      'aria-label': 'Select a grade',
    });

    entries.forEach(({ letter, points, cssClass }) => {
      const modClass = cssClass.replace('grade-badge--', '');
      const isSelected = letter === this._selectedGrade;

      const btn = createElement(
        'button',
        {
          type: 'button',
          className: `cf-grade-btn cf-grade-btn--${modClass} ${isSelected ? 'is-selected' : ''}`,
          role: 'option',
          'aria-selected': String(isSelected),
          'aria-label': `${letter}: ${points.toFixed(1)} grade points`,
          dataset: { grade: letter },
        },
        createElement('span', { className: 'cf-grade-btn-letter' }, letter),
        createElement('span', { className: 'cf-grade-btn-pts' }, `${points.toFixed(1)}`)
      );

      this.addListener(btn, 'click', () => {
        // Deselect all, then select this one
        this._buttons.forEach((b) => {
          b.classList.remove('is-selected', 'is-suggested');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('is-selected');
        btn.setAttribute('aria-selected', 'true');
        this._selectedGrade = letter;

        // Clear field-level error on valid selection
        this.container.classList.remove('field--error');
      });

      this._buttons.push(btn);
      grid.append(btn);
    });

    const children = [createElement('p', { className: 'form-label' }, 'Select Grade'), grid];

    if (this._showHint) {
      children.push(
        createElement(
          'p',
          { className: 'cf-grade-hint' },
          'Tip: In "Score + Grade" mode, typing a score suggests the computed grade.'
        )
      );
    }

    this.container.append(createElement('div', { className: 'cf-grade-section' }, ...children));
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns the currently selected grade letter, or null if nothing is selected.
   * @returns {string | null}
   */
  getValue() {
    return this._selectedGrade;
  }

  /**
   * Clears the selection and removes all highlight classes.
   */
  reset() {
    this._selectedGrade = null;
    this._buttons.forEach((b) => {
      b.classList.remove('is-selected', 'is-suggested');
      b.setAttribute('aria-selected', 'false');
    });
    this.container.classList.remove('field--error');
  }

  /**
   * Highlights the button for the computed grade letter without selecting it.
   * Used in 'both' mode: the score field calls this when the score changes,
   * so the student can see which grade their score computes to and then
   * confirm or override by clicking a different button.
   *
   * @param {string | null} letter  e.g. 'B' — null clears all suggestions
   */
  suggestGrade(letter) {
    this._buttons.forEach((b) => {
      b.classList.toggle('is-suggested', letter !== null && b.dataset.grade === letter);
    });
  }

  /**
   * Adds or removes the error highlight on the field container.
   * @param {boolean} hasError
   */
  setError(hasError) {
    this.container.classList.toggle('field--error', hasError);
  }
}
