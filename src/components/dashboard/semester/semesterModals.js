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
