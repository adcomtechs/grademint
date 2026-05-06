import { createElement } from '@/utils/dom.js';

export const transcriptActionBarMethods = {
  _buildActionBar(stats) {
    const printBtn = createElement(
      'button',
      {
        className: 'btn btn--ghost btn--sm',
        onClick: () => window.print(),
        'aria-label': 'Print or save transcript as PDF',
      },
      '🖨  Print / Save PDF'
    );

    const meta = [
      stats.semesterCount > 0
        ? `${stats.semesterCount} semester${stats.semesterCount !== 1 ? 's' : ''}`
        : null,
      stats.courseCount > 0 ? `${stats.courseCount} courses` : null,
      stats.totalCU > 0 ? `${stats.totalCU} CU` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    return createElement(
      'div',
      { className: 'tv-action-bar' },
      createElement(
        'div',
        { className: 'tv-action-bar-left' },
        createElement('h2', {}, '📋 Academic Transcript'),
        meta ? createElement('p', {}, meta) : null
      ),
      createElement('div', { className: 'tv-action-btns' }, printBtn)
    );
  },
};
