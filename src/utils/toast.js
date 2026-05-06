/**
 * @module toast
 * @description Toast notification rendering.
 */

import { createElement } from './elementFactory.js';

const TOAST_ICONS = { success: '✓', error: '✕', warning: '!', info: 'i' };

/**
 * Displays a transient toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} [type='info']
 * @param {number} [duration=4000]
 */
export function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = createElement(
    'div',
    { className: `toast toast--${type}` },
    createElement('div', { className: 'toast-icon' }, TOAST_ICONS[type] ?? 'i'),
    createElement('p', { className: 'toast-message' }, message),
    createElement(
      'button',
      {
        className: 'toast-dismiss',
        'aria-label': 'Dismiss notification',
        onClick: () => dismiss(),
      },
      '✕'
    )
  );

  container.append(toast);
  requestAnimationFrame(() => toast.classList.add('toast--visible'));

  const timerId = setTimeout(dismiss, duration);

  function dismiss() {
    clearTimeout(timerId);
    toast.classList.remove('toast--visible');
    toast.classList.add('toast--hiding');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }
}
