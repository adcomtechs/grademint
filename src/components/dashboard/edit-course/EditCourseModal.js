/**
 * @module EditCourseModal
 * @description Edit-course modal orchestrator.
 *
 * DESIGN:
 *   Follows the same pattern as CourseForm — a thin orchestrator that wires
 *   pre-populated section components and delegates every concern to them.
 *   Sections are shared directly from the course-form module; no duplication.
 *
 * SECTION REUSE:
 *   IdentitySection and ScoreSection accept `initial*` options that pre-fill
 *   their inputs from the existing Course record. The edit modal passes these
 *   options and receives change callbacks — identical to the add flow.
 *
 * LIFECYCLE:
 *   build()   — constructs the modal body DOM tree (sections not yet mounted)
 *   open()    — passes body to openModal(), mounts sections, returns { close }
 *   _destroy() — unmounts sections and cancels all listeners on modal close
 *
 * DOES NOT:
 *   - Contain any input element directly
 *   - Know about validation rules
 *   - Know about the modal overlay mechanics
 */

import { openModal, showToast } from '@/utils/dom.js';
import { createElement } from '@/utils/dom.js';
import { EditCourseFormState } from './EditCourseFormState.js';
import {
  validateCourseFormSnapshot,
  CourseFormErrorDisplay,
  IdentitySection,
  ScoreSection,
} from '../course-form/index.js';
import { scrollToHero } from '@/utils/scroll.js';

export class EditCourseModal {
  /**
   * @param {import('@/domain/Course.js').Course}                    course
   * @param {string}                                                  semId
   * @param {ReturnType<import('@/core/Store.js').createStore>}       store
   */
  constructor(course, semId, store) {
    this._course = course;
    this._semId = semId;
    this._store = store;
    this._state = new EditCourseFormState(course);

    this._identity = null;
    this._score = null;
    this._errorDisplay = null;
    this._modal = null;
    this._ctrl = new AbortController();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Builds the modal body and opens the modal.
   * Sections are mounted after openModal() so their containers are in the DOM.
   */
  open() {
    const scaleId = this._state.scaleId;
    const snap = this._state.snapshot();

    // ── Section instances ────────────────────────────────────────────────────
    this._identity = new IdentitySection({
      initialCode: snap.code,
      initialTitle: snap.title,
      initialCreditUnits: snap.creditUnits,
      onCodeChange: (v) => this._state.setCode(v),
      onTitleChange: (v) => this._state.setTitle(v),
      onCreditUnitChange: (v) => this._state.setCreditUnits(v),
      onEnterKey: () => this._submit(),
    });

    this._score = new ScoreSection({
      scaleId,
      initialScore: snap.score,
      initialOverride: snap.overrideGrade,
      initialOverrideOpen: snap.isOverrideOpen,
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

    // ── Assemble DOM ─────────────────────────────────────────────────────────
    const identityEl = this._identity.build();
    const scoreEl = this._score.build();

    // Save and cancel buttons
    const saveBtn = createElement(
      'button',
      { type: 'button', className: 'btn btn--primary ecm-save-btn' },
      'Save Changes'
    );
    const cancelBtn = createElement(
      'button',
      { type: 'button', className: 'btn btn--ghost' },
      'Cancel'
    );

    const footer = createElement(
      'div',
      { className: 'ecm-footer' },
      createElement('div', { className: 'ecm-footer-actions' }, cancelBtn, saveBtn)
    );

    const body = createElement('div', { className: 'ecm-body' }, identityEl, scoreEl, footer);

    // ── Open modal ───────────────────────────────────────────────────────────
    this._modal = openModal(`Edit — ${this._course.code}`, body, {
      size: 'lg',
      onClose: () => this._destroy(),
    });

    // ── Wire error display ───────────────────────────────────────────────────
    this._errorDisplay = new CourseFormErrorDisplay({
      codeInput: this._identity.codeInput,
      codeErr: this._identity.codeErr,
      titleInput: this._identity.titleInput,
      titleErr: this._identity.titleErr,
      gradeErr: this._score.gradeErr,
      scoreInput: this._score._scoreInput,
      scoreErr: null,
    });

    // ── Field-level error clearing on input ──────────────────────────────────
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

    // ── Button wiring ────────────────────────────────────────────────────────
    saveBtn.addEventListener('click', () => this._submit(), { signal: this._ctrl.signal });
    cancelBtn.addEventListener('click', () => this._modal.close(), { signal: this._ctrl.signal });
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
      type: 'UPDATE_COURSE',
      payload: {
        semesterId: this._semId,
        courseId: this._course.id,
        changes: {
          code: snap.code.toUpperCase(),
          title: snap.title,
          creditUnits: snap.creditUnits,
          inputMode: snap.inputMode,
          scaleId: snap.scaleId,
          score: snap.inputMode !== 'grade' ? snap.score : null,
          gradeKey: snap.inputMode !== 'score' ? snap.overrideGrade : null,
        },
      },
    });

    showToast(`${snap.code.toUpperCase()} updated.`, 'success');
    this._modal.close();
    scrollToHero(); // ← scroll after modal closes
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  _destroy() {
    this._identity?.destroy();
    this._score?.destroy();
    this._ctrl.abort();
    this._identity = null;
    this._score = null;
    this._errorDisplay = null;
    this._modal = null;
  }
}

/**
 * Convenience function — matches the call signature of the old
 * openEditCourseModal() so SemesterManager needs only a one-line change.
 *
 * @param {ReturnType<import('@/core/Store.js').createStore>} store
 * @param {import('@/domain/Course.js').Course}               course
 * @param {string}                                            semId
 */
export function openEditCourseModal(store, course, semId) {
  new EditCourseModal(course, semId, store).open();
}
