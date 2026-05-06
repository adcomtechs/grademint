/**
 * @module GPARings
 * @description Hero-zone orchestrator. Thin coordinator across focused renderers.
 *
 * ── DISPLAY MODES ───────────────────────────────────────────────────────────
 *
 * ① EMPTY (semesters.length === 0)
 *   EmptyHeroState replaces ring content with a purposeful first-use prompt.
 *   The #empty-state div in index.html is REMOVED — the hero zone owns this.
 *
 * ② OVERVIEW (activeSemesterId === ALL_SEMESTERS_ID or null)
 *   OverviewMode renders full programme stats + sparkline.
 *
 * ③ SEMESTER (activeSemesterId is a real UUID)
 *   SemesterMode renders the selected semester's GPA + delta badge.
 *
 * ── INTERACTION MODEL ───────────────────────────────────────────────────────
 *
 * GPARings accepts two optional callbacks in its options object:
 *
 *   onAddSemester      — called when the user clicks "Add First Semester"
 *                        in the empty state. dashboard.js wires this to
 *                        openAddSemesterModal(store).
 *
 *   onNavigateProfile  — called when the user clicks "Set Up Profile" in
 *                        either the empty state or the profile nudge.
 *                        dashboard.js wires this to router.navigate('profile').
 *
 * No ViewRouter or modal import lives in this file — all navigation is
 * delegated upward via callbacks, keeping the components layer free of
 * core layer dependencies that violate the boundary matrix.
 *
 * ── ELEMENT-ID CONTRACT ─────────────────────────────────────────────────────
 *
 * Identity strip:
 *   #identity-name, #fv-dept, #fv-level, #fv-scale, #fv-session
 *
 * CGPA ring:
 *   #ring-fill-cgpa, #cgpa-value, #cgpa-denom, #cgpa-label
 *
 * Semester ring:
 *   #ring-fill-sem, #sem-value, #sem-denom, #sem-ring-label, #sem-ring-name
 *
 * Stats grid:
 *   #stat-sems, #stat-cu, #stat-courses
 *   #stat-sems-label, #stat-cu-label, #stat-courses-label
 *
 * Feature elements:
 *   #hero-delta, #hero-sparkline-row, #hero-spark-bars
 *   #hero-spark-first, #hero-spark-last, #hero-spark-label
 *   #hero-tier-progress, #hero-tier-bar-fill, #hero-tier-text
 *
 * Footer:
 *   #hero-class-badge, #hero-trend, #hero-scope, #record-meta
 *
 * Injected by this component (not present in static HTML):
 *   #hero-empty         — empty state panel (EmptyHeroState)
 *   #hero-profile-nudge — profile setup nudge (NudgeRenderer)
 */

import { BaseComponent } from '../../common/BaseComponent.js';
import { GPACalculatorService } from '@/services/GPACalculatorService.js';
import { Semester } from '@/domain/Semester.js';
import { formatGPA } from '@/utils/formatters.js';
import { RING, ALL_SEMESTERS_ID, DEFAULT_SCALE_ID } from '@/utils/constants.js';
import { getScale } from '@/utils/helpers.js';
import { watchState } from '@/utils/selector.js';

import { animateRing, setText } from './RingAnimator.js';
import { renderIdentity } from './IdentityRenderer.js';
import { renderNudge } from './NudgeRenderer.js';
import { renderEmptyHeroState } from './EmptyHeroState.js';
import { renderOverviewMode } from './OverviewMode.js';
import { renderSemesterMode } from './SemesterMode.js';
import { renderTierProgress } from './TierProgressRenderer.js';
import { renderFooter } from './FooterRenderer.js';

export class GPARings extends BaseComponent {
  /**
   * @param {HTMLElement} container
   * @param {Store}       store
   * @param {object}      [options]
   * @param {Function}    [options.onAddSemester]     open add-semester modal
   * @param {Function}    [options.onNavigateProfile] navigate to profile view
   */
  constructor(container, store, options = {}) {
    super(container, store);
    this._onAddSemester = options.onAddSemester ?? null;
    this._onNavigateProfile = options.onNavigateProfile ?? null;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  afterMount() {
    const unsub = watchState(
      this.store,
      (s) => [s.semesters, s.student, s.previousRecord, s.activeSemesterId],
      () => this.safeRender()
    );
    this.addSubscription(unsub);
  }

  // ── Main Render ────────────────────────────────────────────────────────────

  render() {
    const state = this.store.getState();
    const semesters = state.semesters.map(Semester.fromJSON);
    const student = state.student ?? {};
    const scaleId = student.scaleId ?? DEFAULT_SCALE_ID;
    const scale = getScale(scaleId);
    const maxGPA = scale.maxGPA;
    const activeId = state.activeSemesterId;
    const isEmpty = semesters.length === 0;

    // ── Empty mode — replaces ring content with first-use prompt ──────────
    renderEmptyHeroState(
      this.container,
      isEmpty,
      student,
      this._onAddSemester,
      this._onNavigateProfile
    );

    if (isEmpty) return; // Nothing else to render

    // ── Shared values (both overview and semester modes) ───────────────────
    const cgpa = GPACalculatorService.cgpaWithPreviousRecord(semesters, state.previousRecord);
    const trend = GPACalculatorService.trendDirection(semesters);
  
    // Classification is only meaningful once at least one course has been
    // graded. A CGPA of 0.00 from empty semesters means "no data yet", not
    // academic failure — passing null suppresses the badge in FooterRenderer
    // and TierProgressRenderer until there is real evidence to classify.
    const hasGradedData = semesters.some((s) => s.courseCount > 0);
    const honor = hasGradedData
      ? GPACalculatorService.getHonorClassification(cgpa, scaleId)
      : null;
      
    // ── Identity strip ─────────────────────────────────────────────────────
    renderIdentity(student, scale);

    // ── Profile nudge (has semesters but no name) ──────────────────────────
    renderNudge(student, semesters.length, this._onNavigateProfile);

    // ── CGPA ring — always the full programme CGPA ─────────────────────────
    animateRing('ring-fill-cgpa', cgpa, maxGPA, RING.CGPA_CIRCUMFERENCE);
    setText('cgpa-value', formatGPA(cgpa));
    setText('cgpa-denom', `/ ${maxGPA.toFixed(2)}`);
    setText('cgpa-label', 'Cumulative GPA');

    // ── Mode dispatch ──────────────────────────────────────────────────────
    const isOverview = !activeId || activeId === ALL_SEMESTERS_ID;

    if (isOverview) {
      renderOverviewMode(semesters, cgpa, maxGPA, scale);
    } else {
      const activeSem = semesters.find((s) => s.id === activeId) ?? semesters.at(-1);
      const prevSem = activeSem ? (semesters[semesters.indexOf(activeSem) - 1] ?? null) : null;
      renderSemesterMode(semesters, activeSem, prevSem, maxGPA);
    }

    // ── Next-tier progress (both modes, programme CGPA) ────────────────────
    renderTierProgress(cgpa, scale);

    // ── Footer ─────────────────────────────────────────────────────────────
    renderFooter(semesters, honor, trend, isOverview);
  }
}
