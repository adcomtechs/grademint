/**
 * @module analytics/buildHeading
 * @description Renders the AnalyticsPanel heading row.
 */

import { createElement } from '../../../utils/dom.js';

/**
 * @param {object} student   - student record from store
 * @param {object} scale     - grading scale object
 * @param {object} stats     - aggregated stats (semesterCount, courseCount, totalCU)
 * @returns {HTMLElement}
 */
export function buildHeading(student, scale, stats) {
  const left = createElement(
    'div',
    {},
    createElement('h2', {}, 'Performance Analytics'),
    createElement(
      'p',
      {},
      `${student.name ? student.name + ' · ' : ''}` +
        `${stats.semesterCount} semester${stats.semesterCount !== 1 ? 's' : ''} · ` +
        `${stats.courseCount} courses · ${stats.totalCU} credit units`
    )
  );

  return createElement(
    'div',
    { className: 'ap-heading-row' },
    left,
    createElement('span', { className: 'ap-scale-pill' }, scale.label)
  );
}
