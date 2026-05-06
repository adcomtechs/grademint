/**
 * @module ThresholdSection
 * @description Grade reference accordion — purely informational, no inputs.
 *
 * SINGLE RESPONSIBILITY:
 *   Render a collapsible table of grade letter → score range → point value
 *   for the active grading scale. Lowest visual priority in the form.
 *
 * DOES NOT:
 *   - Accept any user input
 *   - Call any callbacks
 *   - Know about other sections
 *
 * Placed at the form footer, on the same visual level as the submit button,
 * so it is reachable for reference without dominating the form's visual
 * hierarchy. Collapsed by default — students who need it know where to look.
 */

import { createElement } from '@/utils/dom.js';
import { getGradeEntries } from '@/utils/helpers.js';
import { getScale } from '@/utils/helpers.js';
import { DEFAULT_SCALE_ID } from '@/utils/constants.js';

export class ThresholdSection {
  /**
   * @param {{ scaleId?: string }} options
   */
  constructor({ scaleId = DEFAULT_SCALE_ID } = {}) {
    this._scaleId = scaleId;
    this._isOpen = false;
    this._ctrl = new AbortController();
  }

  /** Builds and returns the accordion root element. Does not append to DOM. */
  build() {
    const scale = getScale(this._scaleId);
    const entries = getGradeEntries(this._scaleId);

    const body = createElement('div', {
      className: 'cf2-threshold-body',
      hidden: true,
      'aria-hidden': 'true',
    });

    entries.forEach(({ letter, points, minScore, maxScore, cssClass }) => {
      body.append(
        createElement(
          'div',
          { className: 'cf2-threshold-row' },
          createElement('span', { className: `grade-badge ${cssClass}` }, letter),
          createElement('span', { className: 'cf2-threshold-range' }, `${minScore} – ${maxScore}`),
          createElement('span', { className: 'cf2-threshold-pts' }, `${points.toFixed(1)} pts`)
        )
      );
    });

    const toggleBtn = createElement(
      'button',
      {
        type: 'button',
        className: 'cf2-threshold-toggle',
        'aria-expanded': 'false',
        'aria-controls': 'cf2-threshold-body',
      },
      createElement('span', {}, `${scale.label} — Grade Reference`),
      createElement('span', { className: 'cf2-threshold-chevron', 'aria-hidden': 'true' }, '▼')
    );

    toggleBtn.addEventListener(
      'click',
      () => {
        this._isOpen = !this._isOpen;
        body.hidden = !this._isOpen;
        body.setAttribute('aria-hidden', String(!this._isOpen));
        toggleBtn.setAttribute('aria-expanded', String(this._isOpen));

        const chevron = toggleBtn.querySelector('.cf2-threshold-chevron');
        if (chevron) chevron.textContent = this._isOpen ? '▲' : '▼';
      },
      { signal: this._ctrl.signal }
    );

    return createElement('div', { className: 'cf2-threshold-section' }, toggleBtn, body);
  }

  /** Cancels all event listeners. */
  destroy() {
    this._ctrl.abort();
  }
}
