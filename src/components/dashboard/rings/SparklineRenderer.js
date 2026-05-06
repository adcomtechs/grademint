/**
 * @module SparklineRenderer
 * @description Renders a CSS-only mini bar chart of all semester GPAs.
 *
 * Extracted from GPARings._renderSparkline verbatim, then refactored into
 * a standalone export so it can be tested and reasoned about independently.
 *
 * DESIGN NOTES (preserved from original):
 *   • Each semester = one <div class="hero-spark-bar">
 *   • Height proportional to gpa/maxGPA (minimum 4px — always visible)
 *   • Colour follows the classification tier of that semester's GPA
 *   • The latest bar gets a gold outline to anchor "now"
 *   • Tooltip (title attribute): "Semester: X.XX GPA" on hover
 *
 * WHY CSS bars, not Canvas?
 *   The hero zone re-renders on every tab switch. Canvas requires explicit
 *   clearing + re-drawing (~10ms synchronous). CSS flex divs achieve the
 *   same visual with zero layout overhead and are naturally responsive.
 */

import { GPACalculatorService } from '@/services/GPACalculatorService.js';
import { formatGPA } from '@/utils/formatters.js';
import { setText, setHidden } from './RingAnimator.js';

/** Maps honor cssClass → CSS variable for bar colour. */
const TIER_COLORS = Object.freeze({
  'grade--first': 'var(--color-first)',
  'grade--second-upper': 'var(--color-second-upper)',
  'grade--second-lower': 'var(--color-second-lower)',
  'grade--third': 'var(--color-third)',
  'grade--pass': 'var(--color-pass)',
  'grade--fail': 'var(--color-fail)',
});

const BAR_HEIGHT_MAX = 32; // px — matches .hero-spark-bars CSS height
const BAR_HEIGHT_MIN = 4; // px — always at least this tall

/**
 * @param {Semester[]}  semesters  all semesters (filters to those with courses)
 * @param {string|null} activeId   highlighted bar ID (null = highlight latest)
 * @param {number}      maxGPA     scale maximum
 * @param {GradeScale}  scale      for getHonorClassification
 */
export function renderSparkline(semesters, activeId, maxGPA, scale) {
  const container = document.getElementById('hero-spark-bars');
  if (!container) return;

  const withData = semesters.filter((s) => s.courseCount > 0);

  if (withData.length === 0) {
    setHidden('hero-sparkline-row', true);
    return;
  }

  container.innerHTML = '';

  withData.forEach((sem, i) => {
    const ratio = Math.min(sem.gpa / maxGPA, 1);
    const height = Math.max(BAR_HEIGHT_MIN, Math.round(ratio * BAR_HEIGHT_MAX));
    const honor = GPACalculatorService.getHonorClassification(sem.gpa, scale.id);
    const colorVar = honor
      ? (TIER_COLORS[honor.cssClass] ?? 'var(--color-border-light)')
      : 'var(--color-border-light)';
    const isLatest = i === withData.length - 1;
    const isActive = sem.id === activeId;

    const bar = document.createElement('div');
    bar.className = ['hero-spark-bar', isLatest ? 'is-latest' : '', isActive ? 'is-active' : '']
      .filter(Boolean)
      .join(' ');

    bar.style.cssText = [
      `height:${height}px`,
      `background:${colorVar}`,
      isLatest ? 'outline:1.5px solid var(--color-gold);outline-offset:2px' : '',
    ]
      .filter(Boolean)
      .join(';');

    bar.title = `${sem.label}: ${formatGPA(sem.gpa)}`;
    bar.setAttribute('aria-label', `${sem.label} GPA ${formatGPA(sem.gpa)}`);
    bar.setAttribute('role', 'img');

    container.append(bar);
  });

  // Axis labels
  setText('hero-spark-first', withData.at(0)?.label ?? '');
  setText('hero-spark-last', withData.at(-1)?.label ?? '');

  // Best-semester label
  const best = withData.reduce((a, b) => (a.gpa > b.gpa ? a : b));
  setText('hero-spark-label', `GPA History — Best: ${formatGPA(best.gpa)} (${best.label})`);
}
