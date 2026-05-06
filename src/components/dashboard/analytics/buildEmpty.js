/**
 * @module analytics/buildEmpty
 * @description Renders the empty-state placeholder for AnalyticsPanel.
 */

import { createElement } from '../../../utils/dom.js';

/** @returns {HTMLElement} */
export function buildEmpty() {
  return createElement(
    'div',
    { className: 'ap-empty' },
    createElement('div', { className: 'ap-empty-icon' }, '📊'),
    createElement('h3', {}, 'No Data Yet'),
    createElement(
      'p',
      {},
      'Add your first semester and courses on the Dashboard, then come back here to see your analytics.'
    )
  );
}
