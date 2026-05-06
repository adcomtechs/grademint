/**
 * @module RingAnimator
 * @description Pure helper for animating SVG ring fills via stroke-dashoffset.
 *
 * Extracted from GPARings to keep the orchestrator lean. This module has
 * zero dependencies and no side-effects beyond DOM writes — it can be
 * tested in isolation and reused by any component that renders ring SVGs.
 *
 * HOW THE ANIMATION WORKS:
 *   1. CSS custom properties (--circumference, --target-offset) are set on
 *      the <circle> element. The @keyframes ringFillIn rule reads them.
 *   2. Setting `animation: none` then reading `offsetWidth` forces a
 *      browser reflow, resetting the animation timeline so the ring
 *      re-plays from the beginning even when the target value changes.
 *   3. Removing the inline `animation` property restores the CSS class
 *      animation rule, which now plays from the reflow point.
 *
 * WHY maxGPA is a parameter (not hardcoded):
 *   The fill ratio must be relative to the active scale's maximum
 *   (4.0, 5.0, or 7.0). A hardcoded constant would incorrectly fill a
 *   4.0 GPA to 80% on a 4.0-scale when it should fill to 100%.
 */

/**
 * Animates an SVG ring fill by ID.
 *
 * @param {string} id            SVG <circle> element ID
 * @param {number} gpa           Current value (0..maxGPA)
 * @param {number} maxGPA        Scale maximum from getScale().maxGPA
 * @param {number} circumference 2π × r for this ring's radius
 */
export function animateRing(id, gpa, maxGPA, circumference) {
  const el = document.getElementById(id);
  if (!el) return;

  const ratio = Math.max(0, Math.min(gpa / maxGPA, 1));
  const targetOffset = circumference * (1 - ratio);

  el.style.setProperty('--circumference', circumference);
  el.style.setProperty('--target-offset', targetOffset);

  // Void operator: offsetWidth access is intentional for its reflow side-effect.
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.removeProperty('animation');
}

/**
 * Sets textContent of an element by ID.
 * Silent no-op when the element doesn't exist so the component is resilient
 * to partially restructured hero zone markup.
 *
 * @param {string} id
 * @param {string} text
 */
export function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * Sets or removes the hidden attribute on an element by ID.
 *
 * @param {string}  id
 * @param {boolean} hidden
 */
export function setHidden(id, hidden) {
  const el = document.getElementById(id);
  if (!el) return;
  if (hidden) {
    el.hidden = true;
  } else {
    el.removeAttribute('hidden');
  }
}
