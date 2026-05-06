/**
 * @module AnalyticsPanel
 * @description Full-screen analytics view — mounts into #analytics-view.
 *
 * Extends BaseComponent, which provides:
 *   - Error boundary via safeRender() / _handleRenderError()
 *   - Declarative store subscriptions via watchState() + addSubscription()
 *   - Automatic cleanup via unmount() → _ctrl.abort() + _unsubs forEach
 *   - Local state via this.localState / this.setState()
 *
 * RENDERING:
 * Canvas charts are drawn by ChartRenderer (static utility class).
 * AnalyticsPanel is responsible for layout, data preparation, and
 * delegating chart rendering — not for canvas drawing logic.
 *
 * Each visual section is built by a dedicated module under ./analytics/.
 * AnalyticsPanel.render() orchestrates the sequence; the builders own
 * the markup details.
 *
 * ACTIVATION:
 * ViewRouter calls activate() when this view becomes visible.
 * activate() calls safeRender() — which goes through the error boundary —
 * rather than render() directly, ensuring any failure is handled gracefully.
 *
 * SECTIONS (top → bottom):
 *   1. Heading                 — name, scale pill, aggregate subtitle
 *   2. KPI strip               — CGPA, semesters, CU, courses, trend
 *   3. Charts row              — GPA Trend + Grade Distribution canvases
 *   4. Semester Breakdown      — per-semester stats with running CGPA
 *   5. Performance Insights    — best/lowest/avg + grade breakdown bars
 *   6. What-If Calculator      — required GPA for target CGPA
 */

import { BaseComponent } from '../common/BaseComponent.js';
import { GPACalculatorService } from '../../services/GPACalculatorService.js';
import { ChartRenderer } from './ChartRenderer.js';
import { Semester } from '../../domain/Semester.js';
import { clearElement } from '../../utils/dom.js';
import { getScale } from '../../utils/helpers.js';
import { watchState } from '../../utils/selector.js';
import { DEFAULT_SCALE_ID } from '../../utils/constants.js';
import { createLogger } from '../../utils/logger.js';

// ── Section builders ──────────────────────────────────────────────────────────
import { buildHeading } from './analytics/buildHeading.js';
import { buildEmpty } from './analytics/buildEmpty.js';
import { buildKPIs } from './analytics/buildKPIs.js';
import { buildChartRow } from './analytics/buildChartRow.js';
import { buildBreakdown } from './analytics/buildBreakdown.js';
import { buildInsights } from './analytics/buildInsights.js';
import { buildWhatIf } from './analytics/buildWhatIf.js';

const log = createLogger('AnalyticsPanel');

// ─── Style injection guard ────────────────────────────────────────────────────
// CSS for this component lives in src/styles/analytics-panel.css, loaded by app.css.
// No runtime injection.

// ─────────────────────────────────────────────────────────────────────────────

export class AnalyticsPanel extends BaseComponent {
  /**
   * @param {HTMLElement} container  The #analytics-view element
   * @param {ReturnType<import('../../core/Store.js').createStore>} store
   */
  constructor(container, store) {
    super(container, store);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  afterMount() {
    const unsub = watchState(
      this.store,
      (s) => [s.semesters, s.student, s.previousRecord],
      () => {
        // Only re-render when this view is actually visible.
        // Rendering while hidden wastes work and corrupts canvas dimensions
        // (offsetWidth is 0 for hidden elements).
        if (!this.container.hidden) this.safeRender();
      }
    );
    this.addSubscription(unsub);
  }

  /**
   * Called by ViewRouter when this view becomes the active route.
   * Forces a fresh render so canvas charts have correct layout dimensions —
   * canvas offsetWidth is 0 while the view is hidden, so charts drawn
   * during a hidden render would have zero width.
   */
  activate() {
    log.debug('AnalyticsPanel activated');
    this.safeRender();
  }

  // ── Main Render ────────────────────────────────────────────────────────────

  render() {
    // ── 1. Derive data from store ────────────────────────────────────────────
    const state = this.store.getState();
    const semesters = (state.semesters ?? []).map(Semester.fromJSON);
    const student = state.student ?? {};
    const scaleId = student.scaleId ?? DEFAULT_SCALE_ID;
    const scale = getScale(scaleId);

    const allCourses = semesters.flatMap((s) => s.courses);
    const trendData = GPACalculatorService.buildTrend(semesters);
    const dist = GPACalculatorService.gradeDistribution(allCourses);
    const stats = GPACalculatorService.aggregateStats(semesters);
    const cgpa = GPACalculatorService.cgpaWithPreviousRecord(semesters, state.previousRecord);
    const honor = GPACalculatorService.getHonorClassification(cgpa, scaleId);
    const trend = GPACalculatorService.trendDirection(semesters);

    // ── 2. Reset container ───────────────────────────────────────────────────
    clearElement(this.container);

    const root = document.createElement('div');
    root.className = 'ap-root';

    // ── 3. Heading (always shown) ────────────────────────────────────────────
    root.append(buildHeading(student, scale, stats));

    // ── 4. Empty state ───────────────────────────────────────────────────────
    if (semesters.length === 0) {
      root.append(buildEmpty());
      this.container.append(root);
      return;
    }

    // ── 5. KPI strip ─────────────────────────────────────────────────────────
    root.append(buildKPIs(cgpa, honor, stats, trend, scale));

    // ── 6. Charts row ─────────────────────────────────────────────────────────
    // Canvas IDs are stable — ChartRenderer targets them in requestAnimationFrame
    root.append(buildChartRow());

    // ── 7. Semester breakdown table ───────────────────────────────────────────
    root.append(buildBreakdown(semesters, trendData, scale, cgpa));

    // ── 8. Performance insights ───────────────────────────────────────────────
    if (semesters.length >= 1) {
      root.append(buildInsights(semesters, allCourses, dist, scale));
    }

    // ── 9. What-If calculator ─────────────────────────────────────────────────
    // addListener is bound so the builder can register cleanup-safe listeners
    // without a direct `this` reference.
    root.append(buildWhatIf(cgpa, stats.totalCU, scaleId, scale, this.addListener.bind(this)));

    this.container.append(root);

    // ── 10. Deferred chart draw ───────────────────────────────────────────────
    // requestAnimationFrame ensures the canvas elements are painted into the
    // DOM and have a non-zero offsetWidth before ChartRenderer reads it.
    const gradeOrder = scale.grades.map((g) => g.letter);
    requestAnimationFrame(() => {
      const trendCanvas = document.getElementById('ap-trend-canvas');
      const distCanvas = document.getElementById('ap-dist-canvas');

      if (trendCanvas && trendData.length > 0) {
        ChartRenderer.renderTrendChart(trendCanvas, trendData, scale.maxGPA);
      }
      if (distCanvas && Object.keys(dist).length > 0) {
        ChartRenderer.renderDistributionChart(distCanvas, dist, gradeOrder);
      }
    });
  }
}
