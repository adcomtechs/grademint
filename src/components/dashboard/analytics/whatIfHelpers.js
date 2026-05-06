/**
 * @module analytics/whatIfHelpers
 * @description Pure DOM helpers used by the What-If calculator section.
 *
 * These are module-level functions with no `this` dependency, making them
 * independently testable and reusable without a class instance.
 */

import { createElement, clearElement } from '../../../utils/dom.js';

/**
 * Updates the What-If result box state in place.
 *
 * @param {HTMLElement}            box     - the result container element
 * @param {'success'|'warning'|'error'} type
 * @param {string}                 icon    - emoji / symbol
 * @param {string}                 message - descriptive text
 * @param {string|null}            [gpaVal] - formatted required GPA, if applicable
 */
export function setWhatIfResult(box, type, icon, message, gpaVal = null) {
  clearElement(box);
  box.className = `ap-whatif-result is-${type}`;

  const msg = createElement('div', { className: 'ap-whatif-msg' });

  if (gpaVal) {
    msg.append(
      createElement('span', { className: 'ap-whatif-gpa-highlight' }, `GPA Required: ${gpaVal}`),
      document.createTextNode(message.replace(/Maintain a GPA of [\d.]+/, '').trim())
    );
  } else {
    msg.textContent = message;
  }

  box.append(createElement('span', { className: 'ap-whatif-icon' }, icon), msg);
}
