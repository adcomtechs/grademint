/**
 * @module faqAccordion
 * @description FAQ accordion with keyboard support.
 *
 * BEHAVIOUR:
 *   Clicking or pressing Enter/Space on a .faq-question toggles that item.
 *   Accordion mode: opening one item closes all others.
 *
 * STATE MODEL:
 *   Item open/closed state is stored in the data-open attribute ("true"/"false")
 *   which drives the CSS max-height transition. aria-expanded mirrors the state
 *   for screen readers.
 *
 * WHY data-open AND aria-expanded?
 *   CSS selectors target [data-open="true"] for the transition.
 *   aria-expanded is the accessibility standard — screen readers use it,
 *   not data-open. Both must be kept in sync.
 */

/**
 * @param {Element}   item      The .faq-item element
 * @param {Element[]} allItems  All .faq-item elements (for accordion close-others)
 */
function _toggle(item, allItems) {
  const isOpen = item.dataset.open === 'true';
  const question = item.querySelector('.faq-question');

  // Close all siblings
  allItems.forEach((other) => {
    if (other === item) return;
    other.dataset.open = 'false';
    other.querySelector('.faq-question')?.setAttribute('aria-expanded', 'false');
  });

  // Toggle this item
  const next = isOpen ? 'false' : 'true';
  item.dataset.open = next;
  question?.setAttribute('aria-expanded', next);
}

/**
 * Mounts click and keyboard event listeners on all FAQ items.
 *
 * @param {Element[]} faqItems  All .faq-item elements
 */
export function initFaqAccordion(faqItems) {
  if (!faqItems.length) return;

  faqItems.forEach((item) => {
    const question = item.querySelector('.faq-question');
    if (!question) return;

    question.addEventListener('click', () => _toggle(item, faqItems));

    question.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        _toggle(item, faqItems);
      }
    });
  });
}
