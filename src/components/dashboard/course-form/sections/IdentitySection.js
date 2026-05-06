/**
 * @module IdentitySection
 * @description Renders the "what is this course" row: Code, Title, Credit Units.
 *
 * SINGLE RESPONSIBILITY:
 *   Build and expose the three always-required identity inputs.
 *   Notify the caller of changes via callbacks so CourseFormState can be
 *   updated without IdentitySection knowing state exists.
 *
 * DOES NOT:
 *   - Validate input values (that is CourseFormValidator's job)
 *   - Know about score, grade, or any other course data
 *   - Touch the store
 *
 * LAYOUT:
 *   ┌─────────────┬────────────────────────────────┬──────────────┐
 *   │ Course Code │ Course Title                   │ Credit Units │
 *   │ [CSC 201  ] │ [Data Structures & Algorithms] │ 1 2 ③ 4 5 6 │
 *   └─────────────┴────────────────────────────────┴──────────────┘
 *
 * Credit units use pill-style radio buttons — all options visible at once,
 * fast to tap on mobile, no dropdown required.
 */

import { createElement } from '@/utils/dom.js';
import { CREDIT_UNITS } from '@/utils/constants.js';

/** Monotonically increasing ID for unique radio group names across form instances. */
let _uid = 0;

export class IdentitySection {
  /**
   * @param {{
   *   onCodeChange:        (v: string) => void,
   *   onTitleChange:       (v: string) => void,
   *   onCreditUnitChange:  (v: number) => void,
   *   onEnterKey:          () => void,
   *   initialCode?:        string,
   *   initialTitle?:       string,
   *   initialCreditUnits?: number,
   * }} options
   */
  constructor(options = {}) {
    this._opts = options;
    this._uid = ++_uid;

    // DOM refs exposed for error display and value reading
    this.codeInput = null;
    this.titleInput = null;
    this.codeErr = null;
    this.titleErr = null;

    /** @type {Map<number, { radio: HTMLInputElement, pill: HTMLElement }>} */
    this._pillMap = new Map();
    this._ctrl = new AbortController();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Builds and returns the section root element. Does not append to DOM. */
  build() {
    const root = createElement('div', { className: 'cf2-identity-section' });
    root.append(this._buildCodeGroup(), this._buildTitleGroup(), this._buildCreditUnitsGroup());
    return root;
  }

  /** Returns current code value (trimmed). */
  getCode() {
    return this.codeInput?.value.trim() ?? '';
  }

  /** Returns current title value (trimmed). */
  getTitle() {
    return this.titleInput?.value.trim() ?? '';
  }

  /** Returns currently selected credit unit value. */
  getCreditUnits() {
    for (const [cu, { radio }] of this._pillMap) {
      if (radio.checked) return cu;
    }
    return this._opts.initialCreditUnits ?? 3;
  }

  /** Resets all fields to defaults. */
  reset() {
    if (this.codeInput) this.codeInput.value = '';
    if (this.titleInput) this.titleInput.value = '';
    this._selectCreditUnit(this._opts.initialCreditUnits ?? 3);
  }

  /** Focuses the code input. */
  focus() {
    requestAnimationFrame(() => this.codeInput?.focus());
  }

  /** Cancels all event listeners. Call when the section is removed from the DOM. */
  destroy() {
    this._ctrl.abort();
  }

  // ── Build helpers ──────────────────────────────────────────────────────────

  _buildCodeGroup() {
    const id = `cf2-code-${this._uid}`;

    this.codeInput = createElement('input', {
      id,
      className: 'form-input cf2-code-input',
      type: 'text',
      placeholder: 'CSC 201',
      maxlength: '15',
      autocomplete: 'off',
      value: this._opts.initialCode ?? '',
    });

    this.codeErr = createElement('span', {
      className: 'field-error cf2-field-error',
      id: `cf2-code-err-${this._uid}`,
      role: 'alert',
    });

    this.codeInput.addEventListener(
      'input',
      () => {
        this._opts.onCodeChange?.(this.codeInput.value);
      },
      { signal: this._ctrl.signal }
    );

    this.codeInput.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Enter') this._opts.onEnterKey?.();
      },
      { signal: this._ctrl.signal }
    );

    return this._buildGroup(
      createElement('label', { className: 'form-label', for: id }, 'Course Code'),
      this.codeInput,
      this.codeErr,
      'cf2-code-group'
    );
  }

  _buildTitleGroup() {
    const id = `cf2-title-${this._uid}`;

    this.titleInput = createElement('input', {
      id,
      className: 'form-input cf2-title-input',
      type: 'text',
      placeholder: 'Data Structures & Algorithms',
      maxlength: '80',
      value: this._opts.initialTitle ?? '',
    });

    this.titleErr = createElement('span', {
      className: 'field-error cf2-field-error',
      id: `cf2-title-err-${this._uid}`,
      role: 'alert',
    });

    this.titleInput.addEventListener(
      'input',
      () => {
        this._opts.onTitleChange?.(this.titleInput.value);
      },
      { signal: this._ctrl.signal }
    );

    this.titleInput.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Enter') this._opts.onEnterKey?.();
      },
      { signal: this._ctrl.signal }
    );

    return this._buildGroup(
      createElement('label', { className: 'form-label', for: id }, 'Course Title'),
      this.titleInput,
      this.titleErr,
      'cf2-title-group'
    );
  }

  _buildCreditUnitsGroup() {
    const groupName = `cf2-cu-${this._uid}`;
    this._pillMap.clear();

    const pillRow = createElement('div', {
      className: 'cf2-cu-pills',
      role: 'group',
      'aria-label': 'Credit units',
    });

    const initial = this._opts.initialCreditUnits ?? 3;

    CREDIT_UNITS.forEach((cu) => {
      const inputId = `${groupName}-${cu}`;
      const isActive = cu === initial;

      const radio = createElement('input', {
        type: 'radio',
        name: groupName,
        id: inputId,
        value: String(cu),
        className: 'cf2-cu-radio',
      });
      if (isActive) radio.checked = true;

      const pill = createElement(
        'label',
        { className: `cf2-cu-pill${isActive ? ' is-selected' : ''}`, for: inputId },
        radio,
        String(cu)
      );

      radio.addEventListener(
        'change',
        () => {
          this._pillMap.forEach(({ pill: p }) => p.classList.remove('is-selected'));
          pill.classList.add('is-selected');
          this._opts.onCreditUnitChange?.(cu);
        },
        { signal: this._ctrl.signal }
      );

      this._pillMap.set(cu, { radio, pill });
      pillRow.append(pill);
    });

    return createElement(
      'div',
      { className: 'cf2-cu-group' },
      createElement('p', { className: 'form-label' }, 'Credit Units'),
      pillRow
    );
  }

  _buildGroup(label, input, error, className) {
    return createElement('div', { className: `form-group ${className}` }, label, input, error);
  }

  _selectCreditUnit(cu) {
    const entry = this._pillMap.get(cu) ?? this._pillMap.get(3);
    if (!entry) return;
    entry.radio.checked = true;
    this._pillMap.forEach(({ pill: p }) => p.classList.remove('is-selected'));
    entry.pill.classList.add('is-selected');
  }
}
