/**
 * @module StudentSection
 * @description Student identity and grading scale form section.
 *
 * FIELDS:
 *   Full Name (required, validated — max 60 chars)
 *   Department / Programme (optional)
 *   Matric Number (optional)
 *   Current Level (optional)
 *   Academic Session (optional)
 *   Grading Scale (select — controls how new courses are graded)
 *
 * REACTIVITY:
 *   Subscribes only to s.student so unrelated state changes (adding a course,
 *   changing the active semester) do not re-render and wipe unsaved input.
 *   After a successful save, the store updates → watchState fires →
 *   safeRender() runs → inputs reflect the persisted values.
 *
 * VALIDATION:
 *   Name is the only required field. Other fields are optional — students
 *   in early semesters may not yet know their department assignment.
 */

import { BaseComponent }       from '@/components/common/BaseComponent.js';
import { createElement, showToast } from '@/utils/dom.js';
import { validateStudentName } from '@/utils/validators.js';
import { DEFAULT_SCALE_ID }    from '@/utils/constants.js';
import { getAvailableScales }  from '@/utils/helpers.js';
import { watchState }          from '@/utils/selector.js';

export class StudentSection extends BaseComponent {
  constructor(container, store) {
    super(container, store);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  afterMount() {
    const unsub = watchState(
      this.store,
      (s) => s.student,
      () => this.safeRender()
    );
    this.addSubscription(unsub);
  }

  render() {
    const student = this.store.getState().student ?? {};
    this.container.innerHTML = '';
    this.container.append(this._build(student));
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  _build(student) {
    const nameInput    = _textInput('pv-name',    student.name     ?? '', 'e.g. Chukwuemeka Okafor', 60);
    const deptInput    = _textInput('pv-dept',    student.dept     ?? '', 'e.g. Computer Science',   80);
    const matricInput  = _textInput('pv-matric',  student.matricNo ?? '', 'e.g. 2021/12345');
    const levelInput   = _textInput('pv-level',   student.level    ?? '', '300 Level',               30);
    const sessionInput = _textInput('pv-session', student.session  ?? '', '2023/2024',               20);
    const nameErr      = createElement('span', { className: 'field-error', id: 'pv-name-err' });

    const scaleSelect = this._buildScaleSelect(student.scaleId ?? DEFAULT_SCALE_ID);

    const saveBtn = createElement(
      'button',
      {
        className: 'btn btn--primary btn--sm',
        type:      'button',
        onClick:   () => this._handleSave(
          { nameInput, deptInput, matricInput, levelInput, sessionInput, scaleSelect },
          nameErr
        ),
      },
      'Save Profile'
    );

    return createElement(
      'div',
      { className: 'pv-card' },
      createElement('h3', { className: 'pv-card-title' }, '👤 Student Profile'),

      // Full name — spans both columns
      createElement(
        'div',
        { className: 'form-group' },
        _label('pv-name', 'Full Name'),
        nameInput,
        nameErr
      ),

      // Department + Matric
      createElement(
        'div',
        { className: 'pv-form-row' },
        createElement(
          'div',
          { className: 'form-group' },
          _label('pv-dept', 'Department / Programme'),
          deptInput
        ),
        createElement(
          'div',
          { className: 'form-group' },
          _label('pv-matric', 'Matric Number'),
          matricInput
        )
      ),

      // Level + Session
      createElement(
        'div',
        { className: 'pv-form-row' },
        createElement(
          'div',
          { className: 'form-group' },
          _label('pv-level', 'Current Level'),
          levelInput
        ),
        createElement(
          'div',
          { className: 'form-group' },
          _label('pv-session', 'Academic Session'),
          sessionInput
        )
      ),

      // Grading scale
      createElement(
        'div',
        { className: 'form-group' },
        _label('pv-scale', 'Grading Scale'),
        scaleSelect,
        createElement(
          'p',
          { className: 'form-hint' },
          'Changing the scale applies to new courses only. Existing courses keep their original grading.'
        )
      ),

      createElement('div', { className: 'pv-actions' }, saveBtn)
    );
  }

  // ── Scale selector ─────────────────────────────────────────────────────────

  /**
   * Builds the grading scale <select> element, pre-selecting the active scale.
   * @param {string} activeScaleId
   * @returns {HTMLSelectElement}
   */
  _buildScaleSelect(activeScaleId) {
    const select = createElement('select', {
      id:        'pv-scale',
      className: 'form-input form-select',
    });

    getAvailableScales().forEach(({ id, label }) => {
      const opt = createElement('option', { value: id }, label);
      if (id === activeScaleId) opt.selected = true;
      select.append(opt);
    });

    return select;
  }

  // ── Save handler ───────────────────────────────────────────────────────────

  /**
   * @param {{ nameInput, deptInput, matricInput, levelInput, sessionInput, scaleSelect }} inputs
   * @param {HTMLElement} nameErr  Error span for the name field
   */
  _handleSave(
    { nameInput, deptInput, matricInput, levelInput, sessionInput, scaleSelect },
    nameErr
  ) {
    const name = nameInput.value.trim();
    const v    = validateStudentName(name);

    if (!v.valid) {
      nameErr.textContent = v.message;
      nameInput.classList.add('input--error');
      return;
    }

    nameErr.textContent = '';
    nameInput.classList.remove('input--error');

    this.store.dispatch({
      type:    'SET_STUDENT',
      payload: {
        name,
        dept:     deptInput.value.trim(),
        level:    levelInput.value.trim(),
        session:  sessionInput.value.trim(),
        matricNo: matricInput.value.trim(),
        scaleId:  scaleSelect.value,
      },
    });

    showToast('Profile saved.', 'success');
  }
}

// ── Module-level helpers ───────────────────────────────────────────────────────

/**
 * @param {string} id
 * @param {string} value
 * @param {string} placeholder
 * @param {number} [maxlength]
 * @returns {HTMLInputElement}
 */
function _textInput(id, value, placeholder, maxlength) {
  const el = createElement('input', {
    id,
    className:   'form-input',
    type:        'text',
    value,
    placeholder,
  });
  if (maxlength) el.maxLength = maxlength;
  return el;
}

/**
 * @param {string} htmlFor
 * @param {string} text
 * @returns {HTMLLabelElement}
 */
function _label(htmlFor, text) {
  return createElement('label', { className: 'form-label', for: htmlFor }, text);
}