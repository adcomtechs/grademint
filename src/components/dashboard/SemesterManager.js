/**
 * @module SemesterManager
 * @description Thin orchestrator for the semester section.
 *
 * RESPONSIBILITY (exactly one):
 * Route to the correct panel (OverviewPanel or SemesterPanel) based on the
 * active semester ID, and coordinate the three sub-components that make up
 * the semester section.
 *
 * DOES NOT:
 * - Render tabs (SemesterTabStrip)
 * - Render the overview table (OverviewPanel)
 * - Render course tables (SemesterPanel)
 * - Construct modals (semesterModals.js)
 *
 * COMPOSITION:
 *   SemesterManager
 *     ├── SemesterTabStrip   → mounts into #semester-tabs
 *     ├── OverviewPanel      → mounts into #semester-panel (when overview active)
 *     └── SemesterPanel      → mounts into #semester-panel (when semester active)
 *
 * Child components are mounted once in afterMount() and remain alive for
 * the application's lifetime. Panel switching is handled by showing/hiding
 * the panel container, not by re-mounting components.
 */

import { BaseComponent } from '../common/BaseComponent.js';
import { SemesterTabStrip } from './semester/SemesterTabStrip.js';
import { OverviewPanel } from './semester/OverviewPanel.js';
import { SemesterPanel } from './semester/SemesterPanel.js';
import {
  openRenameModal,
  openEditCourseModal,
  confirmDeleteSemester,
  confirmDeleteCourse,
} from './semester/semesterModals.js';
import { Semester } from '../../domain/Semester.js';
import { watchState } from '../../utils/selector.js';
import { ALL_SEMESTERS_ID } from '../../utils/constants.js';
import { createElement } from '../../utils/dom.js';

export class SemesterManager extends BaseComponent {
  constructor(container, store) {
    super(container, store);

    /** @type {SemesterTabStrip|null} */
    this._tabStrip = null;
    /** @type {OverviewPanel|null} */
    this._overviewPanel = null;
    /** @type {SemesterPanel|null} */
    this._semesterPanel = null;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  afterMount() {
    // Subscribe only to activeSemesterId — that is the only slice
    // this orchestrator cares about for routing decisions.
    const unsub = watchState(
      this.store,
      (s) => [s.semesters, s.activeSemesterId],
      () => this.safeRender()
    );
    this.addSubscription(unsub);
  }

  unmount() {
    this._tabStrip?.unmount();
    this._overviewPanel?.unmount();
    this._semesterPanel?.unmount();
    super.unmount();
  }

  // ── Main render — routing only ─────────────────────────────────────────────

  render() {
    const state = this.store.getState();
    const semesters = state.semesters.map(Semester.fromJSON);
    const activeId = state.activeSemesterId;

    const semSection = document.getElementById('semesters-section');
    const emptyState = document.getElementById('empty-state');
    const dashSection = document.getElementById('dashboard-section');
    const skeleton = document.getElementById('skeleton-screen');

    if (skeleton) skeleton.hidden = true;

    if (semesters.length === 0) {
      if (dashSection) dashSection.hidden = false;
      if (semSection) semSection.hidden = true;
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (dashSection) dashSection.hidden = false;
    if (semSection) semSection.hidden = false;
    if (emptyState) emptyState.hidden = true;

    this._ensureSubComponents();
    this._updatePanelCount(semesters);
    this._routePanel(activeId);
  }

  // ── Sub-component lifecycle ────────────────────────────────────────────────

  /**
   * Mounts sub-components on first render.
   * Each is mounted once and lives for the duration of the session.
   */
  _ensureSubComponents() {
    // Tab strip — targets #semester-tabs by ID
    if (!this._tabStrip) {
      const tabsContainer =
        document.getElementById('semester-tabs')?.parentElement ??
        document.getElementById('semesters-section');
      if (tabsContainer) {
        this._tabStrip = new SemesterTabStrip(tabsContainer, this.store, {
          onRename: (id, label) => openRenameModal(this.store, id, label),
          onDelete: (id, label) => confirmDeleteSemester(this.store, id, label),
        });
        this._tabStrip.mount();
      }
    }

    // Overview and semester panels share the same #semester-panel container.
    // Both are kept alive — visibility is toggled, not re-mounted.
    const panelEl = document.getElementById('semester-panel');
    if (panelEl && !this._overviewPanel) {
      const overviewContainer = createElement('div', { className: 'overview-panel-host' });
      const semesterContainer = createElement('div', { className: 'semester-panel-host' });
      panelEl.append(overviewContainer, semesterContainer);

      this._overviewPanel = new OverviewPanel(overviewContainer, this.store);
      this._overviewPanel.mount();

      this._semesterPanel = new SemesterPanel(semesterContainer, this.store, {
        onEditCourse: (course, semId) => openEditCourseModal(this.store, course, semId),
        onDeleteCourse: (course, semId) => confirmDeleteCourse(this.store, course, semId),
      });
      this._semesterPanel.mount();
    }
  }

  /**
   * Updates the semester count badge in the panel header.
   * @param {Semester[]} semesters
   */
  _updatePanelCount(semesters) {
    const countEl = document.getElementById('record-count');
    if (countEl) countEl.textContent = String(semesters.length);
  }

  /**
   * Shows the correct panel based on the active semester ID.
   * Toggles host element visibility — does not re-mount components.
   *
   * @param {string|null} activeId
   */
  _routePanel(activeId) {
    const isOverview = !activeId || activeId === ALL_SEMESTERS_ID;

    const overviewHost = this.container.querySelector('.overview-panel-host');
    const semesterHost = this.container.querySelector('.semester-panel-host');

    if (overviewHost) overviewHost.hidden = !isOverview;
    if (semesterHost) semesterHost.hidden = isOverview;
  }
}

// ── Standalone export — backward compat with dashboard.js ─────────────────────
// dashboard.js imports openAddSemesterModal directly.
// Re-exporting here avoids changing the dashboard entry point.
export { openAddSemesterModal } from './semester/semesterModals.js';
