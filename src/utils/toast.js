/**
 * @module toast
 * @description Toast notification system — production-grade upgrade.
 *
 * UPGRADES OVER THE PREVIOUS VERSION
 * ────────────────────────────────────
 * 1. Progress bar — a .toast-progress element is appended to each toast.
 *    Its CSS animation drains from 100% → 0% over `duration` ms, giving
 *    the user a clear visual signal of how long they have before it vanishes.
 *
 * 2. Pause on hover — mousing over (or touching) a toast pauses the auto-
 *    dismiss timer and freezes the progress bar animation. The timer resumes
 *    with the remaining time when the user leaves. This prevents dismissal
 *    while the user is actively reading.
 *
 * 3. Stack cap — at most MAX_TOASTS are shown at once. The oldest toast is
 *    dismissed before the new one appears, keeping the UI uncluttered even
 *    during rapid sequences of operations.
 *
 * 4. Accessible live region — the container already has role="status"
 *    aria-live="polite" in the HTML. Each toast message text is also set as
 *    the aria-label so screen readers announce it immediately on insertion.
 *
 * DOM produced per toast:
 * ┌ .toast.toast--{type}
 * ├─ div.toast-icon          ← semantic icon character
 * ├─ div.toast-body
 * │  └─ p.toast-message      ← message text
 * ├─ button.toast-dismiss    ← manual dismiss (✕)
 * └─ div.toast-progress      ← auto-drain timer bar
 *
 * @param {string}                              message
 * @param {'success'|'error'|'info'|'warning'}  [type='info']
 * @param {number}                              [duration=4000]  ms
 */

import { createElement } from './elementFactory.js';

// ── Config ─────────────────────────────────────────────────────────────────

const MAX_TOASTS = 5;

const ICONS = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
};

// ── Internal state ──────────────────────────────────────────────────────────

/** Tracks active toasts oldest-first so we can trim the stack. */
const _active = [];

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Shows a toast notification.
 *
 * @param {string}  message
 * @param {'success'|'error'|'info'|'warning'} [type='info']
 * @param {number}  [duration=4000]  Auto-dismiss delay in ms. Pass Infinity
 *                                   to require manual dismissal.
 */
export function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // ── Trim stack ────────────────────────────────────────────────────────────
  if (_active.length >= MAX_TOASTS) {
    _active[0]?.dismiss();
  }

  // ── Build DOM ─────────────────────────────────────────────────────────────
  const icon = ICONS[type] ?? 'i';
  const isFinite = Number.isFinite(duration) && duration > 0;

  const progressEl = createElement('div', {
    className: 'toast-progress',
    'aria-hidden': 'true',
    // Inline CSS custom property lets the animation know its duration
    // without hardcoding it in a keyframe.
    style: isFinite ? { '--toast-duration': `${duration}ms` } : { display: 'none' },
  });

  const toast = createElement(
    'div',
    {
      className: `toast toast--${type}`,
      role: 'status',
      'aria-label': message,
    },
    createElement('div', { className: 'toast-icon', 'aria-hidden': 'true' }, icon),
    createElement(
      'div',
      { className: 'toast-body' },
      createElement('p', { className: 'toast-message' }, message)
    ),
    createElement(
      'button',
      {
        className: 'toast-dismiss',
        type: 'button',
        'aria-label': 'Dismiss notification',
      },
      '✕'
    ),
    progressEl
  );

  // ── Timer logic ───────────────────────────────────────────────────────────
  let timerId = null;
  let remaining = duration;
  let startedAt = null;
  let paused = false;

  function startTimer() {
    if (!isFinite) return;
    startedAt = Date.now();
    timerId = setTimeout(dismiss, remaining);
  }

  function pauseTimer() {
    if (!isFinite || paused) return;
    paused = true;
    clearTimeout(timerId);
    remaining -= Date.now() - startedAt;
    toast.classList.add('toast--paused');
  }

  function resumeTimer() {
    if (!isFinite || !paused) return;
    paused = false;
    toast.classList.remove('toast--paused');
    startTimer();
  }

  function dismiss() {
    clearTimeout(timerId);
    // Remove from active list
    const idx = _active.indexOf(entry);
    if (idx !== -1) _active.splice(idx, 1);

    toast.classList.remove('toast--visible');
    toast.classList.add('toast--hiding');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }

  // Expose dismiss on the entry so the stack-trim path can call it
  const entry = { dismiss };

  // ── Wire events ───────────────────────────────────────────────────────────
  toast.querySelector('.toast-dismiss').addEventListener('click', dismiss);

  // Pause on hover / touch (pointer-based, works for mouse and touch)
  toast.addEventListener('mouseenter', pauseTimer, { passive: true });
  toast.addEventListener('mouseleave', resumeTimer, { passive: true });
  // Focus inside the toast (keyboard nav) also pauses
  toast.addEventListener('focusin', pauseTimer, { passive: true });
  toast.addEventListener('focusout', resumeTimer, { passive: true });

  // ── Mount + animate ───────────────────────────────────────────────────────
  _active.push(entry);
  container.append(toast);

  // Two-frame rAF so the browser paints the initial state before the
  // transition-triggering class is added — guarantees the animation plays.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      toast.classList.add('toast--visible');
      startTimer();
    })
  );
}

// /**
//  * @module toast
//  * @description Toast notification rendering.
//  */

// import { createElement } from './elementFactory.js';

// const TOAST_ICONS = { success: '✓', error: '✕', warning: '!', info: 'i' };

// /**
//  * Displays a transient toast notification.
//  * @param {string} message
//  * @param {'success'|'error'|'info'|'warning'} [type='info']
//  * @param {number} [duration=4000]
//  */
// export function showToast(message, type = 'info', duration = 4000) {
//   const container = document.getElementById('toast-container');
//   if (!container) return;

//   const toast = createElement(
//     'div',
//     { className: `toast toast--${type}` },
//     createElement('div', { className: 'toast-icon' }, TOAST_ICONS[type] ?? 'i'),
//     createElement('p', { className: 'toast-message' }, message),
//     createElement(
//       'button',
//       {
//         className: 'toast-dismiss',
//         'aria-label': 'Dismiss notification',
//         onClick: () => dismiss(),
//       },
//       '✕'
//     )
//   );

//   container.append(toast);
//   requestAnimationFrame(() => toast.classList.add('toast--visible'));

//   const timerId = setTimeout(dismiss, duration);

//   function dismiss() {
//     clearTimeout(timerId);
//     toast.classList.remove('toast--visible');
//     toast.classList.add('toast--hiding');
//     toast.addEventListener('transitionend', () => toast.remove(), { once: true });
//   }
// }
