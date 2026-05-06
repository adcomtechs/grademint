/**
 * @module TierProgressRenderer
 * @description Renders the progress strip toward the next honour tier.
 *
 * Extracted from GPARings._renderNextTierProgress verbatim, then lifted
 * into a standalone export. All algorithm comments are preserved.
 *
 * ALGORITHM:
 *   1. Find the student's CURRENT tier (lowest tier whose min ≤ cgpa).
 *   2. Find the NEXT tier (the tier immediately above current).
 *   3. Progress % = (cgpa − currentMin) / (nextMin − currentMin).
 *   4. Render bar + text: "Need 0.35 more for First Class Honours".
 *
 * EDGE CASES:
 *   • Already at top tier  → strip hidden (no "next" exists).
 *   • No data (cgpa = 0)   → strip hidden.
 *   • cgpa exactly equals a tier boundary → 0% progress into that tier.
 */

/** Maps honor cssClass → CSS variable for the fill bar colour. */
const TIER_COLORS = Object.freeze({
  'grade--first': 'var(--color-first)',
  'grade--second-upper': 'var(--color-second-upper)',
  'grade--second-lower': 'var(--color-second-lower)',
  'grade--third': 'var(--color-third)',
  'grade--pass': 'var(--color-pass)',
  'grade--fail': 'var(--color-fail)',
});

/**
 * @param {number}     cgpa
 * @param {GradeScale} scale
 */
export function renderTierProgress(cgpa, scale) {
  const container = document.getElementById('hero-tier-progress');
  const fillEl = document.getElementById('hero-tier-bar-fill');
  const textEl = document.getElementById('hero-tier-text');
  if (!container || !fillEl || !textEl) return;

  if (!cgpa || scale.honors.length < 2) {
    container.hidden = true;
    return;
  }

  // honors array is sorted descending by min
  const honors = scale.honors;
  const currentIdx = honors.findIndex((h) => cgpa >= h.min);

  if (currentIdx <= 0) {
    // Already at top tier, or no tier matched
    container.hidden = true;
    return;
  }

  const currentTier = honors[currentIdx];
  const nextTier = honors[currentIdx - 1];

  const gap = nextTier.min - cgpa;
  const bandWidth = nextTier.min - currentTier.min;
  const progress =
    bandWidth > 0 ? Math.max(0, Math.min((cgpa - currentTier.min) / bandWidth, 1)) : 0;

  fillEl.style.width = `${(progress * 100).toFixed(1)}%`;
  fillEl.style.background = TIER_COLORS[nextTier.cssClass] ?? 'var(--color-gold)';

  const gapStr = gap.toFixed(2);
  textEl.textContent = `${gapStr} more for ${nextTier.label}`;
  textEl.setAttribute(
    'aria-label',
    `You need ${gapStr} more GPA points to reach ${nextTier.label}`
  );

  container.hidden = false;
  container.setAttribute(
    'aria-label',
    `${Math.round(progress * 100)}% of the way to ${nextTier.label}`
  );
}
