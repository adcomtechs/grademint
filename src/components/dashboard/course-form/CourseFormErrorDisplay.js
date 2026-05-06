/**
 * @module CourseFormErrorDisplay
 * @description Owns error message rendering for the course form.
 *
 * SINGLE RESPONSIBILITY:
 *   Reads a ValidationResult.errors map → writes error text to the DOM
 *   and toggles .input--error / .field--error CSS classes on inputs.
 *
 * DOES NOT:
 *   - Know what validation rules exist
 *   - Know how to submit the form
 *   - Own any input element itself
 *
 * The caller passes a `refs` object containing the input/container elements
 * that need error highlighting. CourseFormErrorDisplay does not query the DOM
 * independently — this makes it resilient to structural changes in the form.
 *
 * USAGE:
 *   const display = new CourseFormErrorDisplay(refs);
 *   display.show(validationResult.errors);  // set errors
 *   display.clear();                        // clear all
 *   display.clearField('code');             // clear one field on change
 */

export class CourseFormErrorDisplay {
  /**
   * @param {{
   *   codeInput:        HTMLElement,
   *   codeErr:          HTMLElement,
   *   titleInput:       HTMLElement,
   *   titleErr:         HTMLElement,
   *   gradeErr:         HTMLElement,
   *   scoreInput:       HTMLElement | null,
   *   scoreErr:         HTMLElement | null,
   * }} refs
   */
  constructor(refs) {
    this._refs = refs;
  }

  /**
   * Applies all errors from a validation error map to the DOM.
   * Fields not in the map are left untouched.
   *
   * @param {Record<string, string>} errors
   */
  show(errors) {
    if (errors.code) {
      this._setFieldError('code', errors.code);
    }
    if (errors.title) {
      this._setFieldError('title', errors.title);
    }
    if (errors.score) {
      this._setFieldError('score', errors.score);
    }
    if (errors.grade) {
      this._setText(this._refs.gradeErr, errors.grade);
    }
  }

  /** Clears all error states across every field. */
  clear() {
    this._clearFieldError('code');
    this._clearFieldError('title');
    this._clearFieldError('score');
    this._setText(this._refs.gradeErr, '');
  }

  /**
   * Clears the error state for a single named field.
   * Called by individual input change handlers so errors clear as soon as
   * the user starts correcting them.
   *
   * @param {'code' | 'title' | 'score' | 'grade'} field
   */
  clearField(field) {
    if (field === 'grade') {
      this._setText(this._refs.gradeErr, '');
    } else {
      this._clearFieldError(field);
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _setFieldError(field, message) {
    const input = this._refs[`${field}Input`];
    const err = this._refs[`${field}Err`];
    input?.classList.add('input--error');
    this._setText(err, message);
  }

  _clearFieldError(field) {
    const input = this._refs[`${field}Input`];
    const err = this._refs[`${field}Err`];
    input?.classList.remove('input--error');
    this._setText(err, '');
  }

  _setText(el, text) {
    if (el) el.textContent = text;
  }
}
