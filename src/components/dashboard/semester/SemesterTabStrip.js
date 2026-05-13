/**
 * @module SemesterTabStrip
 * @description Two-tier semester navigation that groups semesters by academic level.
 *
 * ARCHITECTURE DECISION — WHY TWO TIERS:
 *   A flat tab strip scales to ~3 semesters before overflowing on mobile and
 *   ~6 before overflowing on desktop. Nigerian university programmes have up to
 *   10 semesters (5 levels × 2 semesters each). A two-tier design solves this:
 *
 *   Row 1 — Level strip:     [∑ Overview] │ [100L ②] [200L ②] [300L ②] [400L ②]
 *   Row 2 — Semester strip:              [First Semester  ✎ ×] [Second Semester ✎ ×]
 *
 *   The level strip has at most 6 items (Overview + 5 levels), always fits on screen.
 *   The semester strip has at most 2–3 items per level, never overflows.
 *
 * GROUPING STRATEGY:
 *   Levels are detected from semester labels using a regex that recognises:
 *     - "100L", "200L", "300L", "400L", "500L" (Nigerian format — canonical)
 *     - "Year 1", "Year 2" ... (alternative format)
 *     - "Level 1", "Level 2" ... (alternative format)
 *   Semesters whose labels don't match any pattern are rendered as ungrouped
 *   pills in the level strip (compatible with the old flat design).
 *   When NO semesters match any pattern the component falls back entirely to
 *   the original flat single-row tab strip.
 *
 * CALLBACKS (unchanged from original contract):
 *   onRename(id, label) — delegated to semesterModals.js
 *   onDelete(id, label) — delegated to semesterModals.js
 *
 * STATE:
 *   _activeLevel  — which level pill is "expanded" (independent of store).
 *                   Populated from the active semester on mount and on every
 *                   store change. Cleared when Overview is selected.
 */

import { BaseComponent } from '../../common/BaseComponent.js';
import { createElement, clearElement } from '../../../utils/dom.js';
import { watchState } from '../../../utils/selector.js';
import { ALL_SEMESTERS_ID, UI_KEYS } from '../../../utils/constants.js';
import { uiStorage } from '../../../services/UIStorageService.js';
import { Semester } from '../../../domain/Semester.js';

// ── Level detection utilities ─────────────────────────────────────────────────

/**
 * Extracts a canonical level key from a semester label.
 * Returns null when no recognisable pattern is found.
 *
 * @param {string} label
 * @returns {string|null}
 */
function extractLevel(label) {
  if (!label) return null;

  // Primary: 100L … 900L (Nigerian / West African format)
  const levelMatch = label.match(/\b([1-9]\d{2}[Ll])\b/);
  if (levelMatch) return levelMatch[1].toUpperCase();

  // Secondary: "Year 1" … "Year 9"
  const yearMatch = label.match(/\bYear\s*([1-9])\b/i);
  if (yearMatch) return `Year ${yearMatch[1]}`;

  // Tertiary: "Level 1" … "Level 9"
  const lvlMatch = label.match(/\bLevel\s*([1-9])\b/i);
  if (lvlMatch) return `Level ${lvlMatch[1]}`;

  return null;
}

/**
 * Removes the level prefix from a label so sub-tab labels stay concise.
 * "300L First Semester" → "First Semester"
 * "Year 2 — Semester 1" → "Semester 1"
 *
 * @param {string} label
 * @param {string|null} level
 * @returns {string}
 */
function shortLabel(label, level) {
  if (!level) return label;
  const cleaned = label
    .replace(new RegExp(`\\b${level}\\b`, 'i'), '')
    .replace(/^[\s\-–—,]+/, '')
    .replace(/[\s\-–—,]+$/, '')
    .trim();
  return cleaned || label;
}

/**
 * Groups an array of Semester domain objects by detected level.
 *
 * @param {Semester[]} semesters
 * @returns {{
 *   grouped:   Map<string, Semester[]>,
 *   ungrouped: Semester[],
 *   hasGroups: boolean,
 * }}
 */
function groupSemesters(semesters) {
  const grouped = new Map();
  const ungrouped = [];

  for (const sem of semesters) {
    const level = extractLevel(sem.label);
    if (level) {
      if (!grouped.has(level)) grouped.set(level, []);
      grouped.get(level).push(sem);
    } else {
      ungrouped.push(sem);
    }
  }

  return { grouped, ungrouped, hasGroups: grouped.size > 0 };
}

// ── Component ─────────────────────────────────────────────────────────────────

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

    /**
     * Currently expanded level key (e.g. "300L").
     * Null when Overview is active or when in flat mode.
     * @type {string|null}
     */
    this._activeLevel = null;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  afterMount() {
    const tabsEl = document.getElementById('semester-tabs');
    if (tabsEl) {
      // Single delegated listener handles all click targets inside the strip.
      this.addListener(tabsEl, 'click', (e) => this._handleClick(e));
    }

    // Sync _activeLevel on first mount.
    this._syncActiveLevelFromStore();

    const unsub = watchState(
      this.store,
      (s) => [s.semesters, s.activeSemesterId],
      () => {
        this._syncActiveLevelFromStore();
        this.safeRender();
      }
    );
    this.addSubscription(unsub);
  }

  // ── Level sync ─────────────────────────────────────────────────────────────

  /**
   * Derives _activeLevel from the current activeSemesterId in the store.
   * Called on mount and on every relevant state change.
   */
  _syncActiveLevelFromStore() {
    const { semesters: raw, activeSemesterId } = this.store.getState();
    if (!activeSemesterId || activeSemesterId === ALL_SEMESTERS_ID) return;

    const semesters = raw.map(Semester.fromJSON);
    const active = semesters.find((s) => s.id === activeSemesterId);
    if (!active) return;

    const level = extractLevel(active.label);
    if (level) this._activeLevel = level;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  render() {
    const tabsEl = document.getElementById('semester-tabs');
    if (!tabsEl) return;

    const { semesters: raw, activeSemesterId } = this.store.getState();
    const semesters = raw.map(Semester.fromJSON);
    const isOverviewActive = !activeSemesterId || activeSemesterId === ALL_SEMESTERS_ID;
    const { grouped, ungrouped, hasGroups } = groupSemesters(semesters);

    clearElement(tabsEl);

    if (hasGroups) {
      this._renderGrouped(tabsEl, grouped, ungrouped, activeSemesterId, isOverviewActive);
    } else {
      this._renderFlat(tabsEl, semesters, activeSemesterId, isOverviewActive);
    }
  }

  // ── Grouped render ─────────────────────────────────────────────────────────

  _renderGrouped(tabsEl, grouped, ungrouped, activeSemesterId, isOverviewActive) {
    tabsEl.className = 'semester-tabs semester-tabs--grouped';

    // ── Row 1: Level strip ───────────────────────────────────────────────────
    const levelStrip = createElement('div', {
      className: 'tabs-level-strip',
      role: 'tablist',
      'aria-label': 'Academic levels',
    });

    // Overview button — always first
    levelStrip.append(this._buildLevelOverviewBtn(isOverviewActive));

    // Vertical separator
    levelStrip.append(
      createElement('div', {
        className: 'tabs-level-divider',
        'aria-hidden': 'true',
      })
    );

    // Level pills
    const pillsWrap = createElement('div', { className: 'tabs-level-pills' });
    for (const [level, sems] of grouped) {
      const isLevelActive = !isOverviewActive && this._activeLevel === level;
      pillsWrap.append(this._buildLevelPill(level, sems, isLevelActive, activeSemesterId));
    }
    levelStrip.append(pillsWrap);

    // Ungrouped semesters rendered as plain level-style pills at the end
    for (const sem of ungrouped) {
      levelStrip.append(this._buildUngroupedPill(sem, sem.id === activeSemesterId));
    }

    tabsEl.append(levelStrip);

    // ── Row 2: Semester sub-strip ────────────────────────────────────────────
    // Only rendered when a level is actively selected and has semesters.
    if (!isOverviewActive && this._activeLevel && grouped.has(this._activeLevel)) {
      const levelSems = grouped.get(this._activeLevel);
      tabsEl.append(this._buildSemStrip(levelSems, activeSemesterId));
    }
  }

  // ── Grouped builders ───────────────────────────────────────────────────────

  _buildLevelOverviewBtn(isActive) {
    return createElement(
      'button',
      {
        type: 'button',
        className: `tabs-level-btn tabs-level-btn--overview${isActive ? ' is-active' : ''}`,
        role: 'tab',
        'aria-selected': String(isActive),
        title: 'Programme overview — all semesters combined',
        dataset: { id: ALL_SEMESTERS_ID },
      },
      createElement('span', { className: 'tabs-level-overview-icon', 'aria-hidden': 'true' }, '∑'),
      createElement('span', { className: 'tabs-level-overview-label' }, 'Overview')
    );
  }

  /**
   * @param {string}     level
   * @param {Semester[]} sems
   * @param {boolean}    isLevelActive
   * @param {string}     activeSemesterId
   */
  _buildLevelPill(level, sems, isLevelActive, activeSemesterId) {
    // A dot indicator shows when a semester within this level is active
    // but the level pill itself is not expanded (shouldn't happen, but defensive).
    const hasActiveSem = sems.some((s) => s.id === activeSemesterId);

    return createElement(
      'button',
      {
        type: 'button',
        className: `tabs-level-btn${isLevelActive ? ' is-active' : ''}${hasActiveSem && !isLevelActive ? ' has-active-sem' : ''}`,
        role: 'tab',
        'aria-selected': String(isLevelActive),
        'aria-expanded': String(isLevelActive),
        title: `${level} — ${sems.length} semester${sems.length !== 1 ? 's' : ''}`,
        dataset: { level },
      },
      createElement('span', { className: 'tabs-level-label' }, level),
      createElement(
        'span',
        { className: `tabs-level-count${isLevelActive ? ' is-active' : ''}` },
        String(sems.length)
      )
    );
  }

  _buildUngroupedPill(sem, isActive) {
    return createElement(
      'button',
      {
        type: 'button',
        className: `tabs-level-btn tabs-level-btn--ungrouped${isActive ? ' is-active' : ''}`,
        role: 'tab',
        'aria-selected': String(isActive),
        title: sem.label,
        dataset: { id: sem.id },
      },
      createElement('span', { className: 'tabs-level-label' }, sem.label)
    );
  }

  /**
   * Builds the semester sub-strip (row 2).
   * @param {Semester[]} sems
   * @param {string}     activeSemesterId
   */
  _buildSemStrip(sems, activeSemesterId) {
    const strip = createElement('div', {
      className: 'tabs-sem-strip',
      role: 'tablist',
      'aria-label': `Semesters in ${this._activeLevel}`,
    });

    for (const sem of sems) {
      const isActive = sem.id === activeSemesterId;
      const label = shortLabel(sem.label, this._activeLevel) || sem.label;

      strip.append(
        createElement(
          'button',
          {
            type: 'button',
            className: `tabs-sem-btn${isActive ? ' is-active' : ''}`,
            role: 'tab',
            'aria-selected': String(isActive),
            title: sem.label,
            id: `tab-${sem.id}`,
            dataset: { id: sem.id },
          },
          createElement('span', { className: 'tabs-sem-label' }, label),
          createElement(
            'span',
            {
              className: 'tab-action tab-rename',
              title: 'Rename semester',
              'aria-label': `Rename ${sem.label}`,
              dataset: { action: 'rename', id: sem.id, label: sem.label },
            },
            '✎'
          ),
          createElement(
            'span',
            {
              className: 'tab-action tab-delete',
              title: 'Delete semester',
              'aria-label': `Delete ${sem.label}`,
              dataset: { action: 'delete', id: sem.id, label: sem.label },
            },
            '×'
          )
        )
      );
    }

    return strip;
  }

  // ── Flat render ────────────────────────────────────────────────────────────

  /** Fallback for semesters with no detectable level pattern. */
  _renderFlat(tabsEl, semesters, activeSemesterId, isOverviewActive) {
    tabsEl.className = 'semester-tabs semester-tabs--flat';

    tabsEl.append(this._buildFlatOverviewTab(isOverviewActive));
    for (const sem of semesters) {
      tabsEl.append(this._buildFlatSemTab(sem, sem.id === activeSemesterId));
    }
  }

  _buildFlatOverviewTab(isActive) {
    return createElement(
      'button',
      {
        type: 'button',
        className: `semester-tab semester-tab--overview${isActive ? ' is-active' : ''}`,
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

  _buildFlatSemTab(sem, isActive) {
    return createElement(
      'button',
      {
        type: 'button',
        className: `semester-tab${isActive ? ' is-active' : ''}`,
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
          className: 'tab-action tab-rename',
          title: 'Rename semester',
          dataset: { action: 'rename', id: sem.id, label: sem.label },
        },
        '✎'
      ),
      createElement(
        'span',
        {
          className: 'tab-action tab-delete',
          title: 'Delete semester',
          dataset: { action: 'delete', id: sem.id, label: sem.label },
        },
        '×'
      )
    );
  }

  // ── Click handler ──────────────────────────────────────────────────────────

  _handleClick(e) {
    // ── 1. Action buttons (rename / delete) ─────────────────────────────────
    const actionEl = e.target.closest('[data-action]');
    if (actionEl) {
      e.stopPropagation();
      const { action, id, label } = actionEl.dataset;
      if (action === 'rename') this._onRename(id, label);
      if (action === 'delete') this._onDelete(id, label);
      return;
    }

    // ── 2. Level pill click ─────────────────────────────────────────────────
    const levelBtn = e.target.closest('[data-level]');
    if (levelBtn) {
      e.stopPropagation();
      this._activateLevel(levelBtn.dataset.level);
      return;
    }

    // ── 3. Semester tab / overview click ────────────────────────────────────
    const tabEl = e.target.closest('[data-id]');
    if (!tabEl) return;

    const { id } = tabEl.dataset;
    if (!id) return;

    if (id === ALL_SEMESTERS_ID) {
      // Overview selected — clear active level
      this._activeLevel = null;
      uiStorage.set(UI_KEYS.ACTIVE_SEMESTER_ID, ALL_SEMESTERS_ID);
      this.store.dispatch({ type: 'SET_ACTIVE_SEMESTER', payload: { id: ALL_SEMESTERS_ID } });
      return;
    }

    // Semester click — no-op if already active
    if (id === this.store.getState().activeSemesterId) return;
    uiStorage.set(UI_KEYS.ACTIVE_SEMESTER_ID, id);
    this.store.dispatch({ type: 'SET_ACTIVE_SEMESTER', payload: { id } });
  }

  /**
   * Expands a level: sets _activeLevel and activates the first semester in it
   * (unless a semester within this level is already active).
   *
   * @param {string} level
   */
  _activateLevel(level) {
    const { semesters: raw, activeSemesterId } = this.store.getState();
    const semesters = raw.map(Semester.fromJSON);
    const { grouped } = groupSemesters(semesters);

    const levelSems = grouped.get(level);
    if (!levelSems || levelSems.length === 0) return;

    this._activeLevel = level;

    // If a semester within this level is already active, just re-render
    // to show the sub-strip without changing the active semester.
    if (levelSems.some((s) => s.id === activeSemesterId)) {
      this.safeRender();
      return;
    }

    // Otherwise activate the first semester in this level.
    const firstSem = levelSems[0];
    uiStorage.set(UI_KEYS.ACTIVE_SEMESTER_ID, firstSem.id);
    this.store.dispatch({ type: 'SET_ACTIVE_SEMESTER', payload: { id: firstSem.id } });
  }
}

// /**
//  * @module SemesterTabStrip
//  * @description Renders the semester tab bar and handles all tab interactions.
//  *
//  * RESPONSIBILITIES (exactly two):
//  *   1. Render the tab strip: [∑ Overview] [Sem A] [Sem B] ...
//  *   2. Handle tab clicks via delegated event listener:
//  *      - Overview tab   → dispatch SET_ACTIVE_SEMESTER { id: ALL_SEMESTERS_ID }
//  *      - Semester tab   → dispatch SET_ACTIVE_SEMESTER { id: uuid }
//  *      - Rename action  → calls onRename(id, label) callback
//  *      - Delete action  → calls onDelete(id, label) callback
//  *
//  * CALLBACKS:
//  * Rename and delete actions are delegated upward via callbacks rather than
//  * handled here because they open modals — modal logic lives in semesterModals.js,
//  * not in a rendering component. The tab strip does not know what a modal is.
//  *
//  * CONTAINER:
//  * Renders into the #semester-tabs element. The container is the full
//  * semesters-section element passed by SemesterManager — SemesterTabStrip
//  * locates #semester-tabs by ID within the document, consistent with how
//  * all other components that target specific IDs operate.
//  */

// import { BaseComponent } from '../../common/BaseComponent.js';
// import { createElement, clearElement } from '../../../utils/dom.js';
// import { watchState } from '../../../utils/selector.js';
// import { ALL_SEMESTERS_ID, UI_KEYS } from '../../../utils/constants.js';
// import { uiStorage } from '../../../services/UIStorageService.js';
// import { Semester } from '../../../domain/Semester.js';

// export class SemesterTabStrip extends BaseComponent {
//   /**
//    * @param {HTMLElement} container
//    * @param {ReturnType<import('../../../core/Store.js').createStore>} store
//    * @param {{ onRename: Function, onDelete: Function }} callbacks
//    */
//   constructor(container, store, { onRename, onDelete }) {
//     super(container, store);
//     this._onRename = onRename;
//     this._onDelete = onDelete;
//   }

//   // ── Lifecycle ──────────────────────────────────────────────────────────────

//   afterMount() {
//     // Delegated click listener on the stable #semester-tabs container.
//     // One listener handles all tab clicks — past, present, and future tabs.
//     const tabsEl = document.getElementById('semester-tabs');
//     if (tabsEl) {
//       this.addListener(tabsEl, 'click', (e) => this._handleClick(e));
//     }

//     const unsub = watchState(
//       this.store,
//       (s) => [s.semesters, s.activeSemesterId],
//       () => this.safeRender()
//     );
//     this.addSubscription(unsub);
//   }

//   render() {
//     const tabsEl = document.getElementById('semester-tabs');
//     if (!tabsEl) return;

//     const state = this.store.getState();
//     const semesters = state.semesters.map(Semester.fromJSON);
//     const activeId = state.activeSemesterId;

//     clearElement(tabsEl);
//     tabsEl.append(
//       this._buildOverviewTab(activeId),
//       ...semesters.map((sem) => this._buildSemesterTab(sem, activeId))
//     );
//   }

//   // ── Tab builders ───────────────────────────────────────────────────────────

//   _buildOverviewTab(activeId) {
//     const isActive = !activeId || activeId === ALL_SEMESTERS_ID;
//     return createElement(
//       'button',
//       {
//         className: `semester-tab semester-tab--overview ${isActive ? 'is-active' : ''}`,
//         role: 'tab',
//         'aria-selected': String(isActive),
//         'aria-controls': 'semester-panel',
//         'aria-label': 'View all semesters — programme overview',
//         title: 'Show programme totals and CGPA overview',
//         id: 'tab-overview',
//         dataset: { id: ALL_SEMESTERS_ID },
//       },
//       createElement(
//         'span',
//         { className: 'semester-tab__overview-icon', 'aria-hidden': 'true' },
//         '∑'
//       ),
//       createElement('span', {}, 'Overview')
//     );
//   }

//   _buildSemesterTab(sem, activeId) {
//     const isActive = sem.id === activeId;
//     return createElement(
//       'button',
//       {
//         className: `semester-tab ${isActive ? 'is-active' : ''}`,
//         role: 'tab',
//         'aria-selected': String(isActive),
//         'aria-controls': 'semester-panel',
//         id: `tab-${sem.id}`,
//         dataset: { id: sem.id },
//       },
//       createElement('span', {}, sem.label),
//       createElement(
//         'span',
//         {
//           className: 'tab-rename',
//           title: 'Rename semester',
//           dataset: { action: 'rename', id: sem.id, label: sem.label },
//         },
//         '✎'
//       ),
//       createElement(
//         'span',
//         {
//           className: 'tab-delete',
//           title: 'Delete semester',
//           dataset: { action: 'delete', id: sem.id, label: sem.label },
//         },
//         '×'
//       )
//     );
//   }

//   // ── Click handler ──────────────────────────────────────────────────────────

//   _handleClick(e) {
//     // Action buttons (rename / delete) — stop here, do not switch tab
//     const actionEl = e.target.closest('[data-action]');
//     if (actionEl) {
//       e.stopPropagation();
//       const { action, id, label } = actionEl.dataset;
//       if (action === 'rename') this._onRename(id, label);
//       if (action === 'delete') this._onDelete(id, label);
//       return;
//     }

//     // Tab click — switch active semester
//     const tabEl = e.target.closest('.semester-tab');
//     if (!tabEl) return;

//     const { id } = tabEl.dataset;
//     if (!id || id === this.store.getState().activeSemesterId) return;

//     uiStorage.set(UI_KEYS.ACTIVE_SEMESTER_ID, id);
//     this.store.dispatch({ type: 'SET_ACTIVE_SEMESTER', payload: { id } });
//   }
// }
