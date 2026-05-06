/**
 * @module CreditUnitField
 * @description Pill-style credit unit selector backed by hidden radio inputs.
 *
 * RENDERS:
 *   .cf-cu-row
 *     p.form-label  "Credit Units"
 *     .cf-cu-pills[role=group]
 *       label.cf-cu-pill × N   (each wraps a hidden <input type="radio">)
 *
 * WHY PILLS OVER <SELECT>:
 * The credit unit options are small and fixed. Visible pills communicate
 * all options simultaneously and are faster to tap on mobile — no
 * dropdown required. The hidden radio inputs preserve keyboard navigation
 * and screen reader semantics.
 *
 * RESET BEHAVIOUR:
 * reset() always restores to DEFAULT_CU (3) regardless of initialValue.
 * This matches the "new course" context where CourseForm calls reset()
 * after a successful submission to prepare for the next entry.
 */

import { FormField } from '../../common/FormField.js';
import { createElement, clearElement } from '../../../utils/dom.js';
import { CREDIT_UNITS } from '../../../utils/constants.js';

/** The credit unit value that reset() returns to. */
const DEFAULT_CU = 3;

/** Monotonically increasing ID for unique radio group names. */
let _uid = 0;

export class CreditUnitField extends FormField {
  /**
   * @param {HTMLElement} container
   * @param {{
   *   initialValue?:   number,
   *   availableUnits?: readonly number[],
   * }} options
   */
  constructor(container, { initialValue = DEFAULT_CU, availableUnits = CREDIT_UNITS } = {}) {
    super(container);
    this._initialValue = initialValue;
    this._availableUnits = availableUnits;
    this._selectedCU = initialValue;

    // Kept alive across renders for pill class toggling
    this._pillMap = new Map(); // cu → { radio, pill }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  render() {
    clearElement(this.container);
    this._selectedCU = this._initialValue;
    this._pillMap.clear();

    const groupName = `cf-cu-${++_uid}`;
    const pillGroup = createElement('div', {
      className: 'cf-cu-pills',
      role: 'group',
      'aria-label': 'Credit units',
    });

    this._availableUnits.forEach((cu) => {
      const inputId = `${groupName}-${cu}`;
      const isDefault = cu === this._selectedCU;

      const radio = createElement('input', {
        type: 'radio',
        name: groupName,
        id: inputId,
        value: String(cu),
        className: 'cf-cu-radio',
      });
      if (isDefault) radio.checked = true;

      const pill = createElement(
        'label',
        { className: `cf-cu-pill ${isDefault ? 'is-selected' : ''}`, for: inputId },
        radio,
        String(cu)
      );

      this.addListener(radio, 'change', () => {
        this._selectedCU = cu;
        // Toggle selected class on all pills
        this._pillMap.forEach(({ pill: p }) => p.classList.remove('is-selected'));
        pill.classList.add('is-selected');
      });

      this._pillMap.set(cu, { radio, pill });
      pillGroup.append(pill);
    });

    this.container.append(
      createElement(
        'div',
        { className: 'cf-cu-row' },
        createElement('p', { className: 'form-label' }, 'Credit Units'),
        pillGroup
      )
    );
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns the currently selected credit unit value.
   * @returns {number}
   */
  getValue() {
    return this._selectedCU;
  }

  /**
   * Resets the selector to the default value (3 credit units).
   */
  reset() {
    this._selectedCU = DEFAULT_CU;
    this._pillMap.forEach(({ radio, pill }, cu) => {
      const isDefault = cu === DEFAULT_CU;
      radio.checked = isDefault;
      pill.classList.toggle('is-selected', isDefault);
    });
  }
}
