/**
 * @module dom
 * @description Compatibility barrel for focused DOM utility modules.
 */

export { $, $$, clearElement, createElement } from './elementFactory.js';
export { debounce, throttle } from './timing.js';
export { confirmDialog, openModal } from './modal.js';
export { showToast } from './toast.js';
