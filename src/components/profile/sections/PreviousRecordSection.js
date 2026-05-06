/**
 * @module PreviousRecordSection
 * @description Previous institutional record form section.
 *
 * PURPOSE:
 * Transfer students or those returning from deferral bring credit units
 * and quality points from a prior institution or session. These are entered
 * here and included in the CGPA calculation via
 * GPACalculatorService.cgpaWithPreviousRecord().
 *
 * REACTIVITY:
 * Subscribes to [semesters, student, previousRecord] so the combined CGPA
 * hint updates whenever the student adds courses — giving live feedback on
 * how the previous record affects their running CGPA.
 *
 * STATE:
 * Unsaved input survives store changes because inputs are only seeded with
 * store values on render(), which is only triggered by watchState — not by
 * user typing. The combined CGPA hint updates reactively via the subscription.
 */

import { BaseComponent } from '@/components/common/BaseComponent.js';
import { GPACalculatorService } from '@/services/GPACalculatorService.js';
import { Semester } from '@/domain/Semester.js';
import { createElement, showToast } from '@/utils/dom.js';
import { formatGPA } from '@/utils/formatters.js';
import { watchState } from '@/utils/selector.js';

export class PreviousRecordSection extends BaseComponent {
  constructor(container, store) {
    super(container, store);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  afterMount() {
    const unsub = watchState(
      this.store,
      (s) => [s.semesters, s.student, s.previousRecord],
      () => this.safeRender()
    );
    this.addSubscription(unsub);
  }

  render() {
    const state = this.store.getState();
    const semesters = state.semesters.map(Semester.fromJSON);

    this.container.innerHTML = '';
    this.container.append(this._build(semesters, state.previousRecord));
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  _build(semesters, previousRecord) {
    const hasPrev = previousRecord.creditUnits > 0;
    const cgpaWithPrev = GPACalculatorService.cgpaWithPreviousRecord(semesters, previousRecord);

    // ── Inputs ────────────────────────────────────────────────────────────────
    const cuInput = createElement('input', {
      id: 'pv-prev-cu',
      className: 'form-input',
      type: 'number',
      value: String(previousRecord.creditUnits ?? 0),
      placeholder: '0',
      min: '0',
      step: '1',
    });

    const qpInput = createElement('input', {
      id: 'pv-prev-qp',
      className: 'form-input',
      type: 'number',
      value: String(previousRecord.qualityPoints ?? 0),
      placeholder: '0.00',
      min: '0',
      step: '0.01',
    });

    // ── Combined CGPA hint ────────────────────────────────────────────────────
    const hint = hasPrev
      ? createElement(
          'p',
          { className: 'form-hint' },
          'Combined CGPA (current + previous): ',
          createElement(
            'strong',
            { style: { color: 'var(--color-gold)' } },
            formatGPA(cgpaWithPrev)
          )
        )
      : createElement(
          'p',
          { className: 'form-hint' },
          'Leave at 0 if you have no carry-over credits from another institution or session.'
        );

    // ── Buttons ───────────────────────────────────────────────────────────────
    const saveBtn = createElement(
      'button',
      {
        className: 'btn btn--primary btn--sm',
        type: 'button',
        onClick: () => this._handleSave(cuInput, qpInput),
      },
      'Save Record'
    );

    const clearBtn = hasPrev
      ? createElement(
          'button',
          {
            className: 'btn btn--ghost btn--sm',
            type: 'button',
            onClick: () => this._handleClear(),
          },
          'Clear'
        )
      : null;

    // ── Assemble ──────────────────────────────────────────────────────────────
    return createElement(
      'div',
      { className: 'pv-card' },
      createElement('h3', { className: 'pv-card-title' }, '📌 Previous Institutional Record'),
      createElement(
        'p',
        { className: 'pv-card-desc' },
        'Transfer students: enter credit units and quality points earned at your previous institution to include them in your CGPA.'
      ),

      createElement(
        'div',
        { className: 'pv-form-row' },
        createElement(
          'div',
          { className: 'form-group' },
          createElement(
            'label',
            { className: 'form-label', for: 'pv-prev-cu' },
            'Credit Units Earned'
          ),
          cuInput
        ),
        createElement(
          'div',
          { className: 'form-group' },
          createElement(
            'label',
            { className: 'form-label', for: 'pv-prev-qp' },
            'Quality Points Earned'
          ),
          qpInput
        )
      ),

      hint,
      createElement('div', { className: 'pv-actions' }, clearBtn, saveBtn)
    );
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  _handleSave(cuInput, qpInput) {
    const cu = Number(cuInput.value);
    const qp = Number(qpInput.value);

    if (!Number.isFinite(cu) || !Number.isFinite(qp) || cu < 0 || qp < 0) {
      showToast('Please enter valid non-negative numbers.', 'error');
      return;
    }

    this.store.dispatch({
      type: 'SET_PREVIOUS_RECORD',
      payload: { creditUnits: cu, qualityPoints: qp },
    });
    showToast('Previous record updated.', 'success');
  }

  _handleClear() {
    this.store.dispatch({
      type: 'SET_PREVIOUS_RECORD',
      payload: { creditUnits: 0, qualityPoints: 0 },
    });
    showToast('Previous record cleared.', 'info');
  }
}
