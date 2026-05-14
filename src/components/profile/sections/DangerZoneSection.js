/**
 * @module DangerZoneSection
 * @description Danger Zone — full data reset with two-step confirmation.
 *
 * DESIGN:
 *   Red card accent visually separates this from safe profile operations.
 *   Two-step friction: "Reset All Data" → modal → "Yes, Delete Everything".
 *   Both clicks require deliberate intent. There is no undo.
 *
 * RESET SEQUENCE (see ResetService.js — ADR-005):
 *   1. IDB cleared (async) — failure aborts the sequence, store is untouched
 *   2. Store dispatches RESET_ALL → reducer returns initialState
 *   3. localStorage UI cache cleared
 *
 * MODAL WIRING:
 *   Buttons hold a direct reference to `modal` via a mutable `let` variable
 *   (closure pattern). No ID-based document.getElementById() is used,
 *   eliminating ID collision risk and the need for requestAnimationFrame
 *   to wait for DOM insertion.
 *
 * LOGGING:
 *   Uses createLogger() — zero raw console.* calls.
 *   Reset failures are recorded at ERROR level with the full Error object.
 */

import { BaseComponent } from '../../common/BaseComponent.js';
import { createElement, openModal, showToast } from '@/utils/dom.js';
import { watchState } from '@/utils/selector.js';
import { resetApp } from '@/services/ResetService.js';
import { getIdb } from '@/core/bootstrap.js';
import { createLogger } from '@/utils/logger.js';

const log = createLogger('DangerZoneSection');

export class DangerZoneSection extends BaseComponent {
  constructor(container, store, options = {}) {
    super(container, store);
    this._onSave = options.onSave ?? null;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  afterMount() {
    // Re-render only when semester count changes so the scope text stays accurate.
    const unsub = watchState(
      this.store,
      (s) => s.semesters.length,
      () => this.safeRender()
    );
    this.addSubscription(unsub);
  }

  render() {
    const { semesters } = this.store.getState();
    const courseCount = semesters.reduce((n, s) => n + (s.courses?.length ?? 0), 0);

    this.container.innerHTML = '';
    this.container.append(this._build(semesters, courseCount));
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  /**
   * @param {Array<*>} semesters
   * @param {number}   courseCount
   * @returns {HTMLElement}
   */
  _build(semesters, courseCount) {
    const hasSemesters = semesters.length > 0;

    const scopeText = hasSemesters
      ? `This will permanently delete ${semesters.length} semester${semesters.length !== 1 ? 's' : ''}, ` +
        `${courseCount} course${courseCount !== 1 ? 's' : ''}, your student profile, and all settings.`
      : 'This will permanently delete your student profile and all settings.';

    const resetBtn = createElement(
      'button',
      {
        className: 'btn btn--danger btn--sm',
        type: 'button',
        onClick: () => this._openConfirmModal(semesters, courseCount),
      },
      createElement('span', { className: 'btn-icon', 'aria-hidden': 'true' }, '🗑'),
      'Reset All Data'
    );

    return createElement(
      'div',
      { className: 'pv-card pv-card--danger' },
      createElement(
        'div',
        { className: 'pv-danger-header' },
        createElement(
          'div',
          { className: 'pv-danger-title-group' },
          createElement('h3', { className: 'pv-danger-title' }, '⚠ Danger Zone'),
          createElement('p', { className: 'pv-danger-desc' }, scopeText)
        ),
        resetBtn
      )
    );
  }

  // ── Reset confirmation modal ───────────────────────────────────────────────

  /**
   * Opens the two-step confirmation modal.
   *
   * The `modal` variable is declared with `let` so both button onClick handlers
   * can close it via closure — no document.getElementById() required.
   *
   * @param {Array<*>} semesters
   * @param {number}   courseCount
   */
  _openConfirmModal(semesters, courseCount) {
    const modalRef = { current: null };

    const cancelBtn = createElement(
      'button',
      {
        className: 'btn btn--ghost',
        type: 'button',
        onClick: () => modalRef.current?.close(),
      },
      'Cancel — Keep My Data'
    );

    const confirmBtn = createElement(
      'button',
      {
        className: 'btn btn--danger',
        type: 'button',
        onClick: () => this._executeReset(confirmBtn, () => modalRef.current?.close()),
      },
      '🗑 Yes, Delete Everything'
    );

    const body = this._buildConfirmBody(semesters, courseCount, cancelBtn, confirmBtn);

    modalRef.current = openModal('Reset All Data', body, { size: 'sm' });
  }

  /**
   * @param {Array<*>}           semesters
   * @param {number}             courseCount
   * @param {HTMLButtonElement}  cancelBtn
   * @param {HTMLButtonElement}  confirmBtn
   * @returns {HTMLElement}
   */
  _buildConfirmBody(semesters, courseCount, cancelBtn, confirmBtn) {
    return createElement(
      'div',
      { className: 'pv-confirm-body' },

      // Scope list — concrete numbers, not vague "all data"
      createElement(
        'div',
        { className: 'pv-confirm-scope' },
        createElement(
          'p',
          { className: 'pv-confirm-lead' },
          'The following will be permanently deleted:'
        ),
        createElement(
          'ul',
          { className: 'pv-confirm-list' },
          createElement(
            'li',
            {},
            `${semesters.length} semester${semesters.length !== 1 ? 's' : ''} and ` +
              `${courseCount} course record${courseCount !== 1 ? 's' : ''}`
          ),
          createElement('li', {}, 'Student profile (name, matric number, department, level)'),
          createElement('li', {}, 'Grading scale preference and previous institutional record'),
          createElement('li', {}, 'All data in IndexedDB — this cannot be recovered')
        )
      ),

      // Consequence statement
      createElement(
        'p',
        { className: 'pv-confirm-warning' },
        '⚠ This action is irreversible. There is no undo.'
      ),

      // Action row
      createElement('div', { className: 'modal-actions' }, cancelBtn, confirmBtn)
    );
  }

  // ── Reset execution ────────────────────────────────────────────────────────

  /**
   * Runs the full data reset sequence.
   * Disables the confirm button during the async operation to prevent
   * double-clicks. Restores the button on failure so the user can retry.
   *
   * @param {HTMLButtonElement} confirmBtn
   * @param {() => void}        closeModal
   */
  async _executeReset(confirmBtn, closeModal) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting…';

    try {
      await resetApp(this.store, getIdb());
      closeModal();
      showToast('All data has been deleted. Starting fresh.', 'info', 5000);
      this._onSave?.(); // ← navigate back to dashboard
    } catch (err) {
      log.error('Reset failed — IndexedDB could not be cleared', err);
      confirmBtn.disabled = false;
      confirmBtn.textContent = '🗑 Yes, Delete Everything';
      showToast('Reset failed — storage could not be cleared. Please try again.', 'error');
    }
  }
}
