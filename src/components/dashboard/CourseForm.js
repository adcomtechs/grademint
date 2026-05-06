/**
 * @module CourseForm
 * @description Collapsible form that composes three FormField sub-components.
 *
 * RESPONSIBILITIES (after refactor):
 *   1. Toggle bar — the always-visible "Add Course" / "× Close" button
 *   2. Form body  — assembles ScoreField, GradePickerField, CreditUnitField
 *                   into the correct layout with a mode selector
 *   3. Validation — runs field-level validators for the current input mode
 *   4. Submission  — dispatches ADD_COURSE and resets all fields on success
 *
 * DOES NOT:
 * - Build the grade picker grid (GradePickerField)
 * - Build the score input + preview (ScoreField)
 * - Build the credit unit pills (CreditUnitField)
 *
 * FIELD LIFECYCLE:
 * All three FormField instances are created in mount(), mounted once, and
 * unmounted in CourseForm.unmount(). They live as long as this CourseForm.
 * SemesterPanel calls unmount() before creating a new CourseForm when the
 * active semester changes.
 *
 * CROSS-FIELD INTERACTION (score → grade sync in 'both' mode):
 * ScoreField receives an onScoreChange callback. In 'both' mode, the callback
 * calls gradePickerField.suggestGrade(computedLetter) so the student can see
 * which grade their score computes to before confirming or overriding.
 */

import { ScoreField } from './fields/ScoreField.js';
import { GradePickerField } from './fields/GradePickerField.js';
import { CreditUnitField } from './fields/CreditUnitField.js';
import { createElement, clearElement, showToast } from '../../utils/dom.js';
import {
  validateCourseCode,
  validateCourseTitle,
  validateCourseForMode,
} from '../../utils/validators.js';
import { INPUT_MODES, DEFAULT_SCALE_ID } from '../../utils/constants.js';
import { getScale, getGradeEntries, gradeFromScore } from '../../utils/helpers.js';

export class CourseForm {
  /**
   * @param {HTMLElement}                                       containerEl
   * @param {ReturnType<import('../../core/Store.js').createStore>} store
   * @param {string}                                            semesterId
   */
  constructor(containerEl, store, semesterId) {
    this._container = containerEl;
    this._store = store;
    this._semesterId = semesterId;
    this._scaleId = store.getState().student?.scaleId ?? DEFAULT_SCALE_ID;
    this._isOpen = false;
    this._mode = INPUT_MODES.SCORE;
    this._ctrl = new AbortController();

    // Populated during mount()
    /** @type {ScoreField | null}       */ this._scoreField = null;
    /** @type {GradePickerField | null} */ this._gradePickerField = null;
    /** @type {CreditUnitField | null}  */ this._cuField = null;

    // Plain input refs (not field components — they stay in CourseForm)
    this._codeInput = null;
    this._titleInput = null;
    this._modeErr = null;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Renders the form into the container. Call once after the container is in the DOM. */
  mount() {
    clearElement(this._container);
    this._scaleId = this._store.getState().student?.scaleId ?? DEFAULT_SCALE_ID;

    const { toggleBar, toggleBtn } = this._buildToggleBar();
    const { formBody, scoreContainer, gradeContainer } = this._buildFormBody();

    // Wire toggle
    toggleBtn.addEventListener(
      'click',
      () => {
        this._isOpen = !this._isOpen;
        this._applyOpenState(formBody, toggleBtn);
        if (this._isOpen) {
          requestAnimationFrame(() => this._codeInput?.focus());
        }
      },
      { signal: this._ctrl.signal }
    );

    this._container.append(toggleBar, formBody);
    this._applyOpenState(formBody, toggleBtn);

    // Mount field components into their containers (containers are now in the DOM)
    this._scoreField = new ScoreField(scoreContainer, {
      scaleId: this._scaleId,
      onScoreChange: (score) => {
        if (this._mode === INPUT_MODES.BOTH && score !== null) {
          const { letter } = gradeFromScore(score, this._scaleId);
          this._gradePickerField?.suggestGrade(letter);
        }
      },
    });
    this._gradePickerField = new GradePickerField(gradeContainer, {
      scaleId: this._scaleId,
      showHint: true,
    });
    this._cuField = new CreditUnitField(this._cuContainer, { initialValue: 3 });

    this._scoreField.mount();
    this._gradePickerField.mount();
    this._cuField.mount();

    // Apply initial mode visibility
    this._updateModeVisibility(scoreContainer, gradeContainer, this._mode);
  }

  /** Removes all DOM and cancels all event listeners including field components. */
  unmount() {
    this._scoreField?.unmount();
    this._gradePickerField?.unmount();
    this._cuField?.unmount();
    this._ctrl.abort();
    clearElement(this._container);
  }

  /** Programmatically opens the form (e.g. after a semester is created). */
  open() {
    if (this._isOpen) return;
    this._isOpen = true;
    const btn = this._container.querySelector('.cf-toggle-btn');
    const body = this._container.querySelector('.cf-form-body');
    if (btn && body) this._applyOpenState(body, btn);
  }

  /** Closes and resets the form. */
  close() {
    this._isOpen = false;
    const btn = this._container.querySelector('.cf-toggle-btn');
    const body = this._container.querySelector('.cf-form-body');
    if (btn && body) {
      this._applyOpenState(body, btn);
      this._resetForm();
    }
  }

  // ── Toggle Bar ─────────────────────────────────────────────────────────────

  _buildToggleBar() {
    const toggleBtn = createElement(
      'button',
      {
        className: 'cf-toggle-btn btn btn--primary',
        'aria-expanded': 'false',
        'aria-controls': `cf-body-${this._semesterId}`,
      },
      createElement('span', { className: 'cf-toggle-icon', 'aria-hidden': 'true' }, '+'),
      createElement('span', { className: 'cf-toggle-label' }, 'Add Course')
    );
    return {
      toggleBar: createElement('div', { className: 'cf-toggle-bar' }, toggleBtn),
      toggleBtn,
    };
  }

  // ── Form Body ──────────────────────────────────────────────────────────────

  /**
   * Builds the collapsible form body and returns it along with the
   * container elements that will host the three FormField components.
   * Field mounting happens AFTER this return so containers are in the DOM.
   */
  _buildFormBody() {
    const scale = getScale(this._scaleId);

    // ── Mode selector ─────────────────────────────────────────────────────────
    const { modeSelector } = this._buildModeSelector();

    // ── Shared text inputs ────────────────────────────────────────────────────
    const uid = this._semesterId;

    this._codeInput = createElement('input', {
      id: `cf-code-${uid}`,
      className: 'form-input',
      type: 'text',
      placeholder: 'CSC 201',
      maxlength: '15',
      autocomplete: 'off',
    });
    this._titleInput = createElement('input', {
      id: `cf-title-${uid}`,
      className: 'form-input',
      type: 'text',
      placeholder: 'Data Structures & Algorithms',
      maxlength: '80',
    });

    const codeErr = createElement('span', {
      className: 'field-error cf-err',
      id: `cf-code-err-${uid}`,
    });
    const titleErr = createElement('span', {
      className: 'field-error cf-err',
      id: `cf-title-err-${uid}`,
    });
    this._modeErr = createElement('span', {
      className: 'field-error cf-err cf-mode-err',
      'aria-live': 'polite',
    });

    // ── Field containers — FormField components mount into these ──────────────
    const scoreContainer = createElement('div', { className: 'cf-field-host' });
    const gradeContainer = createElement('div', { className: 'cf-field-host' });
    this._cuContainer = createElement('div', { className: 'cf-field-host' });

    // ── Scale badge ───────────────────────────────────────────────────────────
    const scaleBadge = createElement(
      'div',
      { className: 'cf-scale-badge' },
      createElement('span', { className: 'cf-scale-badge-label' }, 'Scale:'),
      createElement('span', { className: 'cf-scale-badge-value' }, scale.label)
    );

    // ── Submit ────────────────────────────────────────────────────────────────
    const submitBtn = createElement(
      'button',
      { className: 'btn btn--primary cf-submit-btn', type: 'button' },
      '+ Add Course'
    );

    submitBtn.addEventListener('click', () => this._submit(scoreContainer, gradeContainer), {
      signal: this._ctrl.signal,
    });

    [this._codeInput, this._titleInput].forEach((input) => {
      input.addEventListener(
        'keydown',
        (e) => {
          if (e.key === 'Enter') this._submit(scoreContainer, gradeContainer);
        },
        { signal: this._ctrl.signal }
      );
    });

    // ── Mode switching ────────────────────────────────────────────────────────
    modeSelector.addEventListener(
      'click',
      (e) => {
        const tab = e.target.closest('[data-mode]');
        if (!tab) return;
        this._mode = tab.dataset.mode;
        this._updateModeVisibility(scoreContainer, gradeContainer, this._mode);
      },
      { signal: this._ctrl.signal }
    );

    // ── Assemble ──────────────────────────────────────────────────────────────
    const formBody = createElement(
      'div',
      {
        className: 'cf-form-body',
        id: `cf-body-${uid}`,
        'aria-hidden': 'true',
      },
      createElement(
        'div',
        { className: 'cf-form-inner' },
        createElement(
          'div',
          { className: 'cf-form-header' },
          createElement('p', { className: 'cf-form-title' }, 'Add a Course'),
          scaleBadge
        ),
        modeSelector,
        createElement(
          'div',
          { className: 'form-row' },
          createElement(
            'div',
            { className: 'form-group form-group--sm' },
            createElement(
              'label',
              { className: 'form-label', for: `cf-code-${uid}` },
              'Course Code'
            ),
            this._codeInput,
            codeErr
          ),
          createElement(
            'div',
            { className: 'form-group' },
            createElement(
              'label',
              { className: 'form-label', for: `cf-title-${uid}` },
              'Course Title'
            ),
            this._titleInput,
            titleErr
          )
        ),
        scoreContainer, // ScoreField mounts here
        gradeContainer, // GradePickerField mounts here
        this._modeErr,
        this._cuContainer, // CreditUnitField mounts here
        this._buildThresholds(scale),
        createElement('div', { className: 'cf-submit-row' }, submitBtn)
      )
    );

    return { formBody, scoreContainer, gradeContainer };
  }

  // ── Mode Selector ──────────────────────────────────────────────────────────

  _buildModeSelector() {
    const modes = [
      { id: INPUT_MODES.SCORE, label: 'Score', desc: 'Enter raw score; grade computed' },
      { id: INPUT_MODES.GRADE, label: 'Grade Only', desc: 'Pick grade letter directly' },
      { id: INPUT_MODES.BOTH, label: 'Score + Grade', desc: 'Enter both; grade overrides' },
    ];

    const modeSelector = createElement('div', {
      className: 'cf-mode-selector',
      role: 'tablist',
      'aria-label': 'Grade input mode',
    });

    modes.forEach(({ id, label, desc }) => {
      modeSelector.append(
        createElement(
          'button',
          {
            className: `cf-mode-tab ${id === this._mode ? 'is-active' : ''}`,
            role: 'tab',
            'aria-selected': String(id === this._mode),
            'aria-label': `${label}: ${desc}`,
            title: desc,
            dataset: { mode: id },
          },
          label
        )
      );
    });

    // Sync active class — delegated from the formBody listener above
    modeSelector.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-mode]');
      if (!tab) return;
      modeSelector.querySelectorAll('.cf-mode-tab').forEach((t) => {
        const isActive = t.dataset.mode === tab.dataset.mode;
        t.classList.toggle('is-active', isActive);
        t.setAttribute('aria-selected', String(isActive));
      });
    });

    return { modeSelector };
  }

  // ── Grade Thresholds (read-only accordion — not extracted; not reused) ──────

  _buildThresholds(scale) {
    let isOpen = false;

    const body = createElement('div', { className: 'cf-thresholds-body', hidden: true });
    getGradeEntries(this._scaleId).forEach(({ letter, points, minScore, maxScore, cssClass }) => {
      body.append(
        createElement(
          'div',
          { className: 'cf-threshold-row' },
          createElement('span', { className: `grade-badge ${cssClass}` }, letter),
          createElement('span', { className: 'cf-threshold-range' }, `${minScore}–${maxScore}`),
          createElement('span', { className: 'cf-threshold-pts' }, `${points.toFixed(1)} pts`)
        )
      );
    });

    const toggleBtn = createElement(
      'button',
      {
        type: 'button',
        className: 'cf-thresholds-toggle',
        'aria-expanded': 'false',
      },
      createElement('span', {}, `${scale.label} — Grade Reference`),
      createElement('span', { className: 'cf-thresholds-icon', 'aria-hidden': 'true' }, '▼')
    );

    toggleBtn.addEventListener(
      'click',
      () => {
        isOpen = !isOpen;
        body.hidden = !isOpen;
        toggleBtn.setAttribute('aria-expanded', String(isOpen));
        const icon = toggleBtn.querySelector('.cf-thresholds-icon');
        if (icon) icon.textContent = isOpen ? '▲' : '▼';
      },
      { signal: this._ctrl.signal }
    );

    return createElement('div', { className: 'cf-thresholds' }, toggleBtn, body);
  }

  // ── Mode Visibility ────────────────────────────────────────────────────────

  /**
   * Shows or hides the score and grade field containers based on the active mode.
   * The field components themselves are unaware of mode — the containers
   * carry the is-hidden class.
   *
   * @param {HTMLElement}               scoreContainer
   * @param {HTMLElement}               gradeContainer
   * @param {'score'|'grade'|'both'}    mode
   */
  _updateModeVisibility(scoreContainer, gradeContainer, mode) {
    const showScore = mode === INPUT_MODES.SCORE || mode === INPUT_MODES.BOTH;
    const showGrade = mode === INPUT_MODES.GRADE || mode === INPUT_MODES.BOTH;
    scoreContainer.classList.toggle('is-hidden', !showScore);
    gradeContainer.classList.toggle('is-hidden', !showGrade);
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  _validate() {
    // Clear all previous errors
    this._container.querySelectorAll('.cf-err').forEach((el) => {
      el.textContent = '';
    });
    this._container
      .querySelectorAll('.input--error')
      .forEach((el) => el.classList.remove('input--error'));
    this._scoreField?.setError(false);
    this._gradePickerField?.setError(false);

    let hasError = false;

    const codeResult = validateCourseCode(this._codeInput?.value.trim() ?? '');
    const titleResult = validateCourseTitle(this._titleInput?.value.trim() ?? '');

    if (!codeResult.valid) {
      this._showFieldError(`cf-code-err-${this._semesterId}`, this._codeInput, codeResult.message);
      hasError = true;
    }
    if (!titleResult.valid) {
      this._showFieldError(
        `cf-title-err-${this._semesterId}`,
        this._titleInput,
        titleResult.message
      );
      hasError = true;
    }

    const modeResult = validateCourseForMode({
      inputMode: this._mode,
      score: this._scoreField?.getValue() ?? null,
      gradeKey: this._gradePickerField?.getValue() ?? null,
      scaleId: this._scaleId,
    });

    if (!modeResult.valid) {
      if (this._modeErr) this._modeErr.textContent = modeResult.message;
      if (this._mode !== INPUT_MODES.GRADE) this._scoreField?.setError(true);
      if (this._mode !== INPUT_MODES.SCORE) this._gradePickerField?.setError(true);
      hasError = true;
    }

    return !hasError;
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  /**
   * @param {HTMLElement} scoreContainer  Needed by _validate() for error classes
   * @param {HTMLElement} gradeContainer
   */
  _submit(_scoreContainer, _gradeContainer) {
    if (!this._validate()) return;

    const code = this._codeInput.value.trim().toUpperCase();
    const title = this._titleInput.value.trim();
    const score = this._scoreField?.getValue() ?? null;
    const gradeKey = this._gradePickerField?.getValue() ?? null;
    const creditUnits = this._cuField?.getValue() ?? 3;

    this._store.dispatch({
      type: 'ADD_COURSE',
      payload: {
        semesterId: this._semesterId,
        course: {
          code,
          title,
          creditUnits,
          inputMode: this._mode,
          score: this._mode !== INPUT_MODES.GRADE ? score : null,
          gradeKey: this._mode !== INPUT_MODES.SCORE ? gradeKey : null,
          scaleId: this._scaleId,
        },
      },
    });

    showToast(`${code} added.`, 'success');
    this._resetForm();
    this.close();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _applyOpenState(formBody, toggleBtn) {
    formBody.classList.toggle('is-open', this._isOpen);
    formBody.setAttribute('aria-hidden', String(!this._isOpen));
    toggleBtn.setAttribute('aria-expanded', String(this._isOpen));
    toggleBtn.classList.toggle('is-open', this._isOpen);

    const icon = toggleBtn.querySelector('.cf-toggle-icon');
    const label = toggleBtn.querySelector('.cf-toggle-label');
    if (icon) icon.textContent = this._isOpen ? '×' : '+';
    if (label) label.textContent = this._isOpen ? 'Close' : 'Add Course';
  }

  _resetForm() {
    if (this._codeInput) this._codeInput.value = '';
    if (this._titleInput) this._titleInput.value = '';
    if (this._modeErr) this._modeErr.textContent = '';
    this._scoreField?.reset();
    this._gradePickerField?.reset();
    this._cuField?.reset();
  }

  _showFieldError(errorId, inputEl, message) {
    inputEl?.classList.add('input--error');
    const errEl = document.getElementById(errorId);
    if (errEl) errEl.textContent = message;
  }
}

// /**
//  * @module CourseForm
//  * @description Standalone, mode-aware, collapsible form for adding and editing courses.
//  *
//  * ── WHY A SEPARATE MODULE? ───────────────────────────────────────────────────
//  *
//  * The previous version embedded the form logic inside SemesterManager, which
//  * violated the Single Responsibility Principle: SemesterManager was responsible
//  * for both "show semester tabs and courses" AND "render and validate the add-
//  * course form". Extracting the form into its own module means:
//  *
//  *   1. SemesterManager shrinks to its true responsibility: tab switching and
//  *      course table rendering.
//  *   2. CourseForm can be independently tested, reused (e.g. in an edit modal),
//  *      and modified without touching the semester display logic.
//  *   3. Adding new form features (e.g. a score history chart) requires only
//  *      editing this file.
//  *
//  * ── THREE INPUT MODES ────────────────────────────────────────────────────────
//  *
//  * 'score'  — Student enters a raw score (0–100). The grade and points are
//  *            shown live as they type. This is the default mode.
//  *
//  * 'grade'  — Student picks a grade letter directly from a visual grid of all
//  *            grade options for the active scale. No score is entered. Useful
//  *            when the student only received a result slip showing "B" without
//  *            a numeric score.
//  *
//  * 'both'   — Student enters both a score AND explicitly confirms (or overrides)
//  *            the grade. The explicit grade takes precedence for GPA. Useful for
//  *            moderated results or courses where the score and assigned grade
//  *            do not match by the standard scale (e.g. a curved exam).
//  *
//  * ── ARCHITECTURE ─────────────────────────────────────────────────────────────
//  *
//  *   CourseForm (class)
//  *   ├── _buildToggleBar()        — the always-visible "Add Course" button
//  *   ├── _buildFormBody()         — the collapsible form content
//  *   │   ├── _buildModeSelector() — three mode tabs (Score / Grade / Both)
//  *   │   ├── _buildScoreField()   — score input + live bar + live grade card
//  *   │   ├── _buildGradePicker()  — visual grid of all grade letters in the scale
//  *   │   ├── _buildCUPills()      — credit unit radio-pill selector
//  *   │   └── _buildThresholds()   — collapsible grade threshold reference table
//  *   ├── _updateModeVisibility()  — shows/hides score vs grade fields per mode
//  *   ├── _validate()              — validates all fields for the current mode
//  *   └── _submit()                — dispatches ADD_COURSE action, resets form
//  *
//  * ── PATTERNS DEMONSTRATED ────────────────────────────────────────────────────
//  * - Encapsulation via class — all form state is internal; callers only call open()/close()/mount()
//  * - Dependency Injection — store and semesterId passed in, not accessed globally
//  * - AbortController — form's own event listeners are cleaned up via _ctrl.signal
//  * - Closure — _buildScoreField returns scoreInput so _submit() can read it directly
//  * - Declarative element factory — createElement() instead of innerHTML for XSS safety
//  */

// import { createElement, clearElement, showToast } from '../../utils/dom.js';
// import {
//   validateCourseCode,
//   validateCourseTitle,
//   validateCourseForMode,
// } from '../../utils/validators.js';
// import { CREDIT_UNITS, INPUT_MODES, DEFAULT_SCALE_ID } from '../../utils/constants.js';
// import { getScale, getGradeEntries, gradeFromScore } from '../../utils/helpers.js';

// export class CourseForm {
//   /**
//    * @param {HTMLElement} containerEl - The DOM element to mount the form into
//    * @param {ReturnType<import('../../core/Store.js').createStore>} store
//    * @param {string}      semesterId  - The semester this form belongs to
//    */
//   constructor(containerEl, store, semesterId) {
//     /** @type {HTMLElement} */ this._container = containerEl;
//     /** @type {typeof store} */ this._store = store;
//     /** @type {string} */ this._semesterId = semesterId;

//     /**
//      * The active grading scale ID. Read from the student profile on each
//      * mount so that changing the scale in Profile & Settings is immediately
//      * reflected in new courses without a page reload.
//      * @type {string}
//      */
//     this._scaleId = store.getState().student?.scaleId ?? DEFAULT_SCALE_ID;

//     /**
//      * Whether the collapsible form body is currently expanded.
//      * This is class-instance state (not in the global Store) because it is
//      * purely a UI preference — it does not affect data or other components.
//      * @type {boolean}
//      */
//     this._isOpen = false;

//     /**
//      * The current input mode (score | grade | both).
//      * Defaults to 'score' — the most common case.
//      * @type {'score'|'grade'|'both'}
//      */
//     this._mode = INPUT_MODES.SCORE;

//     /**
//      * AbortController for this form's own event listeners.
//      * Unlike SemesterManager (which inherits from BaseComponent and uses
//      * addListener()), CourseForm manages its own listeners directly because
//      * it is not a BaseComponent subclass — it is a lightweight helper class.
//      * @type {AbortController}
//      */
//     this._ctrl = new AbortController();

//     /**
//      * Live references to the form's interactive elements, populated during mount().
//      * Storing these as properties avoids repeated querySelector() calls in _submit().
//      * @type {Object}
//      */
//     this._els = {};
//   }

//   // ── Public API ─────────────────────────────────────────────────────────────

//   /**
//    * Renders the form into this._container.
//    * Call once after the container is in the DOM.
//    */
//   mount() {
//     clearElement(this._container);
//     this._scaleId = this._store.getState().student?.scaleId ?? DEFAULT_SCALE_ID;

//     const { toggleBar, toggleBtn } = this._buildToggleBar();
//     const { formBody, els } = this._buildFormBody();

//     // Store element references for _submit() and _validate()
//     this._els = els;

//     // ── Toggle behaviour ─────────────────────────────────────────────────────
//     // One click handler on the toggle button; the formBody visibility is
//     // controlled by toggling the CSS class 'is-open' rather than display:none.
//     // This allows CSS transitions to animate the open/close.
//     toggleBtn.addEventListener(
//       'click',
//       () => {
//         this._isOpen = !this._isOpen;
//         this._applyOpenState(formBody, toggleBtn);
//         if (this._isOpen) {
//           // Focus the first input for accessibility — use rAF to wait for the
//           // CSS transition to complete before trying to focus
//           requestAnimationFrame(() => this._els.codeInput?.focus());
//         }
//       },
//       { signal: this._ctrl.signal }
//     );

//     this._container.append(toggleBar, formBody);
//     this._applyOpenState(formBody, toggleBtn);
//   }

//   /** Removes all DOM and cancels all event listeners. */
//   unmount() {
//     this._ctrl.abort();
//     clearElement(this._container);
//   }

//   /** Programmatically opens the form (e.g. after a semester is created). */
//   open() {
//     if (this._isOpen) return;
//     this._isOpen = true;
//     const btn = this._container.querySelector('.cf-toggle-btn');
//     const body = this._container.querySelector('.cf-form-body');
//     if (btn && body) this._applyOpenState(body, btn);
//   }

//   /** Programmatically closes and resets the form. */
//   close() {
//     this._isOpen = false;
//     const btn = this._container.querySelector('.cf-toggle-btn');
//     const body = this._container.querySelector('.cf-form-body');
//     if (btn && body) {
//       this._applyOpenState(body, btn);
//       this._resetForm();
//     }
//   }

//   // ── Toggle Bar ─────────────────────────────────────────────────────────────

//   /**
//    * Builds the always-visible toggle bar that sits below the course table.
//    * Contains a single "Add Course" / "× Close" button.
//    *
//    * @returns {{ toggleBar: HTMLElement, toggleBtn: HTMLButtonElement }}
//    */
//   _buildToggleBar() {
//     const toggleBtn = createElement(
//       'button',
//       {
//         className: 'cf-toggle-btn btn btn--primary',
//         'aria-expanded': 'false',
//         'aria-controls': `cf-body-${this._semesterId}`,
//       },
//       createElement('span', { className: 'cf-toggle-icon', 'aria-hidden': 'true' }, '+'),
//       createElement('span', { className: 'cf-toggle-label' }, 'Add Course')
//     );

//     const toggleBar = createElement('div', { className: 'cf-toggle-bar' }, toggleBtn);
//     return { toggleBar, toggleBtn };
//   }

//   // ── Form Body ──────────────────────────────────────────────────────────────

//   /**
//    * Builds the entire collapsible form body.
//    * Orchestrates all sub-builders and wires cross-field interactions.
//    *
//    * @returns {{ formBody: HTMLElement, els: Object }}
//    */
//   _buildFormBody() {
//     const scale = getScale(this._scaleId);

//     // ── Sub-sections ─────────────────────────────────────────────────────────
//     const { modeSelector, setMode } = this._buildModeSelector();
//     const { scoreSection, scoreInput, gradeCard } = this._buildScoreField(scale);
//     const { gradeSection, getSelectedGrade, setGradeHighlight } = this._buildGradePicker(scale);
//     const { cuPills, getSelectedCU } = this._buildCUPills();
//     const thresholds = this._buildThresholds(scale);

//     // ── Scale badge (informational) ───────────────────────────────────────────
//     const scaleBadge = createElement(
//       'div',
//       { className: 'cf-scale-badge' },
//       createElement('span', { className: 'cf-scale-badge-label' }, 'Scale:'),
//       createElement('span', { className: 'cf-scale-badge-value' }, scale.label)
//     );

//     // ── Mode change wiring ────────────────────────────────────────────────────
//     // When the mode tab changes, show/hide the appropriate fields.
//     // This is the central piece of the dual-input feature.
//     const onModeChange = (newMode) => {
//       this._mode = newMode;
//       this._updateModeVisibility(scoreSection, gradeSection, newMode);
//     };

//     // ── Score → Grade sync in 'both' mode ────────────────────────────────────
//     // When the user types a score in 'both' mode, automatically highlight the
//     // computed grade in the grade picker so they can see and confirm it.
//     scoreInput.addEventListener(
//       'input',
//       () => {
//         if (this._mode === INPUT_MODES.BOTH && scoreInput.value) {
//           const { letter } = gradeFromScore(Number(scoreInput.value), this._scaleId);
//           setGradeHighlight(letter);
//         }
//       },
//       { signal: this._ctrl.signal }
//     );

//     // ── Code and title inputs ─────────────────────────────────────────────────
//     const codeInput = createElement('input', {
//       id: `cf-code-${this._semesterId}`,
//       className: 'form-input',
//       type: 'text',
//       placeholder: 'CSC 201',
//       maxlength: '15',
//       autocomplete: 'off',
//     });

//     const titleInput = createElement('input', {
//       id: `cf-title-${this._semesterId}`,
//       className: 'form-input',
//       type: 'text',
//       placeholder: 'Data Structures & Algorithms',
//       maxlength: '80',
//     });

//     // Error message spans — empty by default, populated by _validate()
//     const codeErr = createElement('span', {
//       className: 'field-error cf-err',
//       id: `cf-code-err-${this._semesterId}`,
//     });
//     const titleErr = createElement('span', {
//       className: 'field-error cf-err',
//       id: `cf-title-err-${this._semesterId}`,
//     });
//     const modeErr = createElement('span', {
//       className: 'field-error cf-err cf-mode-err',
//       'aria-live': 'polite',
//     });

//     // ── Submit button ─────────────────────────────────────────────────────────
//     const submitBtn = createElement(
//       'button',
//       {
//         className: 'btn btn--primary cf-submit-btn',
//         type: 'button',
//       },
//       '+ Add Course'
//     );

//     submitBtn.addEventListener(
//       'click',
//       () => {
//         this._submit({
//           codeInput,
//           titleInput,
//           gradeCard,
//           getSelectedGrade,
//           getSelectedCU,
//           modeErr,
//         });
//       },
//       { signal: this._ctrl.signal }
//     );

//     // Allow Enter key in text inputs to submit
//     [codeInput, titleInput].forEach((input) => {
//       input.addEventListener(
//         'keydown',
//         (e) => {
//           if (e.key === 'Enter') {
//             this._submit({
//               codeInput,
//               titleInput,
//               gradeCard,
//               getSelectedGrade,
//               getSelectedCU,
//               modeErr,
//             });
//           }
//         },
//         { signal: this._ctrl.signal }
//       );
//     });

//     // ── Assemble ──────────────────────────────────────────────────────────────
//     const formBody = createElement(
//       'div',
//       {
//         className: 'cf-form-body',
//         id: `cf-body-${this._semesterId}`,
//         'aria-hidden': 'true',
//       },
//       createElement(
//         'div',
//         { className: 'cf-form-inner' },
//         createElement(
//           'div',
//           { className: 'cf-form-header' },
//           createElement('p', { className: 'cf-form-title' }, 'Add a Course'),
//           scaleBadge
//         ),

//         // Mode selector tabs
//         modeSelector,

//         // Code + Title row
//         createElement(
//           'div',
//           { className: 'form-row' },
//           createElement(
//             'div',
//             { className: 'form-group form-group--sm' },
//             createElement(
//               'label',
//               { className: 'form-label', for: `cf-code-${this._semesterId}` },
//               'Course Code'
//             ),
//             codeInput,
//             codeErr
//           ),
//           createElement(
//             'div',
//             { className: 'form-group' },
//             createElement(
//               'label',
//               { className: 'form-label', for: `cf-title-${this._semesterId}` },
//               'Course Title'
//             ),
//             titleInput,
//             titleErr
//           )
//         ),

//         // Score field (shown in 'score' and 'both' modes)
//         scoreSection,

//         // Grade picker (shown in 'grade' and 'both' modes)
//         gradeSection,

//         // Error banner for mode-specific validation
//         modeErr,

//         // Credit units
//         cuPills,

//         // Grade threshold reference
//         thresholds,

//         // Submit
//         createElement('div', { className: 'cf-submit-row' }, submitBtn)
//       )
//     );

//     // Wire the mode tabs AFTER the body is assembled so the sections exist

//     modeSelector.addEventListener(
//       'click',
//       (e) => {
//         const tab = e.target.closest('[data-mode]');
//         if (tab) onModeChange(tab.dataset.mode);
//       },
//       { signal: this._ctrl.signal }
//     );

//     // Apply initial visibility
//     this._updateModeVisibility(scoreSection, gradeSection, this._mode);

//     return {
//       formBody,
//       els: { codeInput, titleInput, scoreInput, gradeCard, getSelectedGrade, getSelectedCU },
//     };
//   }

//   // ── Mode Selector ──────────────────────────────────────────────────────────

//   /**
//    * Builds the three-tab mode selector: Score | Grade | Both.
//    *
//    * Uses a <div role="tablist"> with <button role="tab"> children.
//    * The active tab receives is-active; CSS handles the visual.
//    *
//    * @returns {{ modeSelector: HTMLElement, setMode: Function }}
//    */
//   _buildModeSelector() {
//     const modes = [
//       { id: INPUT_MODES.SCORE, label: 'Score', desc: 'Enter raw score; grade computed' },
//       { id: INPUT_MODES.GRADE, label: 'Grade Only', desc: 'Pick grade letter directly' },
//       { id: INPUT_MODES.BOTH, label: 'Score + Grade', desc: 'Enter both; grade overrides' },
//     ];

//     const modeSelector = createElement('div', {
//       className: 'cf-mode-selector',
//       role: 'tablist',
//       'aria-label': 'Grade input mode',
//     });

//     const tabs = modes.map(({ id, label, desc }) => {
//       const tab = createElement(
//         'button',
//         {
//           className: `cf-mode-tab ${id === this._mode ? 'is-active' : ''}`,
//           role: 'tab',
//           'aria-selected': id === this._mode ? 'true' : 'false',
//           'aria-label': `${label}: ${desc}`,
//           dataset: { mode: id },
//           title: desc,
//         },
//         label
//       );

//       return tab;
//     });

//     modeSelector.append(...tabs);

//     // setMode lets external code (e.g. edit modal) pre-select a mode
//     const setMode = (mode) => {
//       tabs.forEach((t) => {
//         const isActive = t.dataset.mode === mode;
//         t.classList.toggle('is-active', isActive);
//         t.setAttribute('aria-selected', String(isActive));
//       });
//       this._mode = mode;
//     };

//     // Internal: update tab highlights when a mode tab is clicked
//     modeSelector.addEventListener('click', (e) => {
//       const tab = e.target.closest('[data-mode]');
//       if (!tab) return;
//       setMode(tab.dataset.mode);
//     });

//     return { modeSelector, setMode };
//   }

//   // ── Score Field ────────────────────────────────────────────────────────────

//   /**
//    * Builds the score input with a live progress bar and a live grade card.
//    *
//    * The grade card updates as the student types, showing:
//    *   - The letter grade (e.g. 'A')
//    *   - The grade point value (e.g. '5.0 pts')
//    *   - A background colour matching the grade (via CSS class on the card)
//    *
//    * This gives immediate visual feedback without any submit action.
//    *
//    * @param {import('../utils/constants.js').GradeScale} scale
//    * @returns {{ scoreSection: HTMLElement, scoreInput: HTMLInputElement, gradeCard: HTMLElement }}
//    */
//   _buildScoreField(scale) {
//     const uid = this._semesterId; // shorthand

//     const scoreInput = createElement('input', {
//       id: `cf-score-${uid}`,
//       className: 'form-input cf-score-input',
//       type: 'number',
//       min: '0',
//       max: '100',
//       placeholder: '75',
//       autocomplete: 'off',
//     });

//     // Progress bar — fills proportionally to the score (0=empty, 100=full)
//     const barFill = createElement('div', {
//       className: 'cf-score-bar-fill',
//       style: { width: '0%' },
//     });
//     const bar = createElement('div', { className: 'cf-score-bar' }, barFill);

//     // Grade card — shows the computed grade letter and point value
//     const gradeLetter = createElement('span', { className: 'cf-grade-letter' }, '—');
//     const gradePts = createElement('span', { className: 'cf-grade-pts' }, '');
//     const gradeCard = createElement(
//       'div',
//       {
//         className: 'cf-grade-card',
//         'aria-live': 'polite',
//         'aria-label': 'Computed grade',
//       },
//       gradeLetter,
//       gradePts
//     );

//     // Live update handler — called on every keystroke in the score input
//     const onScoreInput = () => {
//       const raw = scoreInput.value;
//       if (!raw) {
//         barFill.style.width = '0%';
//         gradeLetter.textContent = '—';
//         gradePts.textContent = '';
//         gradeCard.className = 'cf-grade-card';
//         return;
//       }

//       const n = Math.max(0, Math.min(Number(raw), 100));
//       const { letter, points, cssClass } = gradeFromScore(n, this._scaleId);
//       const modClass = cssClass.replace('grade-badge--', '');

//       barFill.style.width = `${n}%`;
//       gradeLetter.textContent = letter;
//       gradePts.textContent = `${points.toFixed(1)} pts`;
//       gradeCard.className = `cf-grade-card cf-grade-card--${modClass}`;
//     };

//     scoreInput.addEventListener('input', onScoreInput, { signal: this._ctrl.signal });

//     const scoreErr = createElement('span', {
//       className: 'field-error cf-err',
//       id: `cf-score-err-${uid}`,
//     });

//     const scoreSection = createElement(
//       'div',
//       { className: 'cf-score-section' },
//       createElement(
//         'div',
//         { className: 'cf-score-field' },
//         createElement(
//           'label',
//           { className: 'form-label', for: `cf-score-${uid}` },
//           'Score (0–100)'
//         ),
//         scoreInput,
//         scoreErr,
//         bar
//       ),
//       gradeCard
//     );

//     return { scoreSection, scoreInput, gradeCard };
//   }

//   // ── Grade Picker ───────────────────────────────────────────────────────────

//   /**
//    * Builds the grade picker — a visual grid of all grade letters in the active scale.
//    *
//    * Each grade letter is a large clickable button showing the letter and its point
//    * value. Only one can be selected at a time. The selected button receives the
//    * 'is-selected' class (CSS handles the gold ring highlight).
//    *
//    * WHY not a <select>?
//    * A visual grid communicates the relative "weight" of each grade (A > B > C)
//    * far better than a dropdown. Students can see all options simultaneously, which
//    * helps them make informed selections without having to remember the scale.
//    *
//    * @param {import('../utils/constants.js').GradeScale} scale
//    * @returns {{
//    *   gradeSection:     HTMLElement,
//    *   getSelectedGrade: () => string | null,
//    *   setGradeHighlight: (letter: string) => void
//    * }}
//    */
//   _buildGradePicker(scale) {
//     const entries = getGradeEntries(this._scaleId);
//     let selectedGrade = null;
//     const buttons = [];

//     const grid = createElement('div', {
//       className: 'cf-grade-grid',
//       role: 'listbox',
//       'aria-label': 'Select a grade',
//     });

//     entries.forEach((entry) => {
//       const { letter, points, cssClass } = entry;
//       const modClass = cssClass.replace('grade-badge--', '');

//       const btn = createElement(
//         'button',
//         {
//           type: 'button',
//           className: `cf-grade-btn cf-grade-btn--${modClass}`,
//           role: 'option',
//           'aria-selected': 'false',
//           'aria-label': `${letter}: ${points.toFixed(1)} grade points`,
//           dataset: { grade: letter },
//         },
//         createElement('span', { className: 'cf-grade-btn-letter' }, letter),
//         createElement('span', { className: 'cf-grade-btn-pts' }, `${points.toFixed(1)}`)
//       );

//       btn.addEventListener(
//         'click',
//         () => {
//           // Deselect all, then select this one
//           buttons.forEach((b) => {
//             b.classList.remove('is-selected');
//             b.setAttribute('aria-selected', 'false');
//           });
//           btn.classList.add('is-selected');
//           btn.setAttribute('aria-selected', 'true');
//           selectedGrade = letter;
//         },
//         { signal: this._ctrl.signal }
//       );

//       buttons.push(btn);
//       grid.append(btn);
//     });

//     // Allow the score field (in 'both' mode) to pre-highlight a grade
//     const setGradeHighlight = (letter) => {
//       buttons.forEach((b) => {
//         const isMatch = b.dataset.grade === letter;
//         b.classList.toggle('is-suggested', isMatch);
//       });
//     };

//     const gradeSection = createElement(
//       'div',
//       { className: 'cf-grade-section' },
//       createElement('p', { className: 'form-label' }, 'Select Grade'),
//       grid,
//       createElement(
//         'p',
//         { className: 'cf-grade-hint' },
//         'Tip: In "Score + Grade" mode, typing a score suggests the computed grade.'
//       )
//     );

//     return {
//       gradeSection,
//       getSelectedGrade: () => selectedGrade,
//       setGradeHighlight,
//     };
//   }

//   // ── Credit Unit Pills ──────────────────────────────────────────────────────

//   /**
//    * Builds the credit unit selector as radio-styled pill buttons.
//    *
//    * WHY pills instead of a <select>?
//    * The number of credit unit options is small (6) and fixed. Displaying them
//    * as visible pills means the student can see and tap all options without
//    * opening a dropdown — faster and less error-prone on mobile.
//    *
//    * Implementation uses hidden <input type="radio"> elements for accessibility
//    * (keyboard navigation, screen readers) with CSS labels styled as pills.
//    *
//    * @returns {{ cuPills: HTMLElement, getSelectedCU: () => number }}
//    */
//   _buildCUPills() {
//     const uid = this._semesterId;

//     const container = createElement('div', {
//       className: 'cf-cu-row',
//     });

//     const label = createElement('p', { className: 'form-label' }, 'Credit Units');

//     const pillGroup = createElement('div', {
//       className: 'cf-cu-pills',
//       role: 'group',
//       'aria-label': 'Credit units',
//     });

//     let selectedCU = 3; // default

//     CREDIT_UNITS.forEach((cu) => {
//       // Hidden radio input provides native keyboard navigation and
//       // accessibility semantics without any extra JS
//       const radio = createElement('input', {
//         type: 'radio',
//         name: `cf-cu-${uid}`,
//         id: `cf-cu-${uid}-${cu}`,
//         value: String(cu),
//         className: 'cf-cu-radio',
//       });

//       if (cu === 3) {
//         radio.checked = true; // default selection
//       }

//       const pill = createElement(
//         'label',
//         {
//           className: `cf-cu-pill ${cu === 3 ? 'is-selected' : ''}`,
//           for: `cf-cu-${uid}-${cu}`,
//         },
//         radio,
//         String(cu)
//       );

//       radio.addEventListener(
//         'change',
//         () => {
//           selectedCU = cu;
//           pillGroup
//             .querySelectorAll('.cf-cu-pill')
//             .forEach((p) => p.classList.remove('is-selected'));
//           pill.classList.add('is-selected');
//         },
//         { signal: this._ctrl.signal }
//       );

//       pillGroup.append(pill);
//     });

//     container.append(label, pillGroup);

//     return {
//       cuPills: container,
//       getSelectedCU: () => selectedCU,
//     };
//   }

//   // ── Grade Thresholds ───────────────────────────────────────────────────────

//   /**
//    * Builds the collapsible grade threshold reference section.
//    *
//    * Shows all grade letters and their score ranges for the active scale.
//    * This is a read-only reference — it helps students understand what score
//    * range corresponds to each grade without leaving the form.
//    *
//    * @param {import('../utils/constants.js').GradeScale} scale
//    * @returns {HTMLElement}
//    */
//   _buildThresholds(scale) {
//     let isOpen = false;

//     const body = createElement('div', {
//       className: 'cf-thresholds-body',
//       hidden: true,
//     });

//     getGradeEntries(this._scaleId).forEach(({ letter, points, minScore, maxScore, cssClass }) => {
//       body.append(
//         createElement(
//           'div',
//           { className: 'cf-threshold-row' },
//           createElement('span', { className: `grade-badge ${cssClass}` }, letter),
//           createElement('span', { className: 'cf-threshold-range' }, `${minScore}–${maxScore}`),
//           createElement('span', { className: 'cf-threshold-pts' }, `${points.toFixed(1)} pts`)
//         )
//       );
//     });

//     const toggleBtn = createElement(
//       'button',
//       {
//         type: 'button',
//         className: 'cf-thresholds-toggle',
//         'aria-expanded': 'false',
//       },
//       createElement('span', {}, `${scale.label} — Grade Reference`),
//       createElement('span', { className: 'cf-thresholds-icon', 'aria-hidden': 'true' }, '▼')
//     );

//     toggleBtn.addEventListener(
//       'click',
//       () => {
//         isOpen = !isOpen;
//         body.hidden = !isOpen;
//         toggleBtn.setAttribute('aria-expanded', String(isOpen));
//         const icon = toggleBtn.querySelector('.cf-thresholds-icon');
//         if (icon) icon.textContent = isOpen ? '▲' : '▼';
//       },
//       { signal: this._ctrl.signal }
//     );

//     return createElement('div', { className: 'cf-thresholds' }, toggleBtn, body);
//   }

//   // ── Mode Visibility ────────────────────────────────────────────────────────

//   /**
//    * Shows or hides the score field and grade picker based on the active mode.
//    *
//    * CSS handles transitions; this method only toggles the 'is-hidden' class.
//    * Separating visibility logic from the build methods makes each method
//    * easier to reason about in isolation.
//    *
//    * @param {HTMLElement} scoreSection
//    * @param {HTMLElement} gradeSection
//    * @param {'score'|'grade'|'both'} mode
//    */
//   _updateModeVisibility(scoreSection, gradeSection, mode) {
//     const showScore = mode === INPUT_MODES.SCORE || mode === INPUT_MODES.BOTH;
//     const showGrade = mode === INPUT_MODES.GRADE || mode === INPUT_MODES.BOTH;

//     scoreSection.classList.toggle('is-hidden', !showScore);
//     gradeSection.classList.toggle('is-hidden', !showGrade);
//   }

//   // ── Validation ─────────────────────────────────────────────────────────────

//   /**
//    * Validates all fields for the current mode and populates inline error spans.
//    *
//    * @param {{ codeInput, titleInput, scoreInput, getSelectedGrade, modeErr }} refs
//    * @returns {boolean} true if all validations passed
//    */
//   _validate({ codeInput, titleInput, scoreInput, getSelectedGrade, modeErr }) {
//     // Clear all previous errors
//     this._container.querySelectorAll('.cf-err').forEach((el) => {
//       el.textContent = '';
//     });
//     this._container.querySelectorAll('.input--error').forEach((el) => {
//       el.classList.remove('input--error');
//     });

//     let hasError = false;

//     // ── Common field validators ──────────────────────────────────────────────
//     const codeResult = validateCourseCode(codeInput.value.trim());
//     const titleResult = validateCourseTitle(titleInput.value.trim());

//     if (!codeResult.valid) {
//       this._showFieldError(`cf-code-err-${this._semesterId}`, codeInput, codeResult.message);
//       hasError = true;
//     }

//     if (!titleResult.valid) {
//       this._showFieldError(`cf-title-err-${this._semesterId}`, titleInput, titleResult.message);
//       hasError = true;
//     }

//     // ── Mode-specific validator ───────────────────────────────────────────────
//     const modeResult = validateCourseForMode({
//       inputMode: this._mode,
//       score: scoreInput?.value ?? null,
//       gradeKey: getSelectedGrade(),
//       scaleId: this._scaleId,
//     });

//     if (!modeResult.valid) {
//       // Mode errors appear in the central error banner (not tied to a specific input)
//       modeErr.textContent = modeResult.message;
//       // Also mark the relevant input red
//       if (this._mode !== INPUT_MODES.GRADE && scoreInput) {
//         scoreInput.classList.add('input--error');
//       }
//       hasError = true;
//     }

//     return !hasError;
//   }

//   // ── Submit ─────────────────────────────────────────────────────────────────

//   /**
//    * Validates fields and dispatches ADD_COURSE to the store.
//    * Resets the form on success and closes it.
//    *
//    * @param {{ codeInput, titleInput, gradeCard, getSelectedGrade, getSelectedCU, modeErr }} refs
//    */
//   _submit({
//     codeInput,
//     titleInput,
//     scoreInput,
//     gradeCard,
//     getSelectedGrade,
//     getSelectedCU,
//     modeErr,
//   }) {
//     // Re-resolve scoreInput from stored els if not passed (needed when called from keydown handler)
//     const si = scoreInput ?? this._els.scoreInput;

//     const isValid = this._validate({
//       codeInput,
//       titleInput,
//       scoreInput: si,
//       getSelectedGrade,
//       modeErr,
//     });
//     if (!isValid) return;

//     const code = codeInput.value.trim().toUpperCase();
//     const title = titleInput.value.trim();
//     const cu = getSelectedCU();
//     const grade = getSelectedGrade();
//     const score = si?.value ? Number(si.value) : null;

//     this._store.dispatch({
//       type: 'ADD_COURSE',
//       payload: {
//         semesterId: this._semesterId,
//         course: {
//           code,
//           title,
//           creditUnits: cu,
//           inputMode: this._mode,
//           score: this._mode !== INPUT_MODES.GRADE ? score : null,
//           gradeKey: this._mode !== INPUT_MODES.SCORE ? grade : null,
//           scaleId: this._scaleId,
//         },
//       },
//     });

//     showToast(`${code} added.`, 'success');
//     this._resetForm();
//     this.close();
//   }

//   // ── Helpers ────────────────────────────────────────────────────────────────

//   /**
//    * Applies the current open/closed state to the form body and toggle button.
//    * CSS transitions handle the animation; this just sets the classes and ARIA.
//    */
//   _applyOpenState(formBody, toggleBtn) {
//     formBody.classList.toggle('is-open', this._isOpen);
//     formBody.setAttribute('aria-hidden', String(!this._isOpen));
//     toggleBtn.setAttribute('aria-expanded', String(this._isOpen));
//     toggleBtn.classList.toggle('is-open', this._isOpen);

//     const icon = toggleBtn.querySelector('.cf-toggle-icon');
//     const label = toggleBtn.querySelector('.cf-toggle-label');
//     if (icon) icon.textContent = this._isOpen ? '×' : '+';
//     if (label) label.textContent = this._isOpen ? 'Close' : 'Add Course';
//   }

//   /** Resets all form inputs to their default values after a successful submit. */
//   _resetForm() {
//     const { codeInput, titleInput, scoreInput } = this._els;
//     if (codeInput) codeInput.value = '';
//     if (titleInput) titleInput.value = '';
//     if (scoreInput) {
//       scoreInput.value = '';
//       // Reset bar and grade card
//       const barFill = this._container.querySelector('.cf-score-bar-fill');
//       if (barFill) barFill.style.width = '0%';
//       const card = this._container.querySelector('.cf-grade-card');
//       if (card) {
//         card.className = 'cf-grade-card';
//         const letter = card.querySelector('.cf-grade-letter');
//         const pts = card.querySelector('.cf-grade-pts');
//         if (letter) letter.textContent = '—';
//         if (pts) pts.textContent = '';
//       }
//     }

//     // Deselect grade picker
//     this._container.querySelectorAll('.cf-grade-btn').forEach((b) => {
//       b.classList.remove('is-selected', 'is-suggested');
//       b.setAttribute('aria-selected', 'false');
//     });

//     // Reset CU pills to default (3)
//     this._container
//       .querySelectorAll('.cf-cu-pill')
//       .forEach((p) => p.classList.remove('is-selected'));
//     const defaultCU = this._container.querySelector(`[id*="cf-cu-"][id$="-3"]`);
//     if (defaultCU) {
//       defaultCU.checked = true;
//       defaultCU.closest('.cf-cu-pill')?.classList.add('is-selected');
//     }
//   }

//   /**
//    * Shows a validation error for a specific field.
//    * @param {string}      errorId    - ID of the error span element
//    * @param {HTMLElement} inputEl    - The input element to mark as invalid
//    * @param {string}      message    - Error message to display
//    */
//   _showFieldError(errorId, inputEl, message) {
//     inputEl.classList.add('input--error');
//     const errEl = document.getElementById(errorId);
//     if (errEl) errEl.textContent = message;
//   }
// }
