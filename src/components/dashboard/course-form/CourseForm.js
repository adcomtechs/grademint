/**
 * @module CourseForm
 * @description Collapsible course entry form — thin orchestrator.
 *
 * RESPONSIBILITIES (exactly three):
 *   1. Build and manage the toggle bar (open / close the form)
 *   2. Wire the four sections: IdentitySection, ScoreSection, FormFooter
 *   3. Orchestrate submit: validate → dispatch → reset → close
 *
 * DOES NOT:
 *   - Own any input element directly — each section owns its own DOM
 *   - Perform validation — delegates to CourseFormValidator
 *   - Render error messages — delegates to CourseFormErrorDisplay
 *   - Know what store dispatch looks like beyond calling store.dispatch()
 *
 * SECTION OWNERSHIP:
 *   Each section is instantiated with callbacks so it can notify CourseForm
 *   of changes. CourseForm writes to CourseFormState on each callback.
 *   At submit time CourseForm reads a snapshot from state — it never
 *   queries input DOM elements directly.
 *
 * PUBLIC API:
 *   mount()   — renders into containerEl, wires everything, ready for use
 *   unmount() — tears down all DOM and event listeners
 *   open()    — programmatically expands the form
 *   close()   — collapses and resets the form
 */

import { createElement, clearElement, showToast } from '@/utils/dom.js';
import { DEFAULT_SCALE_ID } from '@/utils/constants.js';
import { CourseFormState } from './CourseFormState.js';
import { CourseFormErrorDisplay } from './CourseFormErrorDisplay.js';
import { validateCourseFormSnapshot } from './CourseFormValidator.js';
import { IdentitySection } from './sections/IdentitySection.js';
import { ScoreSection } from './sections/ScoreSection.js';
import { FormFooter } from './sections/FormFooter.js';

export class CourseForm {
  /**
   * @param {HTMLElement}                                       containerEl
   * @param {ReturnType<import('@/core/Store.js').createStore>} store
   * @param {string}                                            semesterId
   */
  constructor(containerEl, store, semesterId) {
    this._container = containerEl;
    this._store = store;
    this._semesterId = semesterId;
    this._scaleId = store.getState().student?.scaleId ?? DEFAULT_SCALE_ID;

    this._isOpen = false;
    this._ctrl = new AbortController();

    // State + sections (populated in mount())
    this._state = new CourseFormState();
    this._errorDisplay = null;
    this._identity = null;
    this._score = null;
    this._footer = null;

    // DOM refs for toggle bar
    this._toggleBtn = null;
    this._formBody = null;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  mount() {
    clearElement(this._container);
    this._scaleId = this._store.getState().student?.scaleId ?? DEFAULT_SCALE_ID;

    // Build sections
    this._identity = new IdentitySection({
      onCodeChange: (v) => this._state.setCode(v),
      onTitleChange: (v) => this._state.setTitle(v),
      onCreditUnitChange: (v) => this._state.setCreditUnits(v),
      onEnterKey: () => this._submit(),
    });

    this._score = new ScoreSection({
      scaleId: this._scaleId,
      onScoreChange: (v) => {
        this._state.setScore(v);
        this._errorDisplay?.clearField('score');
        this._errorDisplay?.clearField('grade');
      },
      onOverrideChange: (v) => {
        this._state.setOverrideGrade(v);
        this._errorDisplay?.clearField('grade');
      },
      onOverrideOpenChange: (v) => this._state.setOverrideOpen(v),
    });

    this._footer = new FormFooter({
      scaleId: this._scaleId,
      onSubmit: () => this._submit(),
    });

    // Build DOM
    const { toggleBar, toggleBtn } = this._buildToggleBar();
    this._toggleBtn = toggleBtn;

    const identityEl = this._identity.build();
    const scoreEl = this._score.build();
    const footerEl = this._footer.build();

    // Grade error element lives between score section and footer
    const gradeErrEl = this._score.gradeErr;

    this._formBody = createElement(
      'div',
      {
        className: 'cf2-form-body',
        id: `cf2-body-${this._semesterId}`,
        'aria-hidden': 'true',
      },
      createElement(
        'div',
        { className: 'cf2-form-inner' },
        this._buildFormHeader(),
        identityEl,
        scoreEl,
        footerEl
      )
    );

    // Wire error display now that all DOM refs exist
    this._errorDisplay = new CourseFormErrorDisplay({
      codeInput: this._identity.codeInput,
      codeErr: this._identity.codeErr,
      titleInput: this._identity.titleInput,
      titleErr: this._identity.titleErr,
      gradeErr: gradeErrEl,
      scoreInput: this._score._scoreInput,
      scoreErr: null,
    });

    // Clear individual field errors on input
    this._identity.codeInput?.addEventListener(
      'input',
      () => {
        this._errorDisplay.clearField('code');
      },
      { signal: this._ctrl.signal }
    );

    this._identity.titleInput?.addEventListener(
      'input',
      () => {
        this._errorDisplay.clearField('title');
      },
      { signal: this._ctrl.signal }
    );

    this._container.append(toggleBar, this._formBody);
    this._applyOpenState();
  }

  unmount() {
    this._identity?.destroy();
    this._score?.destroy();
    this._footer?.destroy();
    this._ctrl.abort();
    clearElement(this._container);
  }

  /** Programmatically opens the form (e.g. after semester creation). */
  open() {
    if (this._isOpen) return;
    this._isOpen = true;
    this._applyOpenState();
    this._identity?.focus();
  }

  /** Collapses and resets the form. */
  close() {
    this._isOpen = false;
    this._applyOpenState();
    this._reset();
  }

  // ── Build helpers ──────────────────────────────────────────────────────────

  _buildFormHeader() {
    return createElement(
      'div',
      { className: 'cf2-form-header' },
      createElement('h4', { className: 'cf2-form-title' }, 'Add a Course')
    );
  }

  _buildToggleBar() {
    const toggleBtn = createElement(
      'button',
      {
        type: 'button',
        className: 'btn btn--primary cf2-toggle-btn',
        'aria-expanded': 'false',
        'aria-controls': `cf2-body-${this._semesterId}`,
      },
      createElement('span', { className: 'cf2-toggle-icon', 'aria-hidden': 'true' }, '+'),
      createElement('span', { className: 'cf2-toggle-label' }, 'Add Course')
    );

    toggleBtn.addEventListener(
      'click',
      () => {
        this._isOpen = !this._isOpen;
        this._applyOpenState();
        if (this._isOpen) this._identity?.focus();
      },
      { signal: this._ctrl.signal }
    );

    return {
      toggleBar: createElement('div', { className: 'cf2-toggle-bar' }, toggleBtn),
      toggleBtn,
    };
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  _submit() {
    this._errorDisplay?.clear();
    const snap = this._state.snapshot();
    const result = validateCourseFormSnapshot(snap);

    if (!result.valid) {
      this._errorDisplay?.show(result.errors);
      return;
    }

    this._store.dispatch({
      type: 'ADD_COURSE',
      payload: {
        semesterId: this._semesterId,
        course: {
          code: snap.code.toUpperCase(),
          title: snap.title,
          creditUnits: snap.creditUnits,
          inputMode: snap.inputMode,
          score: snap.inputMode !== 'grade' ? snap.score : null,
          gradeKey: snap.inputMode !== 'score' ? snap.overrideGrade : null,
          scaleId: this._scaleId,
        },
      },
    });

    showToast(`${snap.code.toUpperCase()} added.`, 'success');
    this.close();
  }

  // ── State helpers ──────────────────────────────────────────────────────────

  _reset() {
    this._state.reset();
    this._identity?.reset();
    this._score?.reset();
    this._errorDisplay?.clear();
  }

  _applyOpenState() {
    const open = this._isOpen;

    this._formBody?.classList.toggle('is-open', open);
    this._formBody?.setAttribute('aria-hidden', String(!open));
    this._toggleBtn?.setAttribute('aria-expanded', String(open));
    this._toggleBtn?.classList.toggle('is-open', open);

    const icon = this._toggleBtn?.querySelector('.cf2-toggle-icon');
    const label = this._toggleBtn?.querySelector('.cf2-toggle-label');
    if (icon) icon.textContent = open ? '×' : '+';
    if (label) label.textContent = open ? 'Close' : 'Add Course';
  }
}
