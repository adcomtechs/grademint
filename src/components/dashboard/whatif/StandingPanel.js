/**
 * @module StandingPanel
 * @description Renders the "Current Standing" panel in the What-If view.
 *
 * Shows: CGPA ring, honour classification, key stats,
 * and a progress bar toward the next honour tier.
 */

import { BaseComponent } from '../../common/BaseComponent.js';
import { GPACalculatorService } from '../../../services/GPACalculatorService.js';
import { Semester } from '../../../domain/Semester.js';
import { createElement } from '../../../utils/dom.js';
import { formatGPA } from '../../../utils/formatters.js';
import { watchState } from '../../../utils/selector.js';
import { gpaColor } from '../../../utils/gpaColors.js';
import { DEFAULT_SCALE_ID } from '../../../utils/constants.js';
import { getScale } from '../../../utils/helpers.js';

export class StandingPanel extends BaseComponent {
  constructor(container, store) {
    super(container, store);
  }

  afterMount() {
    const unsub = watchState(
      this.store,
      (s) => [s.semesters, s.student, s.previousRecord],
      () => this.safeRender()
    );
    this.addSubscription(unsub);
  }

  render() {
    const state = this.store.getState();
    const semesters = (state.semesters ?? []).map(Semester.fromJSON);
    const scaleId = state.student?.scaleId ?? DEFAULT_SCALE_ID;
    const scale = getScale(scaleId);
    const cgpa = GPACalculatorService.cgpaWithPreviousRecord(semesters, state.previousRecord);
    const stats = GPACalculatorService.aggregateStats(semesters);
    const honor = GPACalculatorService.getHonorClassification(cgpa, scaleId);

    this.container.innerHTML = '';
    this.container.append(this._build(cgpa, stats, honor, scale));
  }

  _build(cgpa, stats, honor, scale) {
    const maxGPA = scale.maxGPA;
    const circumf = 2 * Math.PI * 42;
    const ratio = Math.min(cgpa / maxGPA, 1);
    const offset = circumf * (1 - ratio);
    const col = gpaColor(cgpa, 1);

    // Next tier above current
    const sortedHonors = [...scale.honors].sort((a, b) => b.min - a.min);
    const currentTierIdx = sortedHonors.findIndex((h) => cgpa >= h.min);
    const nextTier = currentTierIdx > 0 ? sortedHonors[currentTierIdx - 1] : null;

    const card = createElement('div', { className: 'wi-card' });
    card.append(createElement('h3', { className: 'wi-section-title' }, '📍 Current Standing'));

    const row = createElement('div', { className: 'wi-standing-row' });

    // ── CGPA ring ────────────────────────────────────────────────────────────
    const ring = createElement(
      'div',
      { className: 'wi-ring-wrap' },
      this._buildRingSvg(circumf, offset, col),
      createElement(
        'div',
        { className: 'wi-ring-text' },
        createElement(
          'span',
          { className: 'wi-ring-cgpa', style: { color: col } },
          formatGPA(cgpa)
        ),
        createElement('span', { className: 'wi-ring-denom' }, `/ ${maxGPA.toFixed(2)}`)
      )
    );

    // ── Stats column ─────────────────────────────────────────────────────────
    const statsCol = createElement('div', { className: 'wi-standing-stats' });
    const statRows = [
      ['Classification', honor ? `${honor.badge} ${honor.label}` : '—', honor?.cssClass],
      ['Credit Units', String(stats.totalCU)],
      ['Semesters', String(stats.semesterCount)],
      ['Total Courses', String(stats.courseCount)],
    ];
    statRows.forEach(([key, val, cssClass]) => {
      statsCol.append(
        createElement(
          'div',
          { className: 'wi-standing-row-item' },
          createElement('span', { className: 'wi-standing-key' }, key),
          createElement('span', { className: `wi-standing-val ${cssClass ?? ''}` }, val)
        )
      );
    });

    // ── Next tier progress ───────────────────────────────────────────────────
    const progressEl = this._buildNextTierProgress(cgpa, currentTierIdx, sortedHonors, nextTier);

    row.append(ring, statsCol, progressEl);
    card.append(row);
    return card;
  }

  _buildRingSvg(circumf, offset, col) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'wi-ring-svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-hidden', 'true');

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bg.setAttribute('class', 'wi-ring-bg');
    bg.setAttribute('cx', '50');
    bg.setAttribute('cy', '50');
    bg.setAttribute('r', '42');

    const fill = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    fill.setAttribute('class', 'wi-ring-fill');
    fill.setAttribute('cx', '50');
    fill.setAttribute('cy', '50');
    fill.setAttribute('r', '42');
    fill.style.stroke = col;
    fill.style.strokeDasharray = String(circumf);
    fill.style.strokeDashoffset = String(offset);

    svg.append(bg, fill);
    return svg;
  }

  _buildNextTierProgress(cgpa, currentTierIdx, sortedHonors, nextTier) {
    if (!nextTier) {
      return createElement(
        'div',
        { className: 'wi-next-tier' },
        createElement(
          'div',
          { className: 'wi-already-top' },
          "◈ You've reached the highest classification"
        )
      );
    }

    const currentFloor = sortedHonors[currentTierIdx]?.min ?? 0;
    const pct = Math.min(((cgpa - currentFloor) / (nextTier.min - currentFloor)) * 100, 100);
    const gap = Math.max(nextTier.min - cgpa, 0);

    return createElement(
      'div',
      { className: 'wi-next-tier' },
      createElement(
        'div',
        { className: 'wi-next-tier-header' },
        createElement('span', { className: 'wi-next-tier-label' }, 'Next Tier'),
        createElement(
          'span',
          { className: `wi-next-tier-name ${nextTier.cssClass}` },
          `${nextTier.badge} ${nextTier.label}`
        )
      ),
      createElement(
        'div',
        { className: 'wi-progress-track' },
        createElement('div', {
          className: 'wi-progress-fill',
          style: { width: `${pct}%`, background: gpaColor(nextTier.min, 0.8) },
        })
      ),
      createElement(
        'div',
        { className: 'wi-progress-gap' },
        gap > 0.001 ? `+${gap.toFixed(3)} CGPA needed` : 'Threshold reached!'
      )
    );
  }
}
