/**
 * @module ClassificationLadder
 * @description Card ① of the AcademicInsights panel.
 *
 * Renders the honour-classification ladder — a vertically stacked set of
 * classification tiers showing the student's current position, which tiers
 * they have already surpassed, how far they have come within the current
 * tier, and how far they are from the next one.
 *
 * SUBSCRIPTION SCOPE:
 * Subscribes to: semesters, student.scaleId, previousRecord.
 * Ignores: activeSemesterId (the ladder always shows the programme CGPA,
 * not a per-semester value — this is intentional; the ladder is a
 * longitudinal instrument, not a semester-scope one).
 *
 * CLASSIFICATION GUARD:
 * honor is intentionally null when no course has been graded yet.
 * A CGPA of 0.00 from empty semesters means "no data", not "Fail".
 * All three builder methods (_buildHeader, _buildLadder, _buildFooter)
 * treat null honor as the "pending / no data" state and render
 * neutral placeholder UI rather than a misleading Fail classification.
 *
 * CSS:
 * All styles live in insights.css (.ic-*, .cl-*) and main.css §30-A (.ladder-*).
 * No CSS is injected from this module.
 *
 * PATTERNS:
 * - BaseComponent lifecycle (mount → render → afterMount → unmount)
 * - Selective store subscription via JSON.stringify diff (minimal re-renders)
 * - Two-frame rAF for CSS transition to play on first paint
 * - createElement for all DOM mutations (XSS-safe, no innerHTML)
 */

import { BaseComponent } from '../../common/BaseComponent.js';
import { GPACalculatorService } from '../../../services/GPACalculatorService.js';
import { Semester } from '../../../domain/Semester.js';
import { createElement, clearElement } from '../../../utils/dom.js';
import { formatGPA } from '../../../utils/formatters.js';
import { DEFAULT_SCALE_ID } from '../../../utils/constants.js';
import { getScale } from '../../../utils/helpers.js';

export class ClassificationLadder extends BaseComponent {
  /**
   * @param {HTMLElement} container
   * @param {ReturnType<import('../../core/Store.js').createStore>} store
   */
  constructor(container, store) {
    super(container, store);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  afterMount() {
    const unsub = this.store.subscribe(({ state, prevState }) => {
      const changed =
        JSON.stringify(state.semesters) !== JSON.stringify(prevState?.semesters) ||
        JSON.stringify(state.previousRecord) !== JSON.stringify(prevState?.previousRecord) ||
        state.student?.scaleId !== prevState?.student?.scaleId;

      if (changed) this.render();
    });

    this.addSubscription(unsub);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  render() {
    const state = this.store.getState();
    const semesters = (state.semesters ?? []).map(Semester.fromJSON);
    const scaleId = state.student?.scaleId ?? DEFAULT_SCALE_ID;
    const scale = getScale(scaleId);
    const cgpa = GPACalculatorService.cgpaWithPreviousRecord(semesters, state.previousRecord);

    // Classification is only meaningful once at least one course has been
    // graded. A CGPA of 0.00 from empty semesters means "no data yet", not
    // academic failure. Passing null into the builder methods causes each
    // section to render a neutral "pending" state rather than stamping the
    // student as Fail before they have submitted any work.
    const hasGradedData = semesters.some((s) => s.courseCount > 0);
    const honor = hasGradedData ? GPACalculatorService.getHonorClassification(cgpa, scaleId) : null;

    clearElement(this.container);
    this.container.append(this._buildCard(cgpa, honor, scale));
  }

  // ── Card ───────────────────────────────────────────────────────────────────

  /**
   * @param {number}      cgpa
   * @param {object|null} honor    current classification entry (null = no graded data)
   * @param {object}      scale
   */
  _buildCard(cgpa, honor, scale) {
    const card = createElement('div', { className: 'insights-card' });
    card.append(this._buildHeader(honor, scale));
    card.append(this._buildLadder(cgpa, honor, scale));
    card.append(this._buildFooter(cgpa, honor, scale));
    return card;
  }

  // ── Header ─────────────────────────────────────────────────────────────────

  /**
   * Card title row: icon | "Academic Standing" + scale sub-label | badge.
   *
   * The badge is shown for any non-null honor entry — including genuine Fail.
   * The previous workaround that suppressed the badge when cssClass was
   * 'grade--fail' has been removed: it was a side-effect of the missing
   * hasGradedData guard, and it incorrectly hid the classification from
   * students who legitimately earned a Fail grade.
   *
   * @param {object|null} honor
   * @param {object}      scale
   */
  _buildHeader(honor, scale) {
    // Only render the badge when we have a genuine classification to show.
    // null means no graded data yet — no badge in that state.
    const badgeEl = honor
      ? createElement(
          'span',
          { className: `classification-badge ${honor.cssClass}` },
          createElement('span', { className: 'class-icon', 'aria-hidden': 'true' }, honor.badge),
          honor.label
        )
      : null;

    return createElement(
      'div',
      { className: 'insights-card-header' },
      createElement('span', { className: 'insights-card-icon', 'aria-hidden': 'true' }, '🎓'),
      createElement(
        'div',
        { className: 'insights-card-heading' },
        createElement('h3', { className: 'insights-card-title' }, 'Academic Standing'),
        createElement('p', { className: 'insights-card-sub' }, scale.label.split('(')[0].trim())
      ),
      badgeEl
    );
  }

  // ── Ladder ─────────────────────────────────────────────────────────────────

  /**
   * Builds the tier-band list.
   *
   * When honor is null (no graded data), currentIdx resolves to -1 because
   * cgpa is 0.0 and hasGradedData is false — so no band is marked is-current
   * and no fill bar is drawn. The ladder renders in a clean "not started" state:
   * all bands are future-grey with 0% fill, which is visually accurate.
   *
   * Band ordering:
   *   - Display order: highest tier at top (descending by min)
   *   - Index lookups: ascending array (asc[]) to find current/next tier
   *
   * Fill percentage per band:
   *   - Surpassed (below current) → 100%
   *   - Current                  → proportional position in band range, min 4%
   *   - Future (above current)   → 0%
   *
   * @param {number}      cgpa
   * @param {object|null} honor
   * @param {object}      scale
   */
  _buildLadder(cgpa, honor, scale) {
    // Build ascending array with computed max boundaries
    const asc = [...scale.honors]
      .sort((a, b) => a.min - b.min)
      .map((band, i, arr) => ({
        ...band,
        max: arr[i + 1] ? arr[i + 1].min : scale.maxGPA,
      }));

    // When honor is null, cgpa is 0 and no band should be marked current.
    // The findIndex will still run but currentIdx = -1 because honor being
    // null means we intentionally skip classification — isAchieved and
    // isCurrent will both be false for every band, leaving all fills at 0%.
    const currentIdx =
      honor !== null ? asc.findIndex((b) => cgpa >= b.min && cgpa < b.max + 0.0001) : -1;

    // Display order is highest-first
    const bands = [...asc].reverse();

    const scaleEl = createElement('div', {
      className: 'ladder-scale',
      role: 'list',
      'aria-label': 'Honour classification ladder',
    });

    bands.forEach((band) => {
      const bandIdxAsc = asc.indexOf(band);
      const isCurrent = currentIdx !== -1 && bandIdxAsc === currentIdx;
      const isAchieved = currentIdx !== -1 && bandIdxAsc < currentIdx;

      let fillPct = 0;
      if (isAchieved) {
        fillPct = 100;
      } else if (isCurrent) {
        const range = band.max - band.min;
        fillPct = range > 0 ? Math.max(4, Math.min(100, ((cgpa - band.min) / range) * 100)) : 100;
      }

      const row = createElement('div', {
        className: ['ladder-row', isCurrent ? 'is-current' : '', isAchieved ? 'is-achieved' : '']
          .filter(Boolean)
          .join(' '),
        role: 'listitem',
        'aria-label':
          `${band.label}: ${band.min.toFixed(2)}–${band.max.toFixed(2)}` +
          (isCurrent ? ` — you are here (${formatGPA(cgpa)})` : ''),
      });

      // Meta: badge emoji + label + range
      const meta = createElement(
        'div',
        { className: 'ladder-row-meta' },
        createElement('span', { className: 'ladder-emoji', 'aria-hidden': 'true' }, band.badge),
        createElement(
          'div',
          { className: 'ladder-row-text' },
          createElement('span', { className: 'ladder-row-label' }, band.label),
          createElement(
            'span',
            { className: 'ladder-row-range' },
            `${band.min.toFixed(2)} – ${band.max.toFixed(2)}`
          )
        )
      );

      // Progress bar
      const barFill = createElement('div', {
        className: `ladder-bar-fill ${band.cssClass}`,
        style: { width: '0%' },
      });
      const barTrack = createElement('div', { className: 'ladder-bar-track' }, barFill);

      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          barFill.style.width = `${fillPct.toFixed(1)}%`;
        })
      );

      // Right-side marker
      let marker;
      if (isCurrent) {
        marker = createElement(
          'span',
          { className: 'ladder-current-marker', 'aria-label': `Your GPA: ${formatGPA(cgpa)}` },
          formatGPA(cgpa)
        );
      } else if (isAchieved) {
        marker = createElement(
          'span',
          { className: 'ladder-check', 'aria-label': 'Surpassed' },
          '✓'
        );
      } else {
        marker = createElement('span', { className: 'ladder-dash', 'aria-hidden': 'true' }, '—');
      }

      row.append(meta, barTrack, marker);
      scaleEl.append(row);
    });

    return scaleEl;
  }

  // ── Footer ─────────────────────────────────────────────────────────────────

  /**
   * Shows either:
   *   - A tier progress bar toward the next classification, or
   *   - A "top classification reached" message, or
   *   - An "add courses to begin" prompt when honor is null.
   *
   * The previous guard `!honor || cgpa === 0` has been simplified to
   * `!honor`. The cgpa === 0 special-case was a fragile workaround for the
   * missing hasGradedData guard in render(). With that guard now in place,
   * null is the unambiguous signal for "no graded data yet", and a cgpa of
   * 0.00 with real Fail grades correctly produces a non-null honor entry.
   *
   * @param {number}      cgpa
   * @param {object|null} honor   null = no graded data
   * @param {object}      scale
   */
  _buildFooter(cgpa, honor, scale) {
    // No graded data yet — show a neutral prompt, not a classification state.
    if (!honor) {
      return createElement(
        'div',
        { className: 'ladder-footer' },
        createElement(
          'span',
          { className: 'ladder-footer-msg' },
          'Add courses to see your standing'
        )
      );
    }

    const asc = [...scale.honors]
      .sort((a, b) => a.min - b.min)
      .map((band, i, arr) => ({
        ...band,
        max: arr[i + 1] ? arr[i + 1].min : scale.maxGPA,
      }));

    const currentIdx = asc.findIndex((b) => cgpa >= b.min && cgpa < b.max + 0.0001);
    const nextBand = currentIdx !== -1 ? (asc[currentIdx + 1] ?? null) : null;

    // Already at the top tier
    if (!nextBand) {
      return createElement(
        'div',
        { className: 'cl-top-reached', 'aria-live': 'polite' },
        createElement('span', { className: 'cl-top-reached-icon' }, '🏆'),
        `Top classification achieved — ${formatGPA(cgpa)}`
      );
    }

    // Progress toward next tier
    const gap = Math.max(0, nextBand.min - cgpa);
    const current = asc[currentIdx];
    const bandWidth = nextBand.min - current.min;
    const pct = bandWidth > 0 ? Math.min(((cgpa - current.min) / bandWidth) * 100, 100) : 0;
    const fillColor = `var(--color-${nextBand.cssClass.replace('grade--', '')}, var(--color-gold))`;

    const barFill = createElement('div', {
      className: 'cl-tier-bar-fill',
      style: { width: '0%', background: fillColor },
    });

    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        barFill.style.width = `${pct.toFixed(1)}%`;
      })
    );

    return createElement(
      'div',
      { className: 'cl-tier-progress' },
      createElement(
        'div',
        { className: 'cl-tier-progress-header' },
        createElement('span', { className: 'cl-tier-progress-label' }, 'Next:'),
        createElement(
          'span',
          { className: `cl-tier-progress-target ${nextBand.cssClass}` },
          `${nextBand.badge} ${nextBand.label}`
        )
      ),
      createElement('div', { className: 'cl-tier-bar-track' }, barFill),
      createElement(
        'span',
        { className: 'cl-tier-gap-text', 'aria-live': 'polite' },
        gap > 0.001 ? `+${gap.toFixed(3)} more needed` : 'Threshold reached!'
      )
    );
  }
}
