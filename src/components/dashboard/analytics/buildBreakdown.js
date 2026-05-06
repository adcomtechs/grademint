/**
 * @module analytics/buildBreakdown
 * @description Renders the per-semester breakdown table for AnalyticsPanel.
 *
 * BUG FIX (line 295 in original AnalyticsPanel.js):
 *   Original:  const delta = prev !== null ? sem.gpa - prev.gpa : null;
 *   Problem:   semesters[-1] is `undefined`, not `null`.
 *              The strict `!== null` guard evaluated to true for `undefined`,
 *              so `prev.gpa` was accessed on `undefined` on the first iteration,
 *              throwing: TypeError: Cannot read properties of undefined (reading 'gpa')
 *   Fix:       Guard with `i > 0` — explicit, intention-revealing, and type-safe.
 */

import { createElement } from '../../../utils/dom.js';
import { formatGPA } from '../../../utils/formatters.js';
import { ChartRenderer } from '../ChartRenderer.js';

/**
 * @param {import('../../../domain/Semester.js').Semester[]} semesters
 * @param {Array<{ cgpa: number }>}                         trendData
 * @param {object}                                          scale
 * @param {number}                                          cgpa  - programme CGPA
 * @returns {HTMLElement}
 */
export function buildBreakdown(semesters, trendData, scale, cgpa) {
  const section = createElement('div');
  section.append(createElement('h3', { className: 'ap-section-title' }, '📊 Semester Breakdown'));

  // ── Table head ─────────────────────────────────────────────────────────────
  const thead = createElement(
    'thead',
    {},
    createElement(
      'tr',
      {},
      ...['#', 'Semester', 'GPA', 'Δ GPA', 'Running CGPA', 'CU', 'QP', 'Courses'].map((h) =>
        createElement('th', { scope: 'col' }, h)
      )
    )
  );

  // ── Table body ─────────────────────────────────────────────────────────────
  const tbody = createElement('tbody');

  semesters.forEach((sem, i) => {
    // FIX: use `i > 0` instead of `prev !== null`.
    // semesters[i - 1] is `undefined` (not `null`) when i === 0,
    // so the original strict null-check silently passed and crashed on .gpa.
    const delta = i > 0 ? sem.gpa - semesters[i - 1].gpa : null;
    const entry = trendData[i];
    const isLatest = i === semesters.length - 1;
    const gpaColor = ChartRenderer._gpaColor(sem.gpa, 1);

    // ── Delta indicator ────────────────────────────────────────────────────
    let deltaEl;
    if (delta === null) {
      deltaEl = createElement('span', { className: 'ap-delta ap-delta--flat' }, '—');
    } else if (Math.abs(delta) < 0.005) {
      deltaEl = createElement('span', { className: 'ap-delta ap-delta--flat' }, '→ 0.00');
    } else {
      const cls = delta > 0 ? 'ap-delta--up' : 'ap-delta--down';
      const icon = delta > 0 ? '↑' : '↓';
      deltaEl = createElement(
        'span',
        { className: `ap-delta ${cls}` },
        icon,
        ` ${Math.abs(delta).toFixed(2)}`
      );
    }

    // ── Row ────────────────────────────────────────────────────────────────
    const row = createElement(
      'tr',
      { className: isLatest ? 'ap-row--latest' : '' },
      createElement('td', { className: 'ap-mono' }, String(i + 1)),
      createElement(
        'td',
        {},
        createElement(
          'span',
          { className: 'ap-sem-name' },
          sem.label,
          isLatest ? createElement('span', { className: 'ap-latest-chip' }, 'Latest') : null
        )
      ),
      createElement(
        'td',
        {},
        createElement(
          'span',
          {
            className: 'ap-gpa-pill',
            style: {
              background: ChartRenderer._gpaColor(sem.gpa, 0.12),
              borderColor: ChartRenderer._gpaColor(sem.gpa, 0.35),
              color: gpaColor,
            },
          },
          formatGPA(sem.gpa)
        )
      ),
      createElement('td', {}, deltaEl),
      createElement(
        'td',
        {},
        createElement('span', { className: 'ap-mono' }, entry ? formatGPA(entry.cgpa) : '—')
      ),
      createElement('td', { className: 'ap-mono' }, String(sem.totalCreditUnits)),
      createElement('td', { className: 'ap-mono' }, sem.totalQualityPoints.toFixed(1)),
      createElement('td', { className: 'ap-mono' }, String(sem.courseCount))
    );

    tbody.append(row);
  });

  // ── Table foot ─────────────────────────────────────────────────────────────
  const totalQP = semesters.reduce((s, sem) => s + sem.totalQualityPoints, 0);
  const totalCU = semesters.reduce((s, sem) => s + sem.totalCreditUnits, 0);
  const totalCourses = semesters.reduce((s, sem) => s + sem.courseCount, 0);

  const tfoot = createElement(
    'tfoot',
    {},
    createElement(
      'tr',
      {},
      createElement('td', { colspan: '2' }, 'Programme Totals'),
      createElement(
        'td',
        {},
        createElement('span', { className: 'ap-cgpa-total' }, formatGPA(cgpa))
      ),
      createElement('td', {}),
      createElement('td', {}, createElement('span', { className: 'ap-mono' }, formatGPA(cgpa))),
      createElement('td', { className: 'ap-mono' }, String(totalCU)),
      createElement('td', { className: 'ap-mono' }, totalQP.toFixed(1)),
      createElement('td', { className: 'ap-mono' }, String(totalCourses))
    )
  );

  const table = createElement('table', { className: 'ap-breakdown-table' }, thead, tbody, tfoot);

  section.append(createElement('div', { className: 'ap-breakdown-wrap' }, table));
  return section;
}
