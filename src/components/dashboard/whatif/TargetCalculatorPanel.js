/**
 * @module TargetCalculatorPanel
 * @description Target CGPA calculator with preset buttons and a slider.
 *
 * Computes the GPA a student must achieve across a given number of planned
 * credit units to reach a chosen target CGPA. Updates the result box
 * reactively as inputs change (debounced on text inputs).
 */

import { BaseComponent } from '../../common/BaseComponent.js';
import { GPACalculatorService } from '@/services/GPACalculatorService.js';
import { Semester } from '@/domain/Semester.js';
import { createElement, clearElement, debounce } from '@/utils/dom.js';
import { formatGPA } from '@/utils/formatters.js';
import { watchState } from '@/utils/selector.js';
import { gpaDifficulty } from '@/utils/gpaColors.js';
import { DEFAULT_SCALE_ID } from '@/utils/constants.js';
import { getScale } from '@/utils/helpers.js';

export class TargetCalculatorPanel extends BaseComponent {
  constructor(container, store) {
    super(container, store);
  }

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
    const semesters = (state.semesters ?? []).map(Semester.fromJSON);
    const scaleId = state.student?.scaleId ?? DEFAULT_SCALE_ID;
    const scale = getScale(scaleId);
    const cgpa = GPACalculatorService.cgpaWithPreviousRecord(semesters, state.previousRecord);
    const stats = GPACalculatorService.aggregateStats(semesters);

    this.container.innerHTML = '';
    this.container.append(this._build(cgpa, stats.totalCU, scaleId, scale));
  }

  _build(cgpa, currentCU, scaleId, scale) {
    const maxGPA = scale.maxGPA;
    const honors = [...scale.honors].sort((a, b) => b.min - a.min).filter((h) => h.min > 0);

    // ── Result box ───────────────────────────────────────────────────────────
    const resultBox = createElement(
      'div',
      { className: 'wi-result-box state-idle' },
      createElement(
        'span',
        { className: 'wi-result-idle-text' },
        'Select a target tier or enter a custom CGPA, then specify planned credit units.'
      )
    );

    // ── Target CGPA slider + number ──────────────────────────────────────────
    const defaultTarget = Math.min(cgpa + 0.5, maxGPA).toFixed(2);

    const targetSlider = createElement('input', {
      type: 'range',
      className: 'wi-slider',
      min: '0',
      max: String(maxGPA),
      step: '0.01',
      value: defaultTarget,
    });
    const targetNumber = createElement('input', {
      type: 'number',
      className: 'form-input wi-slider-number',
      min: '0',
      max: String(maxGPA),
      step: '0.01',
      value: defaultTarget,
    });

    // ── Planned CU ───────────────────────────────────────────────────────────
    const cuInput = createElement('input', {
      type: 'number',
      className: 'form-input',
      min: '1',
      max: '300',
      step: '1',
      value: '30',
    });

    // ── Compute function ─────────────────────────────────────────────────────
    const compute = () => {
      const target = parseFloat(targetNumber.value);
      const planned = parseInt(cuInput.value, 10);

      if (!Number.isFinite(target) || !Number.isFinite(planned) || planned < 1) {
        _setResult(
          resultBox,
          'idle',
          null,
          null,
          'Enter a target CGPA and planned credit units to calculate.'
        );
        return;
      }

      const res = GPACalculatorService.requiredGPAForTarget({
        currentCGPA: cgpa,
        currentCU,
        targetCGPA: target,
        plannedCU: planned,
        scaleId,
      });

      const targetHonor = GPACalculatorService.getHonorClassification(target, scaleId);

      if (!res.achievable && res.requiredGPA > maxGPA) {
        const diff = gpaDifficulty(res.requiredGPA, maxGPA);
        _setResult(
          resultBox,
          'error',
          formatGPA(res.requiredGPA),
          diff,
          `Impossible — would need ${formatGPA(res.requiredGPA)}/${maxGPA.toFixed(2)}, which exceeds the maximum.`,
          targetHonor
        );
        return;
      }

      if (!res.achievable) {
        _setResult(resultBox, 'error', null, null, res.message, targetHonor);
        return;
      }

      if (res.requiredGPA <= 0) {
        _setResult(
          resultBox,
          'already',
          '—',
          { label: 'Already there', cls: 'wi-difficulty--easy' },
          `Your current CGPA of ${formatGPA(cgpa)} already meets your target.`,
          targetHonor
        );
        return;
      }

      const diff = gpaDifficulty(res.requiredGPA, maxGPA);
      const state =
        diff.cls.includes('impossible') || diff.cls.includes('very-hard') ? 'warning' : 'success';

      const mathDetail =
        `Current: ${formatGPA(cgpa)} × ${currentCU} CU = ${(cgpa * currentCU).toFixed(2)} QP. ` +
        `Target: ${target.toFixed(2)} × ${currentCU + planned} CU = ${(target * (currentCU + planned)).toFixed(2)} QP. ` +
        `Required: ${(target * (currentCU + planned) - cgpa * currentCU).toFixed(2)} QP ÷ ${planned} CU = ${formatGPA(res.requiredGPA)}.`;

      _setResult(resultBox, state, formatGPA(res.requiredGPA), diff, mathDetail, targetHonor);
    };

    // ── Preset buttons ────────────────────────────────────────────────────────
    const presetsEl = createElement('div', { className: 'wi-presets' });
    const presetBtns = honors.map((h) => {
      const btn = createElement(
        'button',
        { className: 'wi-preset-btn', type: 'button' },
        createElement('span', { className: 'wi-preset-badge' }, h.badge),
        h.label.replace('Second Class ', '2nd '),
        createElement(
          'span',
          { style: { opacity: '0.65', marginLeft: '0.2rem' } },
          h.min.toFixed(2)
        )
      );
      this.addListener(btn, 'click', () => {
        presetBtns.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        targetSlider.value = String(h.min);
        targetNumber.value = h.min.toFixed(2);
        compute();
      });
      presetsEl.append(btn);
      return btn;
    });

    // ── Sync slider ↔ number ─────────────────────────────────────────────────
    this.addListener(targetSlider, 'input', () => {
      targetNumber.value = parseFloat(targetSlider.value).toFixed(2);
      presetBtns.forEach((b) => b.classList.remove('is-active'));
      compute();
    });
    this.addListener(
      targetNumber,
      'input',
      debounce(() => {
        const v = parseFloat(targetNumber.value);
        if (Number.isFinite(v)) targetSlider.value = String(v);
        presetBtns.forEach((b) => b.classList.remove('is-active'));
        compute();
      }, 250)
    );
    this.addListener(cuInput, 'input', debounce(compute, 250));

    compute(); // initial calculation

    const card = createElement('div', { className: 'wi-card' });
    card.append(
      createElement('h3', { className: 'wi-section-title' }, '🔢 Target Calculator'),
      createElement(
        'div',
        { className: 'wi-target-layout' },
        presetsEl,
        createElement(
          'div',
          { className: 'wi-calc-inputs' },
          createElement(
            'div',
            { className: 'form-group', style: { margin: 0 } },
            createElement('label', { className: 'form-label' }, 'Target CGPA'),
            createElement(
              'div',
              { className: 'wi-slider-group' },
              createElement('div', { className: 'wi-slider-row' }, targetSlider, targetNumber)
            )
          ),
          createElement(
            'div',
            { className: 'form-group', style: { margin: 0 } },
            createElement('label', { className: 'form-label' }, 'Planned Credit Units'),
            cuInput
          )
        ),
        resultBox
      )
    );

    return card;
  }
}

// ── Module-level helper ────────────────────────────────────────────────────────

/**
 * Updates the result box display.
 * @param {HTMLElement} box
 * @param {'idle'|'success'|'warning'|'error'|'already'} state
 * @param {string|null} gpaVal
 * @param {{ label: string, cls: string }|null} diff
 * @param {string} message
 * @param {{ label: string, badge: string, cssClass: string }|null} [honor]
 */
function _setResult(box, state, gpaVal, diff, message, honor = null) {
  clearElement(box);
  box.className = state === 'idle' ? 'wi-result-box state-idle' : `wi-result-box state-${state}`;

  if (state === 'idle') {
    box.append(createElement('span', { className: 'wi-result-idle-text' }, message));
    return;
  }

  const header = createElement('div', { className: 'wi-result-header' });

  if (gpaVal) {
    header.append(
      createElement(
        'div',
        {},
        createElement('div', { className: 'wi-result-gpa' }, gpaVal),
        createElement('div', { className: 'wi-result-gpa-label' }, 'Required GPA')
      )
    );
  }

  if (diff) {
    header.append(createElement('span', { className: `wi-difficulty ${diff.cls}` }, diff.label));
  }

  const mathEl = createElement('p', { className: 'wi-result-math' });
  mathEl.textContent = message;

  const honorEl = honor
    ? createElement(
        'div',
        { className: `wi-result-honour ${honor.cssClass}` },
        `${honor.badge} Achieving ${honor.label}`
      )
    : null;

  box.append(header, mathEl, honorEl ?? '');
}
