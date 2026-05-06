/**
 * @module SemesterTabStrip
 * @description Renders the semester tab bar and handles all tab interactions.
 *
 * RESPONSIBILITIES (exactly two):
 *   1. Render the tab strip: [∑ Overview] [Sem A] [Sem B] ...
 *   2. Handle tab clicks via delegated event listener:
 *      - Overview tab   → dispatch SET_ACTIVE_SEMESTER { id: ALL_SEMESTERS_ID }
 *      - Semester tab   → dispatch SET_ACTIVE_SEMESTER { id: uuid }
 *      - Rename action  → calls onRename(id, label) callback
 *      - Delete action  → calls onDelete(id, label) callback
 *
 * CALLBACKS:
 * Rename and delete actions are delegated upward via callbacks rather than
 * handled here because they open modals — modal logic lives in semesterModals.js,
 * not in a rendering component. The tab strip does not know what a modal is.
 *
 * CONTAINER:
 * Renders into the #semester-tabs element. The container is the full
 * semesters-section element passed by SemesterManager — SemesterTabStrip
 * locates #semester-tabs by ID within the document, consistent with how
 * all other components that target specific IDs operate.
 */

import { BaseComponent } from '../../common/BaseComponent.js';
import { createElement, clearElement } from '../../../utils/dom.js';
import { watchState } from '../../../utils/selector.js';
import { ALL_SEMESTERS_ID, UI_KEYS } from '../../../utils/constants.js';
import { uiStorage } from '../../../services/UIStorageService.js';
import { Semester } from '../../../domain/Semester.js';

export class SemesterTabStrip extends BaseComponent {
  /**
   * @param {HTMLElement} container
   * @param {ReturnType<import('../../../core/Store.js').createStore>} store
   * @param {{ onRename: Function, onDelete: Function }} callbacks
   */
  constructor(container, store, { onRename, onDelete }) {
    super(container, store);
    this._onRename = onRename;
    this._onDelete = onDelete;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  afterMount() {
    // Delegated click listener on the stable #semester-tabs container.
    // One listener handles all tab clicks — past, present, and future tabs.
    const tabsEl = document.getElementById('semester-tabs');
    if (tabsEl) {
      this.addListener(tabsEl, 'click', (e) => this._handleClick(e));
    }

    const unsub = watchState(
      this.store,
      (s) => [s.semesters, s.activeSemesterId],
      () => this.safeRender()
    );
    this.addSubscription(unsub);
  }

  render() {
    const tabsEl = document.getElementById('semester-tabs');
    if (!tabsEl) return;

    const state = this.store.getState();
    const semesters = state.semesters.map(Semester.fromJSON);
    const activeId = state.activeSemesterId;

    clearElement(tabsEl);
    tabsEl.append(
      this._buildOverviewTab(activeId),
      ...semesters.map((sem) => this._buildSemesterTab(sem, activeId))
    );
  }

  // ── Tab builders ───────────────────────────────────────────────────────────

  _buildOverviewTab(activeId) {
    const isActive = !activeId || activeId === ALL_SEMESTERS_ID;
    return createElement(
      'button',
      {
        className: `semester-tab semester-tab--overview ${isActive ? 'is-active' : ''}`,
        role: 'tab',
        'aria-selected': String(isActive),
        'aria-controls': 'semester-panel',
        'aria-label': 'View all semesters — programme overview',
        title: 'Show programme totals and CGPA overview',
        id: 'tab-overview',
        dataset: { id: ALL_SEMESTERS_ID },
      },
      createElement(
        'span',
        { className: 'semester-tab__overview-icon', 'aria-hidden': 'true' },
        '∑'
      ),
      createElement('span', {}, 'Overview')
    );
  }

  _buildSemesterTab(sem, activeId) {
    const isActive = sem.id === activeId;
    return createElement(
      'button',
      {
        className: `semester-tab ${isActive ? 'is-active' : ''}`,
        role: 'tab',
        'aria-selected': String(isActive),
        'aria-controls': 'semester-panel',
        id: `tab-${sem.id}`,
        dataset: { id: sem.id },
      },
      createElement('span', {}, sem.label),
      createElement(
        'span',
        {
          className: 'tab-rename',
          title: 'Rename semester',
          dataset: { action: 'rename', id: sem.id, label: sem.label },
        },
        '✎'
      ),
      createElement(
        'span',
        {
          className: 'tab-delete',
          title: 'Delete semester',
          dataset: { action: 'delete', id: sem.id, label: sem.label },
        },
        '×'
      )
    );
  }

  // ── Click handler ──────────────────────────────────────────────────────────

  _handleClick(e) {
    // Action buttons (rename / delete) — stop here, do not switch tab
    const actionEl = e.target.closest('[data-action]');
    if (actionEl) {
      e.stopPropagation();
      const { action, id, label } = actionEl.dataset;
      if (action === 'rename') this._onRename(id, label);
      if (action === 'delete') this._onDelete(id, label);
      return;
    }

    // Tab click — switch active semester
    const tabEl = e.target.closest('.semester-tab');
    if (!tabEl) return;

    const { id } = tabEl.dataset;
    if (!id || id === this.store.getState().activeSemesterId) return;

    uiStorage.set(UI_KEYS.ACTIVE_SEMESTER_ID, id);
    this.store.dispatch({ type: 'SET_ACTIVE_SEMESTER', payload: { id } });
  }
}
