/**
 * @module WhatIfView
 * @description Thin orchestrator for the What-If Calculator view.
 *
 * RESPONSIBILITY (exactly one):
 * Mount the five sub-panels and show an empty state when there is no data.
 *
 * SUB-PANELS (each extends BaseComponent, manages its own subscriptions):
 *   StandingPanel          — current CGPA ring + next-tier progress
 *   LadderPanel            — honour classification ladder
 *   TargetCalculatorPanel  — preset + slider + required GPA result
 *   SimulatorPanel         — hypothetical semesters + projection chart
 *   SensitivityPanel       — CGPA sensitivity grid
 *
 * The two-column layout (Ladder | Target Calculator) is achieved via CSS
 * on the .wi-two-col wrapper div — WhatIfView only creates the structure.
 */

import { BaseComponent } from '../common/BaseComponent.js';
import { StandingPanel } from './whatif/StandingPanel.js';
import { LadderPanel } from './whatif/LadderPanel.js';
import { TargetCalculatorPanel } from './whatif/TargetCalculatorPanel.js';
import { SimulatorPanel } from './whatif/SimulatorPanel.js';
import { SensitivityPanel } from './whatif/SensitivityPanel.js';
import { Semester } from '../../domain/Semester.js';
import { createElement, clearElement } from '../../utils/dom.js';
import { watchState } from '../../utils/selector.js';
import { DEFAULT_SCALE_ID } from '../../utils/constants.js';
import { getScale } from '../../utils/helpers.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('WhatIfView');

export class WhatIfView extends BaseComponent {
  constructor(container, store) {
    super(container, store);

    /** @type {BaseComponent[]} All mounted sub-panels */
    this._panels = [];
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  afterMount() {
    const unsub = watchState(
      this.store,
      (s) => s.semesters.length, // Only re-route on empty ↔ non-empty transition
      () => this.safeRender()
    );
    this.addSubscription(unsub);
  }

  unmount() {
    this._panels.forEach((p) => p.unmount());
    this._panels = [];
    super.unmount();
  }

  /**
   * Called by ViewRouter when this view becomes active.
   * Each panel manages its own re-render when store state changes.
   * The activate() call only ensures panels render with correct canvas dimensions.
   */
  activate() {
    log.debug('WhatIfView activated');
    this._panels.forEach((p) => p.safeRender());
  }

  // ── Render — structure only ────────────────────────────────────────────────

  render() {
    // Unmount existing panels before rebuilding the layout
    this._panels.forEach((p) => p.unmount());
    this._panels = [];
    clearElement(this.container);

    const state = this.store.getState();
    const semesters = (state.semesters ?? []).map(Semester.fromJSON);
    const scaleId = state.student?.scaleId ?? DEFAULT_SCALE_ID;
    const scale = getScale(scaleId);
    const studentName = state.student?.name ?? '';

    const root = createElement('div', { className: 'wi-root' });

    // Page heading
    root.append(
      createElement(
        'div',
        { className: 'wi-page-heading' },
        createElement('h2', {}, '🎯 What-If Calculator'),
        createElement(
          'p',
          {},
          `Plan your academic path · ${scale.label}` + (studentName ? ` · ${studentName}` : '')
        )
      )
    );

    if (semesters.length === 0) {
      root.append(this._buildEmpty());
      this.container.append(root);
      return;
    }

    // ── Panel 1: Standing ────────────────────────────────────────────────────
    const standingContainer = createElement('div');
    root.append(standingContainer);
    this._mountPanel(new StandingPanel(standingContainer, this.store));

    // ── Panels 2 + 3: Ladder | Target Calculator (two-column) ───────────────
    const twoCol = createElement('div', { className: 'wi-two-col' });
    const ladderContainer = createElement('div');
    const targetContainer = createElement('div');
    twoCol.append(ladderContainer, targetContainer);
    root.append(twoCol);
    this._mountPanel(new LadderPanel(ladderContainer, this.store));
    this._mountPanel(new TargetCalculatorPanel(targetContainer, this.store));

    // ── Panel 4: Simulator ───────────────────────────────────────────────────
    const simContainer = createElement('div');
    root.append(simContainer);
    this._mountPanel(new SimulatorPanel(simContainer, this.store));

    // ── Panel 5: Sensitivity ─────────────────────────────────────────────────
    const sensContainer = createElement('div');
    root.append(sensContainer);
    this._mountPanel(new SensitivityPanel(sensContainer, this.store));

    this.container.append(root);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Mounts a panel and registers it for cleanup on unmount.
   * @param {BaseComponent} panel
   */
  _mountPanel(panel) {
    panel.mount();
    this._panels.push(panel);
  }

  _buildEmpty() {
    return createElement(
      'div',
      { className: 'wi-empty' },
      createElement('div', { className: 'wi-empty-icon' }, '🎯'),
      createElement('h3', {}, 'No Data to Analyse'),
      createElement(
        'p',
        {},
        'Add your first semester and courses on the Dashboard to unlock ' +
          'the What-If Calculator and start planning your academic path.'
      )
    );
  }
}
