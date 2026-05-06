/**
 * @module FormFooter
 * @description Renders the form footer: scale badge + grade reference + submit.
 *
 * SINGLE RESPONSIBILITY:
 *   Compose the bottom row of the course form. It owns the submit button and
 *   positions the ThresholdSection to its left at low visual weight so the
 *   primary action (Add Course) is always the rightmost, most prominent element.
 *
 * DOES NOT:
 *   - Perform validation
 *   - Read form values
 *   - Know about store dispatch
 *
 * LAYOUT:
 *   ┌────────────────────────────────────────────────────────┐
 *   │  [5.0 Scale ▾ Grade Reference]          [+ Add Course] │
 *   └────────────────────────────────────────────────────────┘
 */

import { createElement } from '@/utils/dom.js';
import { ThresholdSection } from './ThresholdSection.js';
import { getScale } from '@/utils/helpers.js';
import { DEFAULT_SCALE_ID } from '@/utils/constants.js';

export class FormFooter {
  /**
   * @param {{
   *   scaleId?:  string,
   *   onSubmit:  () => void,
   * }} options
   */
  constructor({ scaleId = DEFAULT_SCALE_ID, onSubmit } = {}) {
    this._scaleId = scaleId;
    this._onSubmit = onSubmit;
    this._threshold = new ThresholdSection({ scaleId });
    this._submitBtn = null;
    this._ctrl = new AbortController();
  }

  /** Builds and returns the footer root element. */
  build() {
    this._submitBtn = createElement(
      'button',
      {
        type: 'button',
        className: 'btn btn--primary cf2-submit-btn',
      },
      '+ Add Course'
    );

    this._submitBtn.addEventListener(
      'click',
      () => {
        this._onSubmit?.();
      },
      { signal: this._ctrl.signal }
    );

    const scale = getScale(this._scaleId);
    const scaleBadge = createElement(
      'span',
      { className: 'cf2-scale-badge' },
      createElement('span', { className: 'cf2-scale-badge-label' }, 'Scale:'),
      createElement(
        'span',
        { className: 'cf2-scale-badge-value' },
        scale.label.split('(')[0].trim()
      )
    );

    return createElement(
      'div',
      { className: 'cf2-form-footer' },
      createElement('div', { className: 'cf2-footer-left' }, scaleBadge, this._threshold.build()),
      this._submitBtn
    );
  }

  /** Sets the submit button to a loading/disabled state during async operations. */
  setSubmitting(isSubmitting) {
    if (!this._submitBtn) return;
    this._submitBtn.disabled = isSubmitting;
    this._submitBtn.textContent = isSubmitting ? 'Adding…' : '+ Add Course';
  }

  /** Cancels all listeners including the threshold accordion's. */
  destroy() {
    this._threshold.destroy();
    this._ctrl.abort();
  }
}
