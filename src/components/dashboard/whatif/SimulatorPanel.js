/**
 * @module SimulatorPanel
 * @description Semester simulator with projection chart.
 *
 * LOCAL STATE: scenarios[] — managed via this.setState() so each scenario
 * addition/removal triggers a safeRender() without a global store dispatch.
 * The scenarios are ephemeral UI state; they do not persist.
 */

import { BaseComponent } from '../../common/BaseComponent.js';
import { GPACalculatorService } from '../../../services/GPACalculatorService.js';
import { ChartRenderer } from '../ChartRenderer.js';
import { Semester } from '../../../domain/Semester.js';
import { createElement } from '../../../utils/dom.js';
import { formatGPA } from '../../../utils/formatters.js';
import { watchState } from '../../../utils/selector.js';
import { gpaColor } from '../../../utils/gpaColors.js';
import { DEFAULT_SCALE_ID } from '../../../utils/constants.js';
import { getScale } from '../../../utils/helpers.js';

export class SimulatorPanel extends BaseComponent {
  constructor(container, store) {
    super(container, store);
  }

  afterMount() {
    // Initialise local scenarios state
    if (!this.localState.scenarios) {
      this.setState({ scenarios: [] });
    }

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
    const scenarios = this.localState.scenarios ?? [];

    this.container.innerHTML = '';
    this.container.append(this._build(cgpa, stats, scaleId, scale, semesters, scenarios));
  }

  _build(cgpa, stats, scaleId, scale, realSemesters, scenarios) {
    const maxGPA = scale.maxGPA;
    const projected = GPACalculatorService.computeProjectedCGPA(cgpa, stats.totalCU, scenarios);
    const projHonor = GPACalculatorService.getHonorClassification(projected, scaleId);
    const delta = projected - cgpa;
    const chartPts = GPACalculatorService.buildProjectionPoints(
      realSemesters,
      scenarios,
      cgpa,
      stats.totalCU
    );

    // ── Add-scenario form inputs ──────────────────────────────────────────────
    const labelInput = createElement('input', {
      type: 'text',
      className: 'form-input',
      placeholder: `Hypothetical Sem ${scenarios.length + 1}`,
      maxlength: '40',
    });
    const gpaSlider = createElement('input', {
      type: 'range',
      className: 'wi-slider',
      min: '0',
      max: String(maxGPA),
      step: '0.01',
      value: '3.50',
    });
    const gpaNumber = createElement('input', {
      type: 'number',
      className: 'form-input wi-slider-number',
      min: '0',
      max: String(maxGPA),
      step: '0.01',
      value: '3.50',
    });
    const cuInput = createElement('input', {
      type: 'number',
      className: 'form-input',
      min: '1',
      max: '60',
      step: '1',
      value: '18',
    });

    this.addListener(gpaSlider, 'input', () => {
      gpaNumber.value = parseFloat(gpaSlider.value).toFixed(2);
    });
    this.addListener(gpaNumber, 'input', () => {
      const v = parseFloat(gpaNumber.value);
      if (Number.isFinite(v)) gpaSlider.value = String(Math.min(v, maxGPA));
    });

    // ── Add button ────────────────────────────────────────────────────────────
    const addBtn = createElement(
      'button',
      { className: 'btn btn--primary btn--sm', type: 'button' },
      '+ Add Scenario'
    );
    this.addListener(addBtn, 'click', () => {
      const gpa = parseFloat(gpaNumber.value);
      const cu = parseInt(cuInput.value, 10);
      const lbl =
        labelInput.value.trim() ||
        `Hypothetical Sem ${(this.localState.scenarios?.length ?? 0) + 1}`;
      if (!Number.isFinite(gpa) || gpa < 0 || gpa > maxGPA) return;
      if (!Number.isFinite(cu) || cu < 1) return;
      const next = [...(this.localState.scenarios ?? []), { id: Date.now(), label: lbl, gpa, cu }];
      this.setState({ scenarios: next });
    });

    // ── Projected CGPA display ────────────────────────────────────────────────
    const projSection = createElement(
      'div',
      { className: 'wi-sim-projected' },
      createElement('span', { className: 'wi-sim-proj-val' }, formatGPA(projected)),
      createElement('span', { className: 'wi-sim-proj-label' }, 'Projected CGPA'),
      projHonor
        ? createElement(
            'span',
            { className: `wi-sim-proj-honour ${projHonor.cssClass}` },
            `${projHonor.badge} ${projHonor.label}`
          )
        : null,
      scenarios.length > 0
        ? createElement(
            'span',
            { className: 'wi-sim-proj-delta' },
            `${delta >= 0 ? '+' : ''}${delta.toFixed(3)} from current`
          )
        : createElement(
            'span',
            { className: 'wi-sim-proj-delta' },
            'Add semesters to see projection'
          )
    );

    // ── Scenario list ─────────────────────────────────────────────────────────
    const listEl = createElement('div', { className: 'wi-scenario-list' });
    if (scenarios.length === 0) {
      listEl.append(
        createElement(
          'div',
          { className: 'wi-scenario-empty' },
          'No hypothetical semesters yet — use the form to add one.'
        )
      );
    } else {
      scenarios.forEach((sc, i) => {
        const col = gpaColor(sc.gpa, 0.9);
        const honor = GPACalculatorService.getHonorClassification(sc.gpa, scaleId);
        const item = createElement(
          'div',
          { className: 'wi-scenario-item' },
          createElement('span', { className: 'wi-scenario-idx' }, String(i + 1)),
          createElement('span', { className: 'wi-scenario-name' }, sc.label),
          createElement(
            'span',
            {
              className: 'wi-scenario-tag',
              style: {
                color: col,
                borderColor: col.replace('0.9', '0.3'),
                background: col.replace('0.9', '0.08'),
              },
            },
            `GPA ${sc.gpa.toFixed(2)}`,
            honor ? ` · ${honor.badge}` : ''
          ),
          createElement('span', { className: 'wi-scenario-cu' }, `${sc.cu} CU`),
          createElement(
            'button',
            {
              className: 'wi-scenario-remove',
              title: 'Remove this scenario',
              type: 'button',
              onClick: () => {
                const updated = (this.localState.scenarios ?? []).filter((s) => s.id !== sc.id);
                this.setState({ scenarios: updated });
              },
            },
            '×'
          )
        );
        listEl.append(item);
      });
    }

    // ── Projection chart ──────────────────────────────────────────────────────
    const canvas = createElement('canvas', { style: { height: '160px' } });
    const chartCard =
      chartPts.length >= 2
        ? createElement(
            'div',
            { className: 'wi-chart-card' },
            createElement('h4', {}, 'CGPA Projection'),
            canvas
          )
        : null;

    if (chartCard) {
      requestAnimationFrame(() => ChartRenderer.renderProjectionChart(canvas, chartPts, maxGPA));
    }

    // ── Assemble ──────────────────────────────────────────────────────────────
    const formEl = createElement(
      'div',
      { className: 'wi-sim-form' },
      createElement('p', { className: 'wi-sim-form-title' }, 'Add Hypothetical Semester'),
      createElement(
        'div',
        { className: 'form-group', style: { margin: 0 } },
        createElement('label', { className: 'form-label' }, 'Label (optional)'),
        labelInput
      ),
      createElement(
        'div',
        { className: 'form-group', style: { margin: 0 } },
        createElement('label', { className: 'form-label' }, 'Semester GPA'),
        createElement('div', { className: 'wi-slider-row' }, gpaSlider, gpaNumber)
      ),
      createElement(
        'div',
        { className: 'form-group', style: { margin: 0 } },
        createElement('label', { className: 'form-label' }, 'Credit Units'),
        cuInput
      ),
      addBtn,
      projSection
    );

    const rightEl = createElement('div', { className: 'wi-sim-right' }, listEl, chartCard);

    const card = createElement('div', { className: 'wi-card' });
    card.append(
      createElement('h3', { className: 'wi-section-title' }, '🔭 Semester Simulator'),
      createElement('div', { className: 'wi-sim-layout' }, formEl, rightEl)
    );
    return card;
  }
}
