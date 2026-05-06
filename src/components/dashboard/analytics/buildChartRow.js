/**
 * @module analytics/buildChartRow
 * @description Renders the two-canvas chart row for AnalyticsPanel.
 *
 * Canvas IDs ('ap-trend-canvas', 'ap-dist-canvas') are stable across renders.
 * ChartRenderer targets them inside a requestAnimationFrame in AnalyticsPanel.render()
 * after this element has been appended to the DOM.
 */

import { createElement } from '../../../utils/dom.js';

/** @returns {HTMLElement} */
export function buildChartRow() {
  const trendCard = createElement(
    'div',
    { className: 'ap-chart-card' },
    createElement('h3', {}, 'GPA & CGPA Trend'),
    createElement('canvas', { id: 'ap-trend-canvas', style: { height: '200px' } })
  );

  const distCard = createElement(
    'div',
    { className: 'ap-chart-card' },
    createElement('h3', {}, 'Grade Distribution'),
    createElement('canvas', { id: 'ap-dist-canvas' })
  );

  return createElement('div', { className: 'ap-charts-row' }, trendCard, distCard);
}
