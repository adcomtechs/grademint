/**
 * @module FatalErrorView
 * @description Reusable fatal-load fallback for entry-point boot failures.
 */

import { clearElement, createElement } from '@/utils/dom.js';

/**
 * Renders a user-safe fatal error state.
 * Technical details are intentionally logged by the caller, not shown here.
 *
 * @param {Element} container
 * @param {{ title?: string, message?: string }} [options]
 */
export function renderFatalErrorView(container, options = {}) {
  clearElement(container);

  const reloadButton = createElement(
    'button',
    {
      className: 'btn btn--primary',
      type: 'button',
      onClick: () => location.reload(),
    },
    'Reload'
  );

  container.append(
    createElement(
      'section',
      {
        className: 'app-fatal-error',
        role: 'alert',
        'aria-live': 'assertive',
        style: {
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--color-danger)',
        },
      },
      createElement('h2', {}, options.title ?? 'Something went wrong'),
      createElement(
        'p',
        {},
        options.message ?? 'GPA Pro could not finish loading. Reload the page to try again.'
      ),
      reloadButton
    )
  );
}
