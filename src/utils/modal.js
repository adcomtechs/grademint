/**
 * @module modal
 * @description Shared modal controller with focus management.
 *
 * FIX (confirmDialog race):
 *   The previous implementation called resolve(false) from the onClose
 *   callback unconditionally. Because openModal.close() always fires onClose,
 *   clicking "Confirm" triggered: modal.close() → onClose → resolve(false),
 *   which settled the Promise before the button's own resolve(true) ran.
 *   Promises resolve on first call only — so deletion never executed.
 *
 *   Fix: a `_settled` flag inside confirmDialog. Once either button fires,
 *   the flag is set and subsequent onClose calls become no-ops.
 */

import { clearElement, createElement } from './elementFactory.js';

let _activeModalCloseHandler = null;
let _activeTrapHandler = null;
let _previousFocus = null;

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Opens the shared modal with the given title and content.
 *
 * @param {string}                    title
 * @param {HTMLElement | string}      content
 * @param {{
 *   size?:    'sm' | 'md' | 'lg',
 *   onClose?: () => void,
 * }} [opts]
 * @returns {{ close: () => void }}
 */ 
export function openModal(title, content, opts = {}) {
  const overlay = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  const wrapper = document.getElementById('modal-content');
  const closeBtn = document.getElementById('modal-close');

  if (!overlay || !box || !wrapper) {
    throw new Error('Modal HTML structure not found in DOM.');
  }

  _removeActiveHandlers(overlay);
  _previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  box.dataset.size = opts.size ?? 'md';

  clearElement(wrapper);

  const titleEl = createElement(
    'h2',
    {
      className: 'modal-title',
      id: 'modal-heading',
    },
    title
  );

  const body = createElement('div', { className: 'modal-body' });
  if (content instanceof Node) {
    body.append(content);
  } else {
    body.textContent = String(content);
  }

  wrapper.append(titleEl, body);
  overlay.classList.add('is-open');
  document.body.classList.add('modal-open');

  function close() {
    _removeActiveHandlers(overlay);
    overlay.classList.remove('is-open');
    document.body.classList.remove('modal-open');
    opts.onClose?.();
    _previousFocus?.focus?.();
    _previousFocus = null;
  }

  const handler = (e) => {
    if (e.type === 'click' && e.target !== overlay) return;
    if (e.type === 'keydown' && e.key !== 'Escape') return;
    close();
  };

  const trapHandler = (e) => {
    if (e.key !== 'Tab') return;
    _trapFocus(e, box);
  };

  _activeModalCloseHandler = handler;
  _activeTrapHandler = trapHandler;

  overlay.addEventListener('click', handler);
  document.addEventListener('keydown', handler);
  document.addEventListener('keydown', trapHandler);

  if (closeBtn) closeBtn.onclick = close;

  requestAnimationFrame(() => _focusInitialElement(box));

  return { close };
}

/**
 * Confirmation dialog — resolves true (confirmed) or false (cancelled).
 *
 * THE BUG THAT WAS HERE:
 *   Both action buttons called modal.close() which fires onClose → resolve(false).
 *   This settled the Promise before the Confirm button's resolve(true) could run.
 *
 * THE FIX:
 *   A `_settled` flag ensures only the first resolution call counts.
 *   onClose fires resolve(false) only if neither button has already settled it.
 *
 * @param {string} message
 * @param {string} [confirmLabel]
 * @returns {Promise<boolean>}
 */
export function confirmDialog(message, confirmLabel = 'Confirm') {
  return new Promise((resolve) => {
    // ── Settled flag ────────────────────────────────────────────────────────
    // Prevents onClose from resolving false after a button has already
    // resolved the promise in the other direction.
    let _settled = false;

    const settle = (value) => {
      if (_settled) return;
      _settled = true;
      resolve(value);
    };

    // ── Action buttons ───────────────────────────────────────────────────────
    const cancelBtn = createElement(
      'button',
      {
        className: 'btn btn--ghost',
        onClick: () => {
          settle(false); // settle BEFORE close so onClose is a no-op
          modal.close();
        },
      },
      'Cancel'
    );

    const confirmBtn = createElement(
      'button',
      {
        className: 'btn btn--danger',
        onClick: () => {
          settle(true); // settle BEFORE close so onClose is a no-op
          modal.close();
        },
      },
      confirmLabel
    );

    const dialogBody = createElement(
      'div',
      {},
      createElement('p', { className: 'confirm-message confirm-message--danger' }, message),
      createElement('div', { className: 'modal-actions' }, cancelBtn, confirmBtn)
    );

    // onClose fires when the user dismisses via Escape, backdrop click, or
    // the ✕ button — none of which have settled the promise yet.
    const modal = openModal('Confirm Action', dialogBody, {
      size: 'sm',
      onClose: () => settle(false),
    });
  });
}

// ── Private helpers ────────────────────────────────────────────────────────────

function _removeActiveHandlers(overlay) {
  if (_activeModalCloseHandler) {
    overlay.removeEventListener('click', _activeModalCloseHandler);
    document.removeEventListener('keydown', _activeModalCloseHandler);
  }
  if (_activeTrapHandler) {
    document.removeEventListener('keydown', _activeTrapHandler);
  }
  _activeModalCloseHandler = null;
  _activeTrapHandler = null;
}

function _focusInitialElement(box) {
  const target = box.querySelector(
    'input, select, textarea, button:not(.modal-close):not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  const fallback = box.querySelector('.modal-close');
  (target ?? fallback)?.focus?.();
}

function _trapFocus(e, box) {
  const focusable = Array.from(box.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el) =>
      el instanceof HTMLElement &&
      !el.hasAttribute('disabled') &&
      (el.offsetParent !== null || el.getClientRects().length > 0)
  );

  if (focusable.length === 0) {
    e.preventDefault();
    box.focus?.();
    return;
  }

  const first = focusable[0];
  const last = focusable.at(-1);
  const active = document.activeElement;

  if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

// /**
//  * @module modal
//  * @description Shared modal controller with focus management.
//  */

// import { clearElement, createElement } from './elementFactory.js';

// let _activeModalCloseHandler = null;
// let _activeTrapHandler = null;
// let _previousFocus = null;

// const FOCUSABLE_SELECTOR = [
//   'a[href]',
//   'button:not([disabled])',
//   'input:not([disabled])',
//   'select:not([disabled])',
//   'textarea:not([disabled])',
//   '[tabindex]:not([tabindex="-1"])',
// ].join(',');

// /**
//  * Opens the shared modal with the given title and content.
//  * @param {string} title
//  * @param {HTMLElement|string} content - Element or plain text string
//  * @param {{ size?: 'sm'|'md'|'lg', onClose?: Function }} [opts]
//  * @returns {{ close: Function }}
//  */
// export function openModal(title, content, opts = {}) {
//   const overlay = document.getElementById('modal-overlay');
//   const box = document.getElementById('modal-box');
//   const wrapper = document.getElementById('modal-content');
//   const closeBtn = document.getElementById('modal-close');

//   if (!overlay || !box || !wrapper) throw new Error('Modal HTML structure not found.');

//   _removeActiveHandlers(overlay);
//   _previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

//   box.dataset.size = opts.size ?? 'md';

//   clearElement(wrapper);
//   const titleEl = createElement('h2', { className: 'modal-title', id: 'modal-heading' }, title);
//   const body = createElement('div', { className: 'modal-body' });
//   if (content instanceof Node) body.append(content);
//   else body.textContent = String(content);
//   wrapper.append(titleEl, body);

//   overlay.classList.add('is-open');
//   document.body.classList.add('modal-open');

//   function close() {
//     _removeActiveHandlers(overlay);
//     overlay.classList.remove('is-open');
//     document.body.classList.remove('modal-open');
//     opts.onClose?.();
//     _previousFocus?.focus?.();
//     _previousFocus = null;
//   }

//   const handler = (e) => {
//     if (e.type === 'click' && e.target !== overlay) return;
//     if (e.type === 'keydown' && e.key !== 'Escape') return;
//     close();
//   };

//   const trapHandler = (e) => {
//     if (e.key !== 'Tab') return;
//     _trapFocus(e, box);
//   };

//   _activeModalCloseHandler = handler;
//   _activeTrapHandler = trapHandler;
//   overlay.addEventListener('click', handler);
//   document.addEventListener('keydown', handler);
//   document.addEventListener('keydown', trapHandler);
//   if (closeBtn) closeBtn.onclick = close;

//   requestAnimationFrame(() => _focusInitialElement(box));

//   return { close };
// }

// /**
//  * Returns a Promise that resolves to true (confirmed) or false (cancelled).
//  */
// export function confirmDialog(message, confirmLabel = 'Confirm') {
//   return new Promise((resolve) => {
//     const actions = createElement(
//       'div',
//       { className: 'modal-actions' },
//       createElement(
//         'button',
//         {
//           className: 'btn btn--ghost',
//           onClick: () => {
//             modal.close();
//             resolve(false);
//           },
//         },
//         'Cancel'
//       ),
//       createElement(
//         'button',
//         {
//           className: 'btn btn--danger',
//           onClick: () => {
//             modal.close();
//             resolve(true);
//           },
//         },
//         confirmLabel
//       )
//     );

//     const body = createElement(
//       'div',
//       {},
//       createElement('p', { className: 'confirm-message confirm-message--danger' }, message),
//       actions
//     );

//     const modal = openModal('Confirm Action', body, { size: 'sm', onClose: () => resolve(false) });
//   });
// }

// function _removeActiveHandlers(overlay) {
//   if (_activeModalCloseHandler) {
//     overlay.removeEventListener('click', _activeModalCloseHandler);
//     document.removeEventListener('keydown', _activeModalCloseHandler);
//   }
//   if (_activeTrapHandler) {
//     document.removeEventListener('keydown', _activeTrapHandler);
//   }
//   _activeModalCloseHandler = null;
//   _activeTrapHandler = null;
// }

// function _focusInitialElement(box) {
//   const target = box.querySelector(
//     'input, select, textarea, button:not(.modal-close):not([disabled]), [tabindex]:not([tabindex="-1"])'
//   );
//   const fallback = box.querySelector('.modal-close');
//   (target ?? fallback)?.focus?.();
// }

// function _trapFocus(e, box) {
//   const focusable = Array.from(box.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
//     (el) =>
//       el instanceof HTMLElement &&
//       !el.hasAttribute('disabled') &&
//       (el.offsetParent !== null || el.getClientRects().length > 0)
//   );

//   if (focusable.length === 0) {
//     e.preventDefault();
//     box.focus?.();
//     return;
//   }

//   const first = focusable[0];
//   const last = focusable.at(-1);
//   const active = document.activeElement;

//   if (e.shiftKey && active === first) {
//     e.preventDefault();
//     last.focus();
//   } else if (!e.shiftKey && active === last) {
//     e.preventDefault();
//     first.focus();
//   }
// }
