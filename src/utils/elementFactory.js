/**
 * @module elementFactory
 * @description Small DOM creation and query helpers.
 */

/** @type {(sel: string, root?: Element|Document) => Element|null} */
export const $ = (sel, root = document) => root.querySelector(sel);

/** @type {(sel: string, root?: Element|Document) => Element[]} */
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * Declarative element factory.
 * Attributes prefixed `on` become addEventListener calls.
 * `dataset` merges into el.dataset. `style` (object) merges into el.style.
 *
 * @param {string} tag
 * @param {Record<string, *>} [attrs]
 * @param {...(string|Node|null|false|undefined)} children
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);

  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'className') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function')
      el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  }

  const flat = children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false);
  el.append(...flat);
  return el;
}

/** Removes all child nodes from an element. */
export function clearElement(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}
