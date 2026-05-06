/**
 * @module analytics/buildInsights
 * @description Renders the Performance Insights section for AnalyticsPanel.
 */

import { createElement } from '../../../utils/dom.js';
import { formatGPA } from '../../../utils/formatters.js';
import { ChartRenderer } from '../ChartRenderer.js';

/**
 * @param {import('../../../domain/Semester.js').Semester[]} semesters
 * @param {object[]}  allCourses  - flat list of all courses across semesters
 * @param {object}    dist        - grade distribution map { [letter]: count }
 * @param {object}    scale       - grading scale object
 * @returns {HTMLElement}
 */
export function buildInsights(semesters, allCourses, dist, scale) {
  const section = createElement('div');
  section.append(createElement('h3', { className: 'ap-section-title' }, '🔍 Performance Insights'));

  const sorted = [...semesters].sort((a, b) => b.gpa - a.gpa);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const avgGPA = semesters.reduce((s, sem) => s + sem.gpa, 0) / semesters.length;
  const avgCU = semesters.length
    ? (semesters.reduce((s, sem) => s + sem.totalCreditUnits, 0) / semesters.length).toFixed(1)
    : '—';

  // ── Grade distribution bars ───────────────────────────────────────────────
  const gradeOrder = scale.grades.map((g) => g.letter);
  const totalCourses = allCourses.length;
  const maxCount = Math.max(...Object.values(dist), 1);

  const distBars = createElement('div', { className: 'ap-grade-bars' });
  gradeOrder.forEach((letter) => {
    const count = dist[letter] ?? 0;
    if (!count) return;
    const pct = (count / maxCount) * 100;
    distBars.append(
      createElement(
        'div',
        { className: 'ap-grade-row' },
        createElement('span', { className: 'ap-grade-letter' }, letter),
        createElement(
          'div',
          { className: 'ap-grade-bar-track' },
          createElement('div', {
            className: 'ap-grade-bar-fill',
            style: {
              width: `${pct}%`,
              background: ChartRenderer._gradeColor(letter) + 'c0',
            },
          })
        ),
        createElement('span', { className: 'ap-grade-count' }, String(count))
      )
    );
  });

  // ── Insight cards ─────────────────────────────────────────────────────────
  const grid = createElement('div', { className: 'ap-insights-grid' });

  // Best semester
  grid.append(
    createElement(
      'div',
      { className: 'ap-insight-card' },
      createElement('span', { className: 'ap-insight-eyebrow' }, '🏆 Best Semester'),
      createElement(
        'span',
        { className: 'ap-insight-val', style: { color: ChartRenderer._gpaColor(best.gpa, 1) } },
        formatGPA(best.gpa)
      ),
      createElement('span', { className: 'ap-insight-sub' }, best.label)
    )
  );

  // Lowest semester (only when > 1 semester recorded)
  if (semesters.length > 1) {
    grid.append(
      createElement(
        'div',
        { className: 'ap-insight-card' },
        createElement('span', { className: 'ap-insight-eyebrow' }, '📉 Lowest Semester'),
        createElement(
          'span',
          {
            className: 'ap-insight-val',
            style: { color: ChartRenderer._gpaColor(worst.gpa, 1) },
          },
          formatGPA(worst.gpa)
        ),
        createElement('span', { className: 'ap-insight-sub' }, worst.label)
      )
    );
  }

  // Average GPA
  grid.append(
    createElement(
      'div',
      { className: 'ap-insight-card' },
      createElement('span', { className: 'ap-insight-eyebrow' }, '📈 Average Sem GPA'),
      createElement(
        'span',
        { className: 'ap-insight-val', style: { color: ChartRenderer._gpaColor(avgGPA, 1) } },
        formatGPA(avgGPA)
      ),
      createElement('span', { className: 'ap-insight-sub' }, `${avgCU} avg CU/sem`)
    )
  );

  // Grade breakdown card
  grid.append(
    createElement(
      'div',
      { className: 'ap-insight-card' },
      createElement(
        'span',
        { className: 'ap-insight-eyebrow' },
        `📚 Grade Breakdown — ${totalCourses} courses`
      ),
      distBars
    )
  );

  section.append(grid);
  return section;
}
