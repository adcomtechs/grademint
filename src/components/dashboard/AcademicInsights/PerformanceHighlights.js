/**
 * @module PerformanceHighlights
 * @description Card ③ of the AcademicInsights panel.
 *
 * Surfaces four categories of academic performance data in a compact card:
 *
 *   ① Stat Grid (2×2)     — Best semester GPA, Lowest semester GPA,
 *                           Average semester GPA, Total credit units
 *   ② Mini Sparkline       — CSS-only bar chart of every semester's GPA,
 *                           coloured by classification tier, latest outlined
 *   ③ Grade Distribution   — Horizontal frequency bars (CSS-only, one row
 *                           per letter grade that appears at least once)
 *   ④ Honour Strip         — Current programme CGPA classification badge
 *                           with the numeric CGPA value
 *
 * SUBSCRIPTION SCOPE:
 * Subscribes to: semesters, student.scaleId, previousRecord.
 * Fires render() only when one of those three slices actually changes.
 *
 * WHY CSS-only charts?
 * Both the sparkline and grade bars are rendered with plain div elements
 * and CSS height/width values — no Canvas, no SVG, no external library.
 * This approach:
 *   - Prints cleanly (no canvas-to-image conversion artefacts)
 *   - Requires zero rAF-based draw synchronisation
 *   - Is perfectly responsive (flex children fill available width)
 *   - Degrades gracefully (just a coloured rectangle if a colour fails)
 *
 * CSS:
 * All styles live in insights.css (.ph-*). No CSS is injected here.
 *
 * PATTERNS:
 * - BaseComponent lifecycle (mount → render → afterMount → unmount)
 * - JSON.stringify diff subscription guard
 * - Two-frame rAF for CSS transition on grade bar fills
 * - GPACalculatorService for all aggregation (no duplicate logic)
 * - createElement for all DOM mutations
 */

import { BaseComponent } from '../../common/BaseComponent.js';
import { GPACalculatorService } from '../../../services/GPACalculatorService.js';
import { Semester } from '../../../domain/Semester.js';
import { createElement, clearElement } from '../../../utils/dom.js';
import { formatGPA } from '../../../utils/formatters.js';
import { DEFAULT_SCALE_ID } from '../../../utils/constants.js';
import { getScale } from '../../../utils/helpers.js';

// ─── Colour helper ────────────────────────────────────────────────────────────

/**
 * Maps a GPA to the CSS custom-property colour for its classification tier.
 * Returns a concrete rgba() string so it can be applied as an inline style
 * on elements that cannot use the grade--* class system (e.g. bar fills).
 *
 * @param {number} gpa
 * @param {number} [alpha=1]
 * @returns {string} CSS rgba() string
 */
function _tierColor(gpa, alpha = 1) {
  if (gpa >= 4.5) return `rgba(246,211,101,${alpha})`; // First Class
  if (gpa >= 3.5) return `rgba(168,230,207,${alpha})`; // 2nd Upper
  if (gpa >= 2.4) return `rgba(116,185,224,${alpha})`; // 2nd Lower
  if (gpa >= 1.5) return `rgba(246,173,85,${alpha})`; // Third
  return `rgba(255,139,148,${alpha})`; // Fail / Pass
}

/**
 * Maps a grade letter to an inline colour for the distribution bars.
 * Falls back to a neutral colour for unrecognised letters.
 *
 * @param {string} letter
 * @returns {string}
 */
function _gradeColor(letter) {
  const l = letter.toUpperCase();
  if (l.startsWith('A')) return 'rgba(246,211,101,0.8)';
  if (l.startsWith('B')) return 'rgba(168,230,207,0.8)';
  if (l.startsWith('C')) return 'rgba(116,185,224,0.8)';
  if (l.startsWith('D')) return 'rgba(246,173,85,0.8)';
  if (l === 'E') return 'rgba(160,174,192,0.7)';
  if (l === 'F') return 'rgba(255,139,148,0.8)';
  return 'rgba(160,174,192,0.6)';
}

// ─── Component ────────────────────────────────────────────────────────────────

export class PerformanceHighlights extends BaseComponent {
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
    const allCourses = semesters.flatMap((s) => s.courses);
    const cgpa = GPACalculatorService.cgpaWithPreviousRecord(semesters, state.previousRecord);
    const honor = GPACalculatorService.getHonorClassification(cgpa, scaleId);
    const dist = GPACalculatorService.gradeDistribution(allCourses);

    clearElement(this.container);
    this.container.append(this._buildCard(semesters, allCourses, cgpa, honor, dist, scale));
  }

  // ── Card ───────────────────────────────────────────────────────────────────

  /**
   * @param {Semester[]}            semesters
   * @param {Course[]}              allCourses
   * @param {number}                cgpa
   * @param {object|null}           honor
   * @param {Record<string,number>} dist
   * @param {object}                scale
   */
  _buildCard(semesters, allCourses, cgpa, honor, dist, scale) {
    const card = createElement('div', { className: 'insights-card insights-card--highlights' });

    // Header
    card.append(this._buildHeader());

    // Empty state
    if (semesters.length === 0) {
      card.append(
        createElement(
          'p',
          { className: 'ic-empty' },
          'Add semesters and courses to see your performance highlights.'
        )
      );
      return card;
    }

    // ① Stat grid
    card.append(this._buildStatGrid(semesters));

    // ② Sparkline (only when ≥ 2 semesters with courses)
    const withCourses = semesters.filter((s) => s.courseCount > 0);
    if (withCourses.length >= 2) {
      card.append(this._buildSparkline(withCourses, scale));
    }

    // ③ Grade distribution bars
    if (allCourses.length > 0) {
      card.append(this._buildGradeDistribution(dist, scale, allCourses.length));
    }

    // ④ Honour strip
    if (honor && cgpa > 0) {
      card.append(this._buildHonorStrip(honor, cgpa));
    }

    return card;
  }

  // ── Header ─────────────────────────────────────────────────────────────────

  _buildHeader() {
    return createElement(
      'div',
      { className: 'insights-card-header' },
      createElement('span', { className: 'insights-card-icon', 'aria-hidden': 'true' }, '📊'),
      createElement(
        'div',
        { className: 'insights-card-heading' },
        createElement('h3', { className: 'insights-card-title' }, 'Performance'),
        createElement('p', { className: 'insights-card-sub' }, 'Highlights & breakdown')
      )
    );
  }

  // ── Stat Grid ──────────────────────────────────────────────────────────────

  /**
   * Renders a 2×2 grid of key performance metrics.
   * Skips "Lowest" when there is only one semester (it would be the same as Best).
   *
   * @param {Semester[]} semesters
   */
  _buildStatGrid(semesters) {
    const withCourses = semesters.filter((s) => s.courseCount > 0);
    const gpas = withCourses.map((s) => s.gpa);
    const best = gpas.length > 0 ? Math.max(...gpas) : null;
    const worst = gpas.length > 1 ? Math.min(...gpas) : null;
    const avg = gpas.length > 0 ? gpas.reduce((a, b) => a + b, 0) / gpas.length : null;
    const totalCU = semesters.reduce((s, sem) => s + sem.totalCreditUnits, 0);

    const bestSem = best !== null ? withCourses.find((s) => s.gpa === best) : null;
    const worstSem = worst !== null ? withCourses.find((s) => s.gpa === worst) : null;

    const stats = [
      best !== null
        ? { variant: 'best', label: 'Best Sem.', value: formatGPA(best), sub: bestSem?.label ?? '' }
        : null,
      worst !== null
        ? {
            variant: 'worst',
            label: 'Lowest Sem.',
            value: formatGPA(worst),
            sub: worstSem?.label ?? '',
          }
        : null,
      avg !== null
        ? {
            variant: 'avg',
            label: 'Avg Sem. GPA',
            value: formatGPA(avg),
            sub: `${withCourses.length} semesters`,
          }
        : null,
      {
        variant: 'cu',
        label: 'Credit Units',
        value: String(totalCU),
        sub: `${semesters.length} sem.`,
      },
    ].filter(Boolean);

    const grid = createElement('div', { className: 'ph-stats-grid' });

    stats.forEach(({ variant, label, value, sub }) => {
      grid.append(
        createElement(
          'div',
          {
            className: `ph-stat ph-stat--${variant}`,
            role: 'group',
            'aria-label': `${label}: ${value}`,
          },
          createElement('span', { className: 'ph-stat-value' }, value),
          createElement('span', { className: 'ph-stat-key' }, label),
          sub ? createElement('span', { className: 'ph-stat-sub' }, sub) : null
        )
      );
    });

    return grid;
  }

  // ── Sparkline ──────────────────────────────────────────────────────────────

  /**
   * A CSS-only horizontal bar chart of semester GPAs.
   * Each bar's height is proportional to (gpa / maxGPA), minimum 4px.
   * Coloured by tier using _tierColor(), latest bar gets a gold outline.
   *
   * @param {Semester[]} semesters   filtered to only those with courses
   * @param {object}     scale
   */
  _buildSparkline(semesters, scale) {
    const maxGPA = scale.maxGPA;
    const BAR_MAX = 36; // px — matches .ph-spark-bars height
    const BAR_MIN = 4; // px — always visible

    const barsEl = createElement('div', {
      className: 'ph-spark-bars',
      role: 'img',
      'aria-label': 'Semester GPA bar chart',
    });

    semesters.forEach((sem, i) => {
      const isLatest = i === semesters.length - 1;
      const ratio = Math.min(sem.gpa / maxGPA, 1);
      const height = Math.max(BAR_MIN, Math.round(ratio * BAR_MAX));
      const color = _tierColor(sem.gpa, 0.75);

      const bar = createElement('div', {
        className: `ph-spark-bar${isLatest ? ' is-latest' : ''}`,
        title: `${sem.label}: ${formatGPA(sem.gpa)}`,
        'aria-label': `${sem.label} GPA ${formatGPA(sem.gpa)}`,
        style: { height: `${height}px`, background: color },
      });

      barsEl.append(bar);
    });

    // Best GPA label for the header meta
    const bestGPA = Math.max(...semesters.map((s) => s.gpa));

    return createElement(
      'div',
      { className: 'ph-sparkline' },
      createElement(
        'div',
        { className: 'ph-sparkline-header' },
        createElement('span', { className: 'ph-sparkline-label' }, 'GPA by Semester'),
        createElement('span', { className: 'ph-sparkline-meta' }, `Peak: ${formatGPA(bestGPA)}`)
      ),
      barsEl,
      createElement(
        'div',
        { className: 'ph-spark-axis', 'aria-hidden': 'true' },
        createElement('span', {}, semesters.at(0)?.label ?? ''),
        createElement('span', {}, semesters.at(-1)?.label ?? '')
      )
    );
  }

  // ── Grade Distribution ─────────────────────────────────────────────────────

  /**
   * Horizontal bar chart of grade frequencies.
   * One row per letter grade that has at least one course.
   * Bar width = (count / maxCount) × 100%.
   * CSS transition on the fill width plays on every render (two-frame rAF).
   *
   * @param {Record<string,number>} dist           letter → count
   * @param {object}                scale
   * @param {number}                totalCourses
   */
  _buildGradeDistribution(dist, scale, totalCourses) {
    const gradeOrder = scale.grades.map((g) => g.letter);
    const maxCount = Math.max(...Object.values(dist), 1);

    const barsEl = createElement('div', { className: 'ph-grade-bars' });

    gradeOrder.forEach((letter) => {
      const count = dist[letter];
      if (!count) return;

      const pct = ((count / totalCourses) * 100).toFixed(0);
      const width = ((count / maxCount) * 100).toFixed(1);
      const color = _gradeColor(letter);

      const fill = createElement('div', {
        className: 'ph-grade-bar-fill',
        style: { width: '0%', background: color },
      });

      // Animate fill in after paint so transition plays
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          fill.style.width = `${width}%`;
        })
      );

      barsEl.append(
        createElement(
          'div',
          {
            className: 'ph-grade-row',
            'aria-label': `${letter}: ${count} course${count !== 1 ? 's' : ''} (${pct}%)`,
          },
          createElement('span', { className: 'ph-grade-letter', style: { color } }, letter),
          createElement('div', { className: 'ph-grade-bar-track' }, fill),
          createElement('span', { className: 'ph-grade-count' }, `×${count}`)
        )
      );
    });

    return createElement(
      'div',
      { className: 'ph-grade-section' },
      createElement(
        'span',
        { className: 'ph-grade-section-label' },
        `Grade Distribution — ${totalCourses} courses`
      ),
      barsEl
    );
  }

  // ── Honour Strip ───────────────────────────────────────────────────────────

  /**
   * Full-width badge showing the student's current programme classification.
   * Uses the grade--* colour class system from main.css for the border/text.
   *
   * @param {object} honor  classification entry from the scale
   * @param {number} cgpa
   */
  _buildHonorStrip(honor, cgpa) {
    return createElement(
      'div',
      {
        className: `ph-honor-strip ${honor.cssClass}`,
        role: 'status',
        'aria-label': `Current classification: ${honor.label}, CGPA ${formatGPA(cgpa)}`,
      },
      createElement('span', { className: 'ph-honor-icon', 'aria-hidden': 'true' }, honor.badge),
      createElement(
        'div',
        { className: 'ph-honor-body' },
        createElement('span', { className: 'ph-honor-eyebrow' }, 'Current Classification'),
        createElement('span', { className: 'ph-honor-name' }, honor.label)
      ),
      createElement('span', { className: 'ph-honor-cgpa' }, formatGPA(cgpa))
    );
  }
}
