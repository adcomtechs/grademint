/**
 * @module SensitivityPanel
 * @description Sensitivity analysis grid — "If I average GPA X for N more
 * credit units, my CGPA becomes..."
 */

import { BaseComponent } from '../../common/BaseComponent.js';
import { GPACalculatorService } from '../../../services/GPACalculatorService.js';
import { Semester } from '../../../domain/Semester.js';
import { createElement } from '../../../utils/dom.js';
import { formatGPA } from '../../../utils/formatters.js';
import { watchState } from '../../../utils/selector.js';
import { gpaColor } from '../../../utils/gpaColors.js';
import { DEFAULT_SCALE_ID } from '../../../utils/constants.js';
import { getScale } from '../../../utils/helpers.js';

const COL_CUS = [15, 30, 45, 60, 90, 120];

export class SensitivityPanel extends BaseComponent {
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
    // Row GPA values — unique grade points from the scale, sorted descending
    const rowGPAs = [...scale.grades]
      .map((g) => g.points)
      .filter((v, i, a) => a.indexOf(v) === i && v > 0)
      .sort((a, b) => b - a);

    const thead = createElement(
      'thead',
      {},
      createElement(
        'tr',
        {},
        createElement('th', { scope: 'col' }, 'Avg GPA →'),
        ...COL_CUS.map((cu) => createElement('th', { scope: 'col' }, `+${cu} CU`))
      )
    );

    const tbody = createElement('tbody');
    rowGPAs.forEach((rowGPA) => {
      const honor = GPACalculatorService.getHonorClassification(rowGPA, scaleId);
      const rowLabel = createElement(
        'td',
        {},
        createElement(
          'span',
          { style: { display: 'flex', alignItems: 'center', gap: '0.4rem' } },
          createElement('span', { className: honor?.cssClass ?? '' }, honor?.badge ?? ''),
          createElement(
            'span',
            { style: { fontFamily: 'var(--font-mono,"DM Mono",monospace)', fontSize: '0.78rem' } },
            rowGPA.toFixed(1)
          )
        )
      );

      const cells = COL_CUS.map((cu) => {
        const projected = (cgpa * currentCU + rowGPA * cu) / (currentCU + cu);
        const col = gpaColor(projected, 1);
        const borderCol = gpaColor(projected, 0.35);
        const bgCol = gpaColor(projected, 0.1);

        return createElement(
          'td',
          {},
          createElement(
            'span',
            {
              className: 'wi-sens-cell',
              style: { color: col, borderColor: borderCol, background: bgCol },
            },
            formatGPA(projected)
          )
        );
      });

      tbody.append(createElement('tr', {}, rowLabel, ...cells));
    });

    const table = createElement('table', { className: 'wi-sensitivity-table' }, thead, tbody);

    const card = createElement('div', { className: 'wi-card' });
    card.append(
      createElement('h3', { className: 'wi-section-title' }, '📐 Sensitivity Analysis'),
      createElement(
        'p',
        {
          style: {
            fontSize: '0.78rem',
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-mono,"DM Mono",monospace)',
            marginBottom: '1rem',
            marginTop: '-0.25rem',
          },
        },
        `"If I average GPA X for N more credit units, my CGPA becomes…" (current: ${formatGPA(cgpa)} over ${currentCU} CU)`
      ),
      createElement('div', { className: 'wi-sensitivity-wrap' }, table)
    );

    return card;
  }
}
