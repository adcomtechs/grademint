/**
 * @module AcademicInsights
 * @description Orchestrator for the three right-panel insight cards.
 *
 * This module is intentionally thin — it owns NO rendering logic of its own.
 * Its sole responsibilities are:
 *
 *   1. Create the three container elements for the sub-cards
 *   2. Instantiate ClassificationLadder, GoalTracker, PerformanceHighlights
 *   3. Mount each sub-card into its container
 *   4. Unmount them cleanly when this component unmounts
 *
 * WHY a dedicated orchestrator instead of doing everything in one file?
 *
 *   Separation of concerns — each card has a distinct purpose, a distinct
 *   subscription scope, and a distinct local state surface. Merging them
 *   into one file would mean re-rendering all three whenever any one of
 *   them changed, and would create a 600+ line component that is impossible
 *   to unit-test in isolation.
 *
 *   Independent subscription granularity — ClassificationLadder re-renders
 *   when semesters or scaleId change; GoalTracker surgically updates only
 *   its result area without calling render() at all; PerformanceHighlights
 *   re-renders on semester changes. None of them interfere with each other.
 *
 *   Scalability — adding a fourth card (e.g. a Semester Comparison card)
 *   requires creating one new file and adding three lines here. No existing
 *   file changes.
 *
 * MOUNT LIFECYCLE:
 *
 *   AcademicInsights.mount()
 *     → render()              creates three wrapper divs, appends to container
 *     → afterMount()          instantiates + mounts all three sub-cards
 *
 *   AcademicInsights.unmount()
 *     → unmounts all three sub-cards (cleans up their AbortControllers
 *       and store subscriptions)
 *     → calls super.unmount() (clears its own container + subscriptions)
 *
 * CSS:
 *   - insights.css  — all new .ic-*, .cl-*, .gt-*, .ph-* card styles
 *   - main.css      — .insights-card, .ladder-*, .grade--*, design tokens
 *
 *   No CSS is injected from this module or any of its sub-cards.
 *   app.css imports insights.css after the shared foundation styles.
 *
 * USAGE (from dashboard.js — no changes needed there):
 *
 *   const insightsEl = document.getElementById('desk-right');
 *   if (insightsEl) new AcademicInsights(insightsEl, store).mount();
 *
 * PATTERNS:
 *   - BaseComponent Template Method (mount → render → afterMount → unmount)
 *   - Composition over inheritance — owns instances, does not extend them
 *   - Explicit cleanup contract — _subCards array ensures every card is
 *     unmounted even if future cards are added without touching unmount()
 */

import { BaseComponent } from '../../common/BaseComponent.js';
import { createElement, clearElement } from '../../../utils/dom.js';
import { ClassificationLadder } from './ClassificationLadder.js';
import { GoalTracker } from './GoalTracker.js';
import { PerformanceHighlights } from './PerformanceHighlights.js';
import { createLogger } from '../../../utils/logger.js';

const log = createLogger('AcademicInsights');

export class AcademicInsights extends BaseComponent {
  /**
   * @param {HTMLElement} container  Maps to #desk-right in index.html
   * @param {ReturnType<import('@/core/Store.js').createStore>} store
   */
  constructor(container, store) {
    super(container, store);

    /**
     * All mounted sub-card instances.
     * Stored so unmount() can clean them all up without knowing their types.
     * @type {BaseComponent[]}
     */
    this._subCards = [];
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * render() creates the three empty wrapper divs and appends them to the
   * container. It intentionally does nothing else — sub-card DOM is owned
   * by the sub-cards themselves.
   *
   * Keeping render() free of sub-card logic means the orchestrator never
   * needs to know what the cards render — it only knows that they exist
   * and that they each need a container element.
   */
  render() {
    clearElement(this.container);

    // Three named slots — IDs are stable so future code can query them
    const ladderSlot = createElement('div', { id: 'insights-ladder', className: 'insights-slot' });
    const goalSlot = createElement('div', { id: 'insights-goal', className: 'insights-slot' });
    const highlightSlot = createElement('div', {
      id: 'insights-highlights',
      className: 'insights-slot',
    });

    this.container.append(ladderSlot, goalSlot, highlightSlot);
  }

  /**
   * afterMount() runs once after the initial render() has placed the wrapper
   * divs into the DOM. We instantiate and mount all three sub-cards here
   * so they have stable container elements to render into.
   *
   * The sub-cards set up their own store subscriptions inside their own
   * afterMount() hooks — the orchestrator never touches those subscriptions.
   */
  afterMount() {
    const ladderSlot = this.container.querySelector('#insights-ladder');
    const goalSlot = this.container.querySelector('#insights-goal');
    const highlightSlot = this.container.querySelector('#insights-highlights');

    // Defensive guard — if a future refactor removes a slot ID, we get a
    // clear error instead of a silent NullPointerException inside a sub-card.
    if (!ladderSlot || !goalSlot || !highlightSlot) {
      log.error(
        '[AcademicInsights] One or more slot elements are missing. ' +
          'Ensure render() has run before afterMount().'
      );
      return;
    }

    const ladder = new ClassificationLadder(ladderSlot, this.store);
    const goal = new GoalTracker(goalSlot, this.store);
    const highlights = new PerformanceHighlights(highlightSlot, this.store);

    // Mount all three — each calls its own render() + afterMount()
    ladder.mount();
    goal.mount();
    highlights.mount();

    // Track for cleanup
    this._subCards = [ladder, goal, highlights];
  }

  /**
   * Unmounts all sub-cards first (releasing their AbortControllers and
   * store subscriptions), then delegates to BaseComponent.unmount() which
   * clears this component's own container and subscriptions.
   *
   * The order matters: sub-cards must be unmounted before the container
   * is cleared, otherwise their clearElement() calls reference detached nodes.
   */
  unmount() {
    this._subCards.forEach((card) => card.unmount());
    this._subCards = [];
    super.unmount();
  }
}
