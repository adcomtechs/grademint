/**
 * @module semesterModals
 * @description Pure modal construction functions for semester and course actions.
 *
 * CHANGES FROM PREVIOUS VERSION:
 *   - openEditCourseModal() now delegates to EditCourseModal (new modular class)
 *     instead of building the full modal inline. All edit-form logic lives in
 *     the edit-course/ module.
 *   - confirmDeleteCourse() and confirmDeleteSemester() are unchanged in
 *     signature — the fix for the deletion bug is in modal.js (confirmDialog).
 *
 * EXPORTED FUNCTIONS:
 *   openAddSemesterModal(store)               — add a new semester
 *   openRenameModal(store, id, label)         — rename an existing semester
 *   openEditCourseModal(store, course, semId) — edit an existing course
 *   confirmDeleteSemester(store, id, label)   — confirm semester deletion
 *   confirmDeleteCourse(store, course, semId) — confirm course deletion
 */

import { openModal, confirmDialog, showToast, createElement } from '../../../utils/dom.js';
import { validateSemesterLabel } from '../../../utils/validators.js';
import { openEditCourseModal as _openEditCourseModal } from '../edit-course/index.js';

// ── Add Semester ───────────────────────────────────────────────────────────────

/**
 * @param {ReturnType<import('../../../core/Store.js').createStore>} store
 */
export function openAddSemesterModal(store) {
  const input = createElement('input', {
    id: 'new-sem-input',
    className: 'form-input',
    type: 'text',
    placeholder: '100L First Semester',
    maxlength: '50',
    autocomplete: 'off',
  });

  const errEl = createElement('span', { className: 'field-error' });
  const hintEl = createElement(
    'p',
    { className: 'form-hint' },
    'Examples: "100L First Semester", "200L 2nd Sem", "Year 2 — Session 1"'
  );

  const submitBtn = createElement('button', { className: 'btn btn--primary' }, 'Add Semester');
  const cancelBtn = createElement('button', { className: 'btn btn--ghost' }, 'Cancel');

  const body = createElement(
    'div',
    { className: 'form' },
    createElement(
      'div',
      { className: 'form-group' },
      createElement('label', { className: 'form-label', for: 'new-sem-input' }, 'Semester Name'),
      input,
      errEl,
      hintEl
    ),
    createElement('div', { className: 'modal-actions' }, cancelBtn, submitBtn)
  );

  const modal = openModal('Add New Semester', body, { size: 'sm' });

  cancelBtn.addEventListener('click', () => modal.close());

  const submit = () => {
    const label = input.value.trim();
    const v = validateSemesterLabel(label);
    if (!v.valid) {
      errEl.textContent = v.message;
      input.classList.add('input--error');
      return;
    }
    store.dispatch({ type: 'ADD_SEMESTER', payload: { label } });
    showToast(`"${label}" added.`, 'success');
    modal.close();
  };

  submitBtn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
  requestAnimationFrame(() => input.focus());
}

// ── Rename Semester ────────────────────────────────────────────────────────────

/**
 * @param {ReturnType<import('../../../core/Store.js').createStore>} store
 * @param {string} id
 * @param {string} currentLabel
 */
export function openRenameModal(store, id, currentLabel) {
  const input = createElement('input', {
    id: 'rename-input',
    className: 'form-input',
    type: 'text',
    value: currentLabel,
    maxlength: '50',
  });
  const errEl = createElement('span', { className: 'field-error' });

  const cancelBtn = createElement('button', { className: 'btn btn--ghost' }, 'Cancel');
  const renameBtn = createElement('button', { className: 'btn btn--primary' }, 'Rename');

  const body = createElement(
    'div',
    { className: 'form' },
    createElement(
      'div',
      { className: 'form-group' },
      createElement('label', { className: 'form-label', for: 'rename-input' }, 'Semester Name'),
      input,
      errEl
    ),
    createElement('div', { className: 'modal-actions' }, cancelBtn, renameBtn)
  );

  const modal = openModal('Rename Semester', body, { size: 'sm' });

  cancelBtn.addEventListener('click', () => modal.close());

  renameBtn.addEventListener('click', () => {
    const label = input.value.trim();
    const v = validateSemesterLabel(label);
    if (!v.valid) {
      errEl.textContent = v.message;
      input.classList.add('input--error');
      return;
    }
    store.dispatch({ type: 'UPDATE_SEMESTER_LABEL', payload: { id, label } });
    showToast('Semester renamed.', 'success');
    modal.close();
  });

  requestAnimationFrame(() => input.focus());
}

// ── Edit Course ────────────────────────────────────────────────────────────────

/**
 * Delegates to the modular EditCourseModal class.
 * Signature is identical to the old inline implementation so call sites need
 * no changes.
 *
 * @param {ReturnType<import('../../../core/Store.js').createStore>} store
 * @param {import('../../../domain/Course.js').Course}               course
 * @param {string}                                                    semId
 */
export function openEditCourseModal(store, course, semId) {
  _openEditCourseModal(store, course, semId);
}

// ── Confirm Delete Semester ────────────────────────────────────────────────────

/**
 * NOTE: The confirmDialog deletion bug has been fixed in modal.js — not here.
 * These functions are correct as-is once the Promise settling race is patched.
 *
 * @param {ReturnType<import('../../../core/Store.js').createStore>} store
 * @param {string} id
 * @param {string} label
 */
export async function confirmDeleteSemester(store, id, label) {
  const ok = await confirmDialog(
    `Delete "${label}" and all its courses? This cannot be undone.`,
    'Delete Semester'
  );
  if (!ok) return;
  store.dispatch({ type: 'DELETE_SEMESTER', payload: { id } });
  showToast(`"${label}" deleted.`, 'info');
}

// ── Confirm Delete Course ──────────────────────────────────────────────────────

/**
 * @param {ReturnType<import('../../../core/Store.js').createStore>} store
 * @param {import('../../../domain/Course.js').Course}               course
 * @param {string}                                                    semId
 */
export async function confirmDeleteCourse(store, course, semId) {
  const ok = await confirmDialog(`Delete "${course.code} — ${course.title}"?`, 'Delete Course');
  if (!ok) return;
  store.dispatch({
    type: 'DELETE_COURSE',
    payload: { semesterId: semId, courseId: course.id },
  });
  showToast(`${course.code} removed.`, 'info');
}

// /**
//  * @module semesterModals
//  * @description Pure modal construction functions for semester and course actions.
//  *
//  * DESIGN:
//  * These are plain functions, not a class — they have no lifecycle, no state,
//  * and no DOM persistent between calls. Each function constructs a modal,
//  * wires its action buttons, and returns when the modal closes.
//  *
//  * EXPORTED FUNCTIONS:
//  *   openAddSemesterModal(store)            — add a new semester
//  *   openRenameModal(store, id, label)      — rename an existing semester
//  *   openEditCourseModal(store, course, semId) — edit an existing course
//  *   confirmDeleteSemester(store, id, label)  — confirm semester deletion
//  *   confirmDeleteCourse(store, course, semId) — confirm course deletion
//  *
//  * All functions return void — callers do not need to await them.
//  * The modal system is managed by dom.js (openModal / confirmDialog).
//  */

// import { openModal, confirmDialog, showToast, createElement } from '../../../utils/dom.js';
// import {
//   validateSemesterLabel,
//   validateCourseForMode,
//   runValidators,
// } from '../../../utils/validators.js';
// import { INPUT_MODES, DEFAULT_SCALE_ID } from '../../../utils/constants.js';
// import { getScale, gradeFromScore } from '../../../utils/helpers.js';
// import { ScoreField } from '../fields/ScoreField.js';
// import { GradePickerField } from '../fields/GradePickerField.js';
// import { CreditUnitField } from '../fields/CreditUnitField.js';

// // ── Add Semester ───────────────────────────────────────────────────────────────

// /**
//  * Opens the "Add New Semester" modal.
//  * @param {ReturnType<import('../../../core/Store.js').createStore>} store
//  */
// export function openAddSemesterModal(store) {
//   const input = createElement('input', {
//     id: 'new-sem-input',
//     className: 'form-input',
//     type: 'text',
//     placeholder: '100L First Semester',
//     maxlength: '50',
//     autocomplete: 'off',
//   });
//   const errEl = createElement('span', { className: 'field-error' });
//   const hintEl = createElement(
//     'p',
//     { className: 'form-hint' },
//     'Examples: "100L First Semester", "200L 2nd Sem", "Year 2 — Session 1"'
//   );

//   const submitBtn = createElement('button', { className: 'btn btn--primary' }, 'Add Semester');

//   const cancelBtn = createElement('button', { className: 'btn btn--ghost' }, 'Cancel');

//   const body = createElement(
//     'div',
//     { className: 'form' },
//     createElement(
//       'div',
//       { className: 'form-group' },
//       createElement('label', { className: 'form-label', for: 'new-sem-input' }, 'Semester Name'),
//       input,
//       errEl,
//       hintEl
//     ),
//     createElement('div', { className: 'modal-actions' }, cancelBtn, submitBtn)
//   );

//   const modal = openModal('Add New Semester', body, { size: 'sm' });

//   cancelBtn.addEventListener('click', () => modal.close());

//   const submit = () => {
//     const label = input.value.trim();
//     const v = validateSemesterLabel(label);
//     if (!v.valid) {
//       errEl.textContent = v.message;
//       input.classList.add('input--error');
//       return;
//     }
//     store.dispatch({ type: 'ADD_SEMESTER', payload: { label } });
//     showToast(`"${label}" added.`, 'success');
//     modal.close();
//   };

//   submitBtn.addEventListener('click', submit);
//   input.addEventListener('keydown', (e) => {
//     if (e.key === 'Enter') submit();
//   });

//   requestAnimationFrame(() => input.focus());
// }

// // ── Rename Semester ────────────────────────────────────────────────────────────

// /**
//  * Opens the rename modal for a semester.
//  * @param {ReturnType<import('../../../core/Store.js').createStore>} store
//  * @param {string} id
//  * @param {string} currentLabel
//  */
// export function openRenameModal(store, id, currentLabel) {
//   const input = createElement('input', {
//     id: 'rename-input',
//     className: 'form-input',
//     type: 'text',
//     value: currentLabel,
//     maxlength: '50',
//   });
//   const errEl = createElement('span', { className: 'field-error' });

//   const cancelBtn = createElement('button', { className: 'btn btn--ghost' }, 'Cancel');
//   const renameBtn = createElement('button', { className: 'btn btn--primary' }, 'Rename');

//   const body = createElement(
//     'div',
//     { className: 'form' },
//     createElement(
//       'div',
//       { className: 'form-group' },
//       createElement('label', { className: 'form-label', for: 'rename-input' }, 'Semester Name'),
//       input,
//       errEl
//     ),
//     createElement('div', { className: 'modal-actions' }, cancelBtn, renameBtn)
//   );

//   const modal = openModal('Rename Semester', body, { size: 'sm' });

//   cancelBtn.addEventListener('click', () => modal.close());

//   renameBtn.addEventListener('click', () => {
//     const label = input.value.trim();
//     const v = validateSemesterLabel(label);
//     if (!v.valid) {
//       errEl.textContent = v.message;
//       input.classList.add('input--error');
//       return;
//     }
//     store.dispatch({ type: 'UPDATE_SEMESTER_LABEL', payload: { id, label } });
//     showToast('Semester renamed.', 'success');
//     modal.close();
//   });

//   requestAnimationFrame(() => input.focus());
// }

// /**
//  * Opens the edit modal for an existing course.
//  * Reuses ScoreField, GradePickerField, and CreditUnitField — the same
//  * FormField components used by CourseForm, eliminating all duplication.
//  *
//  * Field components are mounted after the modal body is passed to openModal()
//  * so the containers are in the document when render() runs.
//  * The onClose callback unmounts all three field components cleanly.
//  *
//  * @param {ReturnType<import('../../../core/Store.js').createStore>} store
//  * @param {import('../../../domain/Course.js').Course} course
//  * @param {string} semId
//  */
// export function openEditCourseModal(store, course, semId) {
//   const scaleId = course.scaleId ?? DEFAULT_SCALE_ID;
//   const scale = getScale(scaleId);

//   let editMode = course.inputMode ?? INPUT_MODES.SCORE;

//   // ── Mode selector ──────────────────────────────────────────────────────────
//   const modeTabs = [
//     { id: INPUT_MODES.SCORE, label: 'Score' },
//     { id: INPUT_MODES.GRADE, label: 'Grade Only' },
//     { id: INPUT_MODES.BOTH, label: 'Score + Grade' },
//   ];

//   const modeSelector = createElement('div', { className: 'cf-mode-selector', role: 'tablist' });
//   const tabEls = modeTabs.map(({ id, label }) =>
//     createElement(
//       'button',
//       {
//         className: `cf-mode-tab ${id === editMode ? 'is-active' : ''}`,
//         role: 'tab',
//         'aria-selected': String(id === editMode),
//         dataset: { mode: id },
//       },
//       label
//     )
//   );
//   modeSelector.append(...tabEls);

//   // ── Field containers ───────────────────────────────────────────────────────
//   const scoreContainer = createElement('div', { className: 'cf-field-host' });
//   const gradeContainer = createElement('div', { className: 'cf-field-host' });
//   const cuContainer = createElement('div', { className: 'cf-field-host' });

//   // ── Remaining form elements ────────────────────────────────────────────────
//   const modeErr = createElement('span', { className: 'field-error', 'aria-live': 'polite' });
//   const cancelBtn = createElement('button', { className: 'btn btn--ghost' }, 'Cancel');
//   const saveBtn = createElement('button', { className: 'btn btn--primary' }, 'Save Changes');

//   const body = createElement(
//     'div',
//     { className: 'cf-edit-body' },
//     createElement(
//       'p',
//       { className: 'form-hint', style: { marginBottom: 'var(--space-4)' } },
//       `Scale: ${scale.label}`
//     ),
//     modeSelector,
//     createElement(
//       'div',
//       { className: 'form-group' },
//       createElement('label', { className: 'form-label', for: 'edit-code' }, 'Course Code'),
//       createElement('input', {
//         id: 'edit-code',
//         className: 'form-input',
//         type: 'text',
//         value: course.code,
//         maxlength: '15',
//       })
//     ),
//     createElement(
//       'div',
//       { className: 'form-group' },
//       createElement('label', { className: 'form-label', for: 'edit-title' }, 'Course Title'),
//       createElement('input', {
//         id: 'edit-title',
//         className: 'form-input',
//         type: 'text',
//         value: course.title,
//         maxlength: '80',
//       })
//     ),
//     scoreContainer,
//     gradeContainer,
//     modeErr,
//     cuContainer,
//     createElement('div', { className: 'modal-actions' }, cancelBtn, saveBtn)
//   );

//   // ── Instantiate field components ───────────────────────────────────────────
//   // Instantiated here but mounted AFTER openModal() so containers are in DOM.
//   const scoreField = new ScoreField(scoreContainer, {
//     scaleId,
//     initialScore: course.hasScore ? course.score : null,
//     onScoreChange: (score) => {
//       if (editMode === INPUT_MODES.BOTH && score !== null) {
//         const { letter } = gradeFromScore(score, scaleId);
//         gradePickerField.suggestGrade(letter);
//       }
//     },
//   });

//   const gradePickerField = new GradePickerField(gradeContainer, {
//     scaleId,
//     initialGrade: course.gradeKey ?? null,
//     showHint: false, // hint is redundant in an edit context
//   });

//   const cuField = new CreditUnitField(cuContainer, {
//     initialValue: course.creditUnits,
//   });

//   // ── Mode visibility helper ─────────────────────────────────────────────────
//   const applyModeVisibility = (mode) => {
//     scoreContainer.classList.toggle('is-hidden', mode === INPUT_MODES.GRADE);
//     gradeContainer.classList.toggle('is-hidden', mode === INPUT_MODES.SCORE);
//   };

//   // ── Mode tab wiring ────────────────────────────────────────────────────────
//   modeSelector.addEventListener('click', (e) => {
//     const tab = e.target.closest('[data-mode]');
//     if (!tab) return;
//     editMode = tab.dataset.mode;
//     tabEls.forEach((t) => {
//       const active = t.dataset.mode === editMode;
//       t.classList.toggle('is-active', active);
//       t.setAttribute('aria-selected', String(active));
//     });
//     applyModeVisibility(editMode);
//   });

//   // ── Open modal (mounts DOM) ────────────────────────────────────────────────
//   const modal = openModal(`Edit — ${course.code}`, body, {
//     size: 'md',
//     onClose: () => {
//       // Clean up field components when modal is dismissed
//       scoreField.unmount();
//       gradePickerField.unmount();
//       cuField.unmount();
//     },
//   });

//   cancelBtn.addEventListener('click', () => modal.close());

//   // Mount fields now that their containers are in the document
//   scoreField.mount();
//   gradePickerField.mount();
//   cuField.mount();
//   applyModeVisibility(editMode);

//   // ── Save handler ───────────────────────────────────────────────────────────
//   saveBtn.addEventListener('click', () => {
//     const code = document.getElementById('edit-code')?.value.trim() ?? '';
//     const title = document.getElementById('edit-title')?.value.trim() ?? '';
//     const score = scoreField.getValue();
//     const gradeKey = gradePickerField.getValue();
//     const cu = cuField.getValue();

//     modeErr.textContent = '';

//     const codeV = runValidators(() => ({
//       valid: !!code,
//       message: code ? '' : 'Course code is required.',
//     }));
//     const titleV = runValidators(() => ({
//       valid: !!title,
//       message: title ? '' : 'Course title is required.',
//     }));
//     const modeV = validateCourseForMode({ inputMode: editMode, score, gradeKey, scaleId });

//     if (!codeV.valid || !titleV.valid || !modeV.valid) {
//       modeErr.textContent = [codeV.message, titleV.message, modeV.message]
//         .filter(Boolean)
//         .join(' · ');
//       return;
//     }

//     store.dispatch({
//       type: 'UPDATE_COURSE',
//       payload: {
//         semesterId: semId,
//         courseId: course.id,
//         changes: {
//           code,
//           title,
//           creditUnits: cu,
//           inputMode: editMode,
//           scaleId,
//           score: editMode !== INPUT_MODES.GRADE ? score : null,
//           gradeKey: editMode !== INPUT_MODES.SCORE ? gradeKey : null,
//         },
//       },
//     });

//     showToast(`${code} updated.`, 'success');
//     modal.close();
//   });
// }

// /**
//  * @param {ReturnType<import('../../../core/Store.js').createStore>} store
//  * @param {string} id
//  * @param {string} label
//  */
// export async function confirmDeleteSemester(store, id, label) {
//   const ok = await confirmDialog(
//     `Delete "${label}" and all its courses? This cannot be undone.`,
//     'Delete Semester'
//   );
//   if (!ok) return;
//   store.dispatch({ type: 'DELETE_SEMESTER', payload: { id } });
//   showToast(`"${label}" deleted.`, 'info');
// }

// /**
//  * @param {ReturnType<import('../../../core/Store.js').createStore>} store
//  * @param {import('../../../domain/Course.js').Course} course
//  * @param {string} semId
//  */
// export async function confirmDeleteCourse(store, course, semId) {
//   const ok = await confirmDialog(`Delete "${course.code} — ${course.title}"?`, 'Delete Course');
//   if (!ok) return;
//   store.dispatch({
//     type: 'DELETE_COURSE',
//     payload: { semesterId: semId, courseId: course.id },
//   });
//   showToast(`${course.code} removed.`, 'info');
// }
