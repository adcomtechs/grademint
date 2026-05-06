/**
 * @module timing
 * @description Browser timing helpers for user-input and scroll work.
 */

/**
 * Debounce — delays `fn` by `wait` ms after the last call.
 * Classic use-case: waiting for user to stop typing before re-calculating.
 */
export function debounce(fn, wait = 300) {
  let id;
  return function debounced(...args) {
    clearTimeout(id);
    id = setTimeout(() => fn.apply(this, args), wait);
  };
}

/**
 * Throttle — `fn` fires at most once per `limit` ms.
 * Classic use-case: scroll/resize handlers.
 */
export function throttle(fn, limit = 100) {
  let last = 0;
  return function throttled(...args) {
    const now = Date.now();
    if (now - last >= limit) {
      last = now;
      return fn.apply(this, args);
    }
  };
}
