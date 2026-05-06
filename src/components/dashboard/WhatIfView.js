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

// /**
//  * @module WhatIfView
//  * @description Dedicated "What-If Calculator" SPA view — mounts into #whatif-view.
//  *
//  * Five self-contained panels that compose a full academic planning tool:
//  *
//  *   1. STANDING PANEL     — Current CGPA, CU, honour classification,
//  *                           progress bar toward the next tier above.
//  *
//  *   2. HONOUR LADDER      — Vertical tier ladder; current position marked,
//  *                           gap (Δ CGPA) shown to every tier above.
//  *
//  *   3. TARGET CALCULATOR  — Preset buttons per honour tier + custom target
//  *                           CGPA + planned CU → required GPA with difficulty
//  *                           rating and full arithmetic explanation.
//  *
//  *   4. SEMESTER SIMULATOR — Add hypothetical future semesters (label + GPA
//  *                           slider + CU). Live projected CGPA updates with
//  *                           a Canvas projection chart overlaying real data.
//  *
//  *   5. SENSITIVITY TABLE  — Grid: rows = common GPA levels (from active scale),
//  *                           columns = credit-unit increments (15 → 90).
//  *                           Each cell = projected final CGPA, colour-coded by
//  *                           resulting honour classification.
//  *
//  * ARCHITECTURE:
//  * - Extends BaseComponent  (lifecycle: mount → render → afterMount)
//  * - Local UI state via WeakMap (this.localState / this.setState)
//  * - AbortController via addListener() for all DOM events
//  * - debounce() wraps text-input handlers (imported from dom.js)
//  * - Pure maths delegated to GPACalculatorService
//  * - Styles injected once via _injectStyles() (idempotent style-id guard)
//  * - Canvas chart drawn in requestAnimationFrame (correct layout dimensions)
//  *
//  * WIRING (see dashboard.js):
//  *   import { WhatIfView } from '../components/dashboard/WhatIfView.js';
//  *   const wiv = new WhatIfView(document.getElementById('whatif-view'), store);
//  *   wiv.mount();
//  *   router.register('whatif', document.getElementById('whatif-view'), () => wiv.activate());
//  */

// import { BaseComponent } from '../common/BaseComponent.js';
// import { GPACalculatorService } from '@/services/GPACalculatorService.js';
// import { Semester } from '@/domain/Semester.js';
// import { createElement, clearElement, debounce } from '@/utils/dom.js';
// import { formatGPA } from '@/utils/formatters.js';
// import { DEFAULT_SCALE_ID } from '@/utils/constants.js';
// import { getScale } from '@/utils/helpers.js';
// import { watchState } from '../../utils/selector.js';

// // ─── Colour helpers ───────────────────────────────────────────────────────────

// function _gpaColor(gpa, alpha = 1) {
//   if (gpa >= 4.5) return `rgba(246,211,101,${alpha})`;
//   if (gpa >= 3.5) return `rgba(168,230,207,${alpha})`;
//   if (gpa >= 2.4) return `rgba(116,185,224,${alpha})`;
//   if (gpa >= 1.5) return `rgba(246,173,85, ${alpha})`;
//   return `rgba(255,139,148,${alpha})`;
// }

// function _difficulty(req, max) {
//   const ratio = req / max;
//   if (ratio <= 0.6) return { label: 'Easy', cls: 'wi-difficulty--easy' };
//   if (ratio <= 0.75) return { label: 'Moderate', cls: 'wi-difficulty--moderate' };
//   if (ratio <= 0.88) return { label: 'Hard', cls: 'wi-difficulty--hard' };
//   if (ratio <= 1.0) return { label: 'Very Hard', cls: 'wi-difficulty--very-hard' };
//   return { label: 'Impossible', cls: 'wi-difficulty--impossible' };
// }

// // ─── Canvas chart ─────────────────────────────────────────────────────────────

// /**
//  * Draws a projection chart: real semesters (solid gold) + hypothetical
//  * semesters (dashed green).
//  *
//  * @param {HTMLCanvasElement} canvas
//  * @param {{ label:string, cgpa:number, isHypo:boolean }[]} points
//  * @param {number} maxGPA
//  */
// function _drawProjectionChart(canvas, points, maxGPA) {
//   if (!canvas || points.length < 2) return;

//   const dpr = window.devicePixelRatio || 1;
//   const W = canvas.offsetWidth || 400;
//   const H = canvas.offsetHeight || 160;
//   canvas.width = W * dpr;
//   canvas.height = H * dpr;
//   canvas.style.height = `${H}px`;

//   const ctx = canvas.getContext('2d');
//   ctx.scale(dpr, dpr);
//   ctx.clearRect(0, 0, W, H);

//   const PAD = { top: 14, right: 16, bottom: 36, left: 42 };
//   const cW = W - PAD.left - PAD.right;
//   const cH = H - PAD.top - PAD.bottom;
//   const step = points.length < 2 ? cW : cW / (points.length - 1);

//   const xOf = (i) => PAD.left + i * step;
//   const yOf = (v) => PAD.top + cH * (1 - Math.min(v, maxGPA) / maxGPA);

//   // Grid lines
//   ctx.strokeStyle = 'rgba(255,255,255,0.05)';
//   ctx.lineWidth = 1;
//   [1, 2, 3, 4, 5]
//     .filter((g) => g <= maxGPA)
//     .forEach((g) => {
//       const y = yOf(g);
//       ctx.beginPath();
//       ctx.moveTo(PAD.left, y);
//       ctx.lineTo(PAD.left + cW, y);
//       ctx.stroke();
//       ctx.fillStyle = 'rgba(232,226,213,0.28)';
//       ctx.font = `400 8px "DM Mono", monospace`;
//       ctx.textAlign = 'right';
//       ctx.fillText(g.toFixed(1), PAD.left - 5, y + 3);
//     });

//   // Split into real + hypo segments
//   const splitIdx = points.findIndex((p) => p.isHypo);
//   const realPts = splitIdx === -1 ? points : points.slice(0, splitIdx + 1);
//   const hypoPts = splitIdx === -1 ? [] : points.slice(splitIdx);

//   // Helper: draw a smooth line
//   const drawLine = (pts, offset, color, dash = []) => {
//     if (pts.length < 2) return;
//     ctx.beginPath();
//     ctx.setLineDash(dash);
//     ctx.strokeStyle = color;
//     ctx.lineWidth = 2;
//     ctx.moveTo(xOf(offset + 0), yOf(pts[0].cgpa));
//     pts.forEach((p, i) => {
//       if (!i) return;
//       const ox = offset + i,
//         px = offset + i - 1;
//       ctx.bezierCurveTo(
//         xOf(px) + step / 3,
//         yOf(pts[i - 1].cgpa),
//         xOf(ox) - step / 3,
//         yOf(p.cgpa),
//         xOf(ox),
//         yOf(p.cgpa)
//       );
//     });
//     ctx.stroke();
//     ctx.setLineDash([]);
//   };

//   drawLine(realPts, 0, 'rgba(246,211,101,0.85)');
//   if (hypoPts.length > 1) {
//     drawLine(hypoPts, splitIdx, 'rgba(168,230,207,0.8)', [5, 4]);
//   }

//   // Dots
//   points.forEach((p, i) => {
//     ctx.beginPath();
//     ctx.arc(xOf(i), yOf(p.cgpa), 3.5, 0, Math.PI * 2);
//     ctx.fillStyle = p.isHypo ? 'rgba(168,230,207,0.9)' : 'rgba(246,211,101,0.9)';
//     ctx.fill();
//     ctx.strokeStyle = 'rgba(12,15,26,0.8)';
//     ctx.lineWidth = 1.5;
//     ctx.stroke();
//   });

//   // X labels
//   points.forEach((p, i) => {
//     ctx.save();
//     ctx.translate(xOf(i), PAD.top + cH + 12);
//     ctx.rotate(-Math.PI / 7);
//     ctx.fillStyle = p.isHypo ? 'rgba(168,230,207,0.5)' : 'rgba(232,226,213,0.4)';
//     ctx.font = `400 8px "DM Mono", monospace`;
//     ctx.textAlign = 'right';
//     const lbl = p.label.length > 12 ? p.label.slice(0, 11) + '…' : p.label;
//     ctx.fillText(lbl, 0, 0);
//     ctx.restore();
//   });

//   // Legend
//   const L = PAD.left + 4,
//     LY = PAD.top + 8;
//   [
//     [`rgba(246,211,101,0.85)`, 'Actual', []],
//     [`rgba(168,230,207,0.8)`, 'Projected', [5, 4]],
//   ].forEach(([c, t, d], i) => {
//     const ox = i * 80;
//     ctx.setLineDash(d);
//     ctx.strokeStyle = c;
//     ctx.lineWidth = 2;
//     ctx.beginPath();
//     ctx.moveTo(L + ox, LY);
//     ctx.lineTo(L + ox + 16, LY);
//     ctx.stroke();
//     ctx.setLineDash([]);
//     ctx.fillStyle = 'rgba(232,226,213,0.5)';
//     ctx.font = `400 8px "DM Mono",monospace`;
//     ctx.textAlign = 'left';
//     ctx.fillText(t, L + ox + 20, LY + 3);
//   });
// }

// // ─── Main Component ───────────────────────────────────────────────────────────

// export class WhatIfView extends BaseComponent {
//   constructor(container, store) {
//     super(container, store);
//     // Local simulator state: array of { id, label, gpa, cu }
//     // Uses BaseComponent's WeakMap-backed localState + setState()
//     _state_init(this);
//   }

//   // ── Lifecycle ──────────────────────────────────────────────────────────────

//   afterMount() {
//     const unsub = watchState(
//       this.store,
//       (s) => [s.semesters, s.student, s.previousRecord],
//       () => {
//         if (!this.container.hidden) this.safeRender();
//       }
//     );
//     this.addSubscription(unsub);
//   }

//   /** Called by ViewRouter when this view becomes active */
//   activate() {
//     this.render();
//   }

//   render() {
//     const state = this.store.getState();
//     const semesters = state.semesters.map(Semester.fromJSON);
//     const student = state.student ?? {};
//     const scaleId = student.scaleId ?? DEFAULT_SCALE_ID;
//     const scale = getScale(scaleId);
//     const cgpa = GPACalculatorService.cgpaWithPreviousRecord(semesters, state.previousRecord);
//     const stats = GPACalculatorService.aggregateStats(semesters);
//     const honor = GPACalculatorService.getHonorClassification(cgpa, scaleId);

//     clearElement(this.container);

//     const root = createElement('div', { className: 'wi-root' });

//     // Page heading
//     root.append(
//       createElement(
//         'div',
//         { className: 'wi-page-heading' },
//         createElement('h2', {}, '🎯 What-If Calculator'),
//         createElement(
//           'p',
//           {},
//           `Plan your academic path · ${scale.label}` + (student.name ? ` · ${student.name}` : '')
//         )
//       )
//     );

//     if (semesters.length === 0) {
//       root.append(this._buildEmpty());
//       this.container.append(root);
//       return;
//     }

//     // ── Panel 1: Current Standing ──────────────────────────────────────────
//     root.append(this._buildStanding(cgpa, stats, honor, scale));

//     // ── Two-column: Ladder + Target Calculator ─────────────────────────────
//     const twoCol = createElement('div', { className: 'wi-two-col' });
//     twoCol.append(
//       this._buildLadder(cgpa, scale),
//       this._buildTargetCalc(cgpa, stats.totalCU, scaleId, scale)
//     );
//     root.append(twoCol);

//     // ── Panel 4: Semester Simulator ────────────────────────────────────────
//     root.append(this._buildSimulator(cgpa, stats, scaleId, scale, semesters));

//     // ── Panel 5: Sensitivity Table ─────────────────────────────────────────
//     root.append(this._buildSensitivity(cgpa, stats.totalCU, scaleId, scale));

//     this.container.append(root);
//   }

//   // ─────────────────────────────────────────────────────────────────────────
//   // PANEL 1 — Current Standing
//   // ─────────────────────────────────────────────────────────────────────────

//   _buildStanding(cgpa, stats, honor, scale) {
//     const maxGPA = scale.maxGPA;
//     const circumf = 2 * Math.PI * 42;
//     const ratio = Math.min(cgpa / maxGPA, 1);
//     const offset = circumf * (1 - ratio);
//     const col = _gpaColor(cgpa, 1);

//     // Find next tier above current
//     const sortedHonors = [...scale.honors].sort((a, b) => b.min - a.min);
//     const currentTierIdx = sortedHonors.findIndex((h) => cgpa >= h.min);
//     const nextTier = currentTierIdx > 0 ? sortedHonors[currentTierIdx - 1] : null;

//     // Progress toward next tier
//     let progressEl;
//     if (!nextTier) {
//       // Already at the top
//       progressEl = createElement(
//         'div',
//         { className: 'wi-next-tier' },
//         createElement(
//           'div',
//           { className: 'wi-already-top' },
//           "◈ You've reached the highest classification"
//         )
//       );
//     } else {
//       const currentFloor = sortedHonors[currentTierIdx]?.min ?? 0;
//       const pct = Math.min(((cgpa - currentFloor) / (nextTier.min - currentFloor)) * 100, 100);
//       const gap = Math.max(nextTier.min - cgpa, 0);

//       progressEl = createElement(
//         'div',
//         { className: 'wi-next-tier' },
//         createElement(
//           'div',
//           { className: 'wi-next-tier-header' },
//           createElement('span', { className: 'wi-next-tier-label' }, 'Next Tier'),
//           createElement(
//             'span',
//             {
//               className: `wi-next-tier-name ${nextTier.cssClass}`,
//             },
//             `${nextTier.badge} ${nextTier.label}`
//           )
//         ),
//         createElement(
//           'div',
//           { className: 'wi-progress-track' },
//           createElement('div', {
//             className: 'wi-progress-fill',
//             style: { width: `${pct}%`, background: _gpaColor(nextTier.min, 0.8) },
//           })
//         ),
//         createElement(
//           'div',
//           { className: 'wi-progress-gap' },
//           gap > 0.001 ? `+${gap.toFixed(3)} CGPA needed` : 'Threshold reached!'
//         )
//       );
//     }

//     return createElement(
//       'div',
//       { className: 'wi-card' },
//       createElement('h3', { className: 'wi-section-title' }, '📍 Current Standing'),
//       createElement(
//         'div',
//         { className: 'wi-standing-row' },

//         // Ring
//         createElement(
//           'div',
//           { className: 'wi-ring-wrap' },
//           createElement(
//             'svg',
//             {
//               className: 'wi-ring-svg',
//               viewBox: '0 0 100 100',
//               'aria-hidden': 'true',
//             },
//             createElement('circle', {
//               className: 'wi-ring-bg',
//               cx: '50',
//               cy: '50',
//               r: '42',
//             }),
//             createElement('circle', {
//               className: 'wi-ring-fill',
//               cx: '50',
//               cy: '50',
//               r: '42',
//               style: {
//                 stroke: col,
//                 strokeDasharray: String(circumf),
//                 strokeDashoffset: String(offset),
//               },
//             })
//           ),
//           createElement(
//             'div',
//             { className: 'wi-ring-text' },
//             createElement(
//               'span',
//               { className: 'wi-ring-cgpa', style: { color: col } },
//               formatGPA(cgpa)
//             ),
//             createElement('span', { className: 'wi-ring-denom' }, `/ ${maxGPA.toFixed(2)}`)
//           )
//         ),

//         // Stats
//         createElement(
//           'div',
//           { className: 'wi-standing-stats' },
//           _statRow(
//             'Classification',
//             honor ? `${honor.badge} ${honor.label}` : '—',
//             honor?.cssClass
//           ),
//           _statRow('Credit Units Earned', String(stats.totalCU)),
//           _statRow('Semesters', String(stats.semesterCount)),
//           _statRow('Total Courses', String(stats.courseCount))
//         ),

//         // Next tier progress
//         progressEl
//       )
//     );
//   }

//   // ─────────────────────────────────────────────────────────────────────────
//   // PANEL 2 — Honour Ladder
//   // ─────────────────────────────────────────────────────────────────────────

//   _buildLadder(cgpa, scale) {
//     const honors = [...scale.honors].sort((a, b) => b.min - a.min);
//     const currentH = honors.find((h) => cgpa >= h.min);

//     const rungs = honors.map((h, i) => {
//       const isTop = i === 0;
//       const nextTier = i > 0 ? honors[i - 1] : null;
//       const rangeMax = nextTier ? (nextTier.min - 0.001).toFixed(2) : scale.maxGPA.toFixed(2);
//       const isCurrent = h.label === currentH?.label;
//       const isAchieved = cgpa >= h.min && !isCurrent;
//       const gap = h.min - cgpa;

//       const cls = ['wi-rung', isCurrent ? 'is-current' : '', isAchieved ? 'is-achieved' : '']
//         .filter(Boolean)
//         .join(' ');

//       const gapEl = isCurrent
//         ? null
//         : gap > 0
//           ? createElement('span', { className: 'wi-rung-gap is-positive' }, `+${gap.toFixed(3)}`)
//           : createElement('span', { className: 'wi-rung-gap is-achieved' }, '✓');

//       const rung = createElement(
//         'div',
//         { className: cls },
//         createElement(
//           'span',
//           {
//             className: `wi-rung-badge ${h.cssClass}`,
//           },
//           h.badge
//         ),
//         createElement(
//           'div',
//           { className: 'wi-rung-body' },
//           createElement('div', { className: `wi-rung-label ${h.cssClass}` }, h.label),
//           createElement('div', { className: 'wi-rung-range' }, `${h.min.toFixed(2)} – ${rangeMax}`)
//         ),
//         gapEl,
//         isCurrent ? createElement('span', { className: 'wi-rung-marker' }, 'You are here') : null
//       );

//       return rung;
//     });

//     return createElement(
//       'div',
//       { className: 'wi-card' },
//       createElement('h3', { className: 'wi-section-title' }, '🏛 Classification Ladder'),
//       createElement('div', { className: 'wi-ladder' }, ...rungs)
//     );
//   }

//   // ─────────────────────────────────────────────────────────────────────────
//   // PANEL 3 — Target Calculator
//   // ─────────────────────────────────────────────────────────────────────────

//   _buildTargetCalc(cgpa, currentCU, scaleId, scale) {
//     const maxGPA = scale.maxGPA;
//     const honors = [...scale.honors].sort((a, b) => b.min - a.min).filter((h) => h.min > 0);

//     // Result box (updated on compute)
//     const resultBox = createElement(
//       'div',
//       { className: 'wi-result-box state-idle' },
//       createElement(
//         'span',
//         { className: 'wi-result-idle-text' },
//         'Select a target tier or enter a custom CGPA, then specify planned credit units.'
//       )
//     );

//     // Slider + number pair for target CGPA
//     const targetSlider = createElement('input', {
//       type: 'range',
//       className: 'wi-slider',
//       min: '0',
//       max: String(maxGPA),
//       step: '0.01',
//       value: String(Math.min(cgpa + 0.5, maxGPA).toFixed(2)),
//     });
//     const targetNumber = createElement('input', {
//       type: 'number',
//       className: 'form-input wi-slider-number',
//       min: '0',
//       max: String(maxGPA),
//       step: '0.01',
//       value: String(Math.min(cgpa + 0.5, maxGPA).toFixed(2)),
//     });

//     // Planned CU input
//     const cuInput = createElement('input', {
//       type: 'number',
//       className: 'form-input',
//       min: '1',
//       max: '300',
//       step: '1',
//       placeholder: '30',
//       value: '30',
//     });

//     // Active preset tracker
//     let activePreset = null;

//     // Preset buttons
//     const presetsEl = createElement('div', { className: 'wi-presets' });
//     const presetBtns = honors.map((h) => {
//       const btn = createElement(
//         'button',
//         { className: 'wi-preset-btn', type: 'button' },
//         createElement('span', { className: 'wi-preset-badge' }, h.badge),
//         h.label.replace('Second Class ', '2nd '),
//         createElement(
//           'span',
//           {
//             style: { opacity: '0.65', marginLeft: '0.2rem' },
//           },
//           h.min.toFixed(2)
//         )
//       );
//       this.addListener(btn, 'click', () => {
//         presetBtns.forEach((b) => b.classList.remove('is-active'));
//         btn.classList.add('is-active');
//         activePreset = h.min;
//         targetSlider.value = String(h.min);
//         targetNumber.value = String(h.min.toFixed(2));
//         compute();
//       });
//       presetsEl.append(btn);
//       return btn;
//     });

//     // Core compute function
//     const compute = () => {
//       const target = parseFloat(targetNumber.value);
//       const planned = parseInt(cuInput.value, 10);

//       if (!Number.isFinite(target) || !Number.isFinite(planned) || planned < 1) {
//         resultBox.className = 'wi-result-box state-idle';
//         clearElement(resultBox);
//         resultBox.append(
//           createElement(
//             'span',
//             { className: 'wi-result-idle-text' },
//             'Enter a target CGPA and planned credit units to calculate.'
//           )
//         );
//         return;
//       }

//       const res = GPACalculatorService.requiredGPAForTarget({
//         currentCGPA: cgpa,
//         currentCU,
//         targetCGPA: target,
//         plannedCU: planned,
//         scaleId,
//       });

//       clearElement(resultBox);

//       if (!res.achievable && res.requiredGPA > maxGPA) {
//         resultBox.className = 'wi-result-box state-error';
//         const diff = _difficulty(res.requiredGPA, maxGPA);
//         resultBox.append(
//           _resultRow(
//             `${formatGPA(res.requiredGPA)} needed`,
//             diff,
//             `Impossible — a GPA of <strong>${formatGPA(res.requiredGPA)}</strong> is required,
//              which exceeds the scale maximum of <strong>${maxGPA.toFixed(2)}</strong>.
//              You would need to lower your target or earn more credit units first.`,
//             null
//           )
//         );
//         return;
//       }

//       if (!res.achievable) {
//         resultBox.className = 'wi-result-box state-error';
//         resultBox.append(createElement('span', { className: 'wi-result-math' }, res.message));
//         return;
//       }

//       if (res.requiredGPA <= 0) {
//         resultBox.className = 'wi-result-box state-already';
//         const targetHonor = GPACalculatorService.getHonorClassification(target, scaleId);
//         resultBox.append(
//           _resultRow(
//             '—',
//             { label: 'Already there', cls: 'wi-difficulty--easy' },
//             `Your current CGPA of <strong>${formatGPA(cgpa)}</strong> already meets or
//              exceeds your target of <strong>${target.toFixed(2)}</strong>. Keep it up!`,
//             targetHonor
//           )
//         );
//         return;
//       }

//       const diff = _difficulty(res.requiredGPA, maxGPA);
//       const targetHonor = GPACalculatorService.getHonorClassification(target, scaleId);
//       const mathExplain = `Current: <strong>${formatGPA(cgpa)} CGPA</strong> × <strong>${currentCU} CU</strong>
//          = <strong>${(cgpa * currentCU).toFixed(2)} QP</strong>.
//          Target: <strong>${target.toFixed(2)} CGPA</strong> × <strong>${currentCU + planned} CU</strong>
//          = <strong>${(target * (currentCU + planned)).toFixed(2)} QP</strong>.
//          Shortfall: <strong>${(target * (currentCU + planned) - cgpa * currentCU).toFixed(2)} QP</strong>
//          over <strong>${planned} planned CU</strong>
//          = <strong>${formatGPA(res.requiredGPA)} required GPA</strong>.`;

//       resultBox.className =
//         diff.cls.includes('impossible') || diff.cls.includes('very-hard')
//           ? 'wi-result-box state-warning'
//           : 'wi-result-box state-success';

//       resultBox.append(_resultRow(formatGPA(res.requiredGPA), diff, mathExplain, targetHonor));
//     };

//     // Sync slider ↔ number
//     this.addListener(targetSlider, 'input', () => {
//       targetNumber.value = parseFloat(targetSlider.value).toFixed(2);
//       presetBtns.forEach((b) => b.classList.remove('is-active'));
//       activePreset = null;
//       compute();
//     });
//     this.addListener(
//       targetNumber,
//       'input',
//       debounce(() => {
//         const v = parseFloat(targetNumber.value);
//         if (Number.isFinite(v)) targetSlider.value = String(v);
//         presetBtns.forEach((b) => b.classList.remove('is-active'));
//         activePreset = null;
//         compute();
//       }, 250)
//     );
//     this.addListener(cuInput, 'input', debounce(compute, 250));

//     // Trigger initial computation
//     compute();

//     return createElement(
//       'div',
//       { className: 'wi-card' },
//       createElement('h3', { className: 'wi-section-title' }, '🔢 Target Calculator'),
//       createElement(
//         'div',
//         { className: 'wi-target-layout' },
//         presetsEl,
//         createElement(
//           'div',
//           { className: 'wi-calc-inputs' },
//           createElement(
//             'div',
//             { className: 'form-group', style: { margin: 0 } },
//             createElement(
//               'label',
//               { className: 'form-label', for: 'wi-target-cgpa' },
//               'Target CGPA'
//             ),
//             createElement(
//               'div',
//               { className: 'wi-slider-group' },
//               createElement('div', { className: 'wi-slider-row' }, targetSlider, targetNumber)
//             )
//           ),
//           createElement(
//             'div',
//             { className: 'form-group', style: { margin: 0 } },
//             createElement(
//               'label',
//               { className: 'form-label', for: 'wi-planned-cu' },
//               'Planned Credit Units'
//             ),
//             cuInput
//           )
//         ),
//         resultBox
//       )
//     );
//   }

//   // ─────────────────────────────────────────────────────────────────────────
//   // PANEL 4 — Semester Simulator
//   // ─────────────────────────────────────────────────────────────────────────

//   _buildSimulator(baseCGPA, stats, scaleId, scale, realSemesters) {
//     const maxGPA = scale.maxGPA;
//     const ls = this.localState;

//     // Ensure scenarios array is initialised
//     if (!ls.scenarios) {
//       this.setState({ scenarios: [] });
//     }
//     const scenarios = ls.scenarios ?? [];

//     // Compute projected CGPA from real + hypothetical semesters
//     const projectedCGPA = _computeProjected(baseCGPA, stats.totalCU, scenarios);
//     const projHonor = GPACalculatorService.getHonorClassification(projectedCGPA, scaleId);
//     const delta = projectedCGPA - baseCGPA;

//     // Build chart data points
//     const chartPoints = _buildChartPoints(realSemesters, scenarios, baseCGPA, stats.totalCU);

//     // ── Inputs ─────────────────────────────────────────────────────────────
//     const labelInput = createElement('input', {
//       type: 'text',
//       className: 'form-input',
//       placeholder: `Hypothetical Sem ${scenarios.length + 1}`,
//       maxlength: '40',
//     });
//     const gpaSlider = createElement('input', {
//       type: 'range',
//       className: 'wi-slider',
//       min: '0',
//       max: String(maxGPA),
//       step: '0.01',
//       value: '3.50',
//     });
//     const gpaNumber = createElement('input', {
//       type: 'number',
//       className: 'form-input wi-slider-number',
//       min: '0',
//       max: String(maxGPA),
//       step: '0.01',
//       value: '3.50',
//     });
//     const cuInput = createElement('input', {
//       type: 'number',
//       className: 'form-input',
//       min: '1',
//       max: '60',
//       step: '1',
//       value: '18',
//     });

//     this.addListener(gpaSlider, 'input', () => {
//       gpaNumber.value = parseFloat(gpaSlider.value).toFixed(2);
//     });
//     this.addListener(gpaNumber, 'input', () => {
//       const v = parseFloat(gpaNumber.value);
//       if (Number.isFinite(v)) gpaSlider.value = String(Math.min(v, maxGPA));
//     });

//     // ── Projected CGPA display ─────────────────────────────────────────────
//     const projSection = createElement(
//       'div',
//       { className: 'wi-sim-projected' },
//       createElement('span', { className: 'wi-sim-proj-val' }, formatGPA(projectedCGPA)),
//       createElement('span', { className: 'wi-sim-proj-label' }, 'Projected CGPA'),
//       projHonor
//         ? createElement(
//             'span',
//             {
//               className: `wi-sim-proj-honour ${projHonor.cssClass}`,
//             },
//             `${projHonor.badge} ${projHonor.label}`
//           )
//         : null,
//       scenarios.length > 0
//         ? createElement(
//             'span',
//             { className: 'wi-sim-proj-delta' },
//             `${delta >= 0 ? '+' : ''}${delta.toFixed(3)} from current`
//           )
//         : createElement(
//             'span',
//             { className: 'wi-sim-proj-delta' },
//             'Add semesters to see projection'
//           )
//     );

//     // ── Add button ─────────────────────────────────────────────────────────
//     const addBtn = createElement(
//       'button',
//       {
//         className: 'btn btn--primary btn--sm',
//         type: 'button',
//       },
//       '+ Add Scenario'
//     );

//     this.addListener(addBtn, 'click', () => {
//       const gpa = parseFloat(gpaNumber.value);
//       const cu = parseInt(cuInput.value, 10);
//       const lbl =
//         labelInput.value.trim() ||
//         `Hypothetical Sem ${(this.localState.scenarios?.length ?? 0) + 1}`;

//       if (!Number.isFinite(gpa) || gpa < 0 || gpa > maxGPA) return;
//       if (!Number.isFinite(cu) || cu < 1) return;

//       const next = [...(this.localState.scenarios ?? []), { id: Date.now(), label: lbl, gpa, cu }];
//       this.setState({ scenarios: next });
//       labelInput.value = '';
//     });

//     // ── Scenario list ──────────────────────────────────────────────────────
//     const listEl = createElement('div', { className: 'wi-scenario-list' });

//     if (scenarios.length === 0) {
//       listEl.append(
//         createElement(
//           'div',
//           { className: 'wi-scenario-empty' },
//           'No hypothetical semesters yet — use the form to add one.'
//         )
//       );
//     } else {
//       scenarios.forEach((sc, i) => {
//         const col = _gpaColor(sc.gpa, 0.9);
//         const honor = GPACalculatorService.getHonorClassification(sc.gpa, scaleId);

//         const item = createElement(
//           'div',
//           { className: 'wi-scenario-item' },
//           createElement('span', { className: 'wi-scenario-idx' }, String(i + 1)),
//           createElement('span', { className: 'wi-scenario-name' }, sc.label),
//           createElement(
//             'span',
//             {
//               className: 'wi-scenario-tag',
//               style: {
//                 color: col,
//                 borderColor: col.replace('0.9', '0.3'),
//                 background: col.replace('0.9', '0.08'),
//               },
//             },
//             `GPA ${sc.gpa.toFixed(2)}`,
//             honor ? ` · ${honor.badge}` : ''
//           ),
//           createElement('span', { className: 'wi-scenario-cu' }, `${sc.cu} CU`),
//           createElement(
//             'button',
//             {
//               className: 'wi-scenario-remove',
//               title: 'Remove this scenario',
//               type: 'button',
//               onClick: () => {
//                 const updated = (this.localState.scenarios ?? []).filter((s) => s.id !== sc.id);
//                 this.setState({ scenarios: updated });
//               },
//             },
//             '×'
//           )
//         );
//         listEl.append(item);
//       });
//     }

//     // ── Chart ──────────────────────────────────────────────────────────────
//     const canvas = createElement('canvas', { style: { height: '160px' } });
//     const chartCard = createElement(
//       'div',
//       { className: 'wi-chart-card' },
//       createElement('h4', {}, 'CGPA Projection'),
//       canvas
//     );

//     if (chartPoints.length >= 2) {
//       requestAnimationFrame(() => _drawProjectionChart(canvas, chartPoints, maxGPA));
//     }

//     // ── Assemble ───────────────────────────────────────────────────────────
//     const formEl = createElement(
//       'div',
//       { className: 'wi-sim-form' },
//       createElement('p', { className: 'wi-sim-form-title' }, 'Add Hypothetical Semester'),
//       createElement(
//         'div',
//         { className: 'form-group', style: { margin: 0 } },
//         createElement('label', { className: 'form-label' }, 'Label (optional)'),
//         labelInput
//       ),
//       createElement(
//         'div',
//         { className: 'form-group', style: { margin: 0 } },
//         createElement('label', { className: 'form-label' }, 'Semester GPA'),
//         createElement('div', { className: 'wi-slider-row' }, gpaSlider, gpaNumber)
//       ),
//       createElement(
//         'div',
//         { className: 'form-group', style: { margin: 0 } },
//         createElement('label', { className: 'form-label' }, 'Credit Units'),
//         cuInput
//       ),
//       addBtn,
//       projSection
//     );

//     const rightEl = createElement(
//       'div',
//       { className: 'wi-sim-right' },
//       listEl,
//       chartPoints.length >= 2 ? chartCard : null
//     );

//     return createElement(
//       'div',
//       { className: 'wi-card' },
//       createElement('h3', { className: 'wi-section-title' }, '🔭 Semester Simulator'),
//       createElement('div', { className: 'wi-sim-layout' }, formEl, rightEl)
//     );
//   }

//   // ─────────────────────────────────────────────────────────────────────────
//   // PANEL 5 — Sensitivity Table
//   // ─────────────────────────────────────────────────────────────────────────

//   _buildSensitivity(cgpa, currentCU, scaleId, scale) {
//     const maxGPA = scale.maxGPA;
//     // Row GPA values: use grade points from the scale, sorted desc
//     const rowGPAs = [...scale.grades]
//       .map((g) => g.points)
//       .filter((v, i, a) => a.indexOf(v) === i && v > 0)
//       .sort((a, b) => b - a);

//     // Column CU increments
//     const colCUs = [15, 30, 45, 60, 90, 120];

//     const thead = createElement(
//       'thead',
//       {},
//       createElement(
//         'tr',
//         {},
//         createElement('th', { scope: 'col' }, 'Avg GPA →'),
//         ...colCUs.map((cu) => createElement('th', { scope: 'col' }, `+${cu} CU`))
//       )
//     );

//     const tbody = createElement('tbody');
//     rowGPAs.forEach((rowGPA) => {
//       const honor = GPACalculatorService.getHonorClassification(rowGPA, scaleId);
//       const rowLabel = createElement(
//         'td',
//         {},
//         createElement(
//           'span',
//           {
//             style: { display: 'flex', alignItems: 'center', gap: '0.4rem' },
//           },
//           createElement('span', { className: honor?.cssClass ?? '' }, honor?.badge ?? ''),
//           createElement(
//             'span',
//             {
//               style: {
//                 fontFamily: 'var(--font-mono,"DM Mono",monospace)',
//                 fontSize: '0.78rem',
//               },
//             },
//             rowGPA.toFixed(1)
//           )
//         )
//       );

//       const cells = colCUs.map((cu) => {
//         const projected = (cgpa * currentCU + rowGPA * cu) / (currentCU + cu);
//         const projHonor = GPACalculatorService.getHonorClassification(projected, scaleId);
//         const col = _gpaColor(projected, 1);
//         const borderCol = _gpaColor(projected, 0.35);
//         const bgCol = _gpaColor(projected, 0.1);

//         return createElement(
//           'td',
//           {},
//           createElement(
//             'span',
//             {
//               className: 'wi-sens-cell',
//               style: { color: col, borderColor: borderCol, background: bgCol },
//             },
//             formatGPA(projected)
//           )
//         );
//       });

//       tbody.append(createElement('tr', {}, rowLabel, ...cells));
//     });

//     const table = createElement('table', { className: 'wi-sensitivity-table' }, thead, tbody);

//     return createElement(
//       'div',
//       { className: 'wi-card' },
//       createElement('h3', { className: 'wi-section-title' }, '📐 Sensitivity Analysis'),
//       createElement(
//         'p',
//         {
//           style: {
//             fontSize: '0.78rem',
//             color: 'var(--color-text-muted)',
//             fontFamily: 'var(--font-mono,"DM Mono",monospace)',
//             marginBottom: '1rem',
//             marginTop: '-0.25rem',
//           },
//         },
//         `"If I average GPA X for N more credit units, my CGPA becomes…" (current: ${formatGPA(cgpa)} over ${currentCU} CU)`
//       ),
//       createElement('div', { className: 'wi-sensitivity-wrap' }, table)
//     );
//   }

//   // ── Empty state ────────────────────────────────────────────────────────────

//   _buildEmpty() {
//     return createElement(
//       'div',
//       { className: 'wi-empty' },
//       createElement('div', { className: 'wi-empty-icon' }, '🎯'),
//       createElement('h3', {}, 'No Data to Analyse'),
//       createElement(
//         'p',
//         {},
//         'Add your first semester and courses on the Dashboard to unlock ' +
//           'the What-If Calculator and start planning your academic path.'
//       )
//     );
//   }
// }

// // ─── Private helpers ──────────────────────────────────────────────────────────

// /** Initialise local state on the BaseComponent WeakMap */
// function _state_init(component) {
//   // BaseComponent already calls _state.set(this, {}) in the constructor.
//   // We just set our initial keys here.
//   // We do it lazily in render() instead to avoid import order issues.
// }

// /** Single key-value stat row */
// function _statRow(key, val, cssClass = '') {
//   return createElement(
//     'div',
//     { className: 'wi-standing-row-item' },
//     createElement('span', { className: 'wi-standing-key' }, key),
//     createElement('span', { className: `wi-standing-val ${cssClass}` }, val)
//   );
// }

// /** Builds the result display inside the target calculator result box */
// function _resultRow(gpaStr, diff, mathHtml, honor) {
//   const gpaGroup = createElement(
//     'div',
//     {},
//     createElement(
//       'div',
//       {
//         className: 'wi-result-gpa',
//         style: { color: gpaStr === '—' ? 'rgba(168,230,207,0.9)' : 'var(--color-text,#e8e2d5)' },
//       },
//       gpaStr
//     ),
//     createElement('div', { className: 'wi-result-gpa-label' }, 'Required GPA')
//   );

//   const diffBadge = createElement('span', { className: `wi-difficulty ${diff.cls}` }, diff.label);

//   const header = createElement('div', { className: 'wi-result-header' }, gpaGroup, diffBadge);

//   const mathEl = createElement('p', { className: 'wi-result-math' });
//   mathEl.innerHTML = mathHtml;

//   const honorEl = honor
//     ? createElement(
//         'div',
//         { className: `wi-result-honour ${honor.cssClass}` },
//         `${honor.badge} Achieving ${honor.label}`
//       )
//     : null;

//   return createElement('div', {}, header, mathEl, honorEl);
// }

// /**
//  * Computes projected CGPA by appending hypothetical semesters.
//  * @param {number} baseCGPA
//  * @param {number} baseCU
//  * @param {{ gpa: number, cu: number }[]} scenarios
//  */
// function _computeProjected(baseCGPA, baseCU, scenarios) {
//   if (!scenarios.length) return baseCGPA;
//   let totalCU = baseCU;
//   let totalQP = baseCGPA * baseCU;
//   for (const s of scenarios) {
//     totalQP += s.gpa * s.cu;
//     totalCU += s.cu;
//   }
//   return totalCU > 0 ? totalQP / totalCU : 0;
// }

// /**
//  * Builds the CGPA trajectory for the projection chart.
//  * Real semesters come first (isHypo=false), then hypothetical (isHypo=true).
//  */
// function _buildChartPoints(realSemesters, scenarios, baseCGPA, baseCU) {
//   const points = [];

//   // Build running CGPA from real semesters
//   let runCU = 0,
//     runQP = 0;
//   for (const sem of realSemesters) {
//     if (!sem.courses.length) continue;
//     runCU += sem.totalCreditUnits;
//     runQP += sem.totalQualityPoints;
//     points.push({ label: sem.label, cgpa: runCU > 0 ? runQP / runCU : 0, isHypo: false });
//   }

//   // If no real semesters produced points, add a baseline
//   if (!points.length) {
//     points.push({ label: 'Current', cgpa: baseCGPA, isHypo: false });
//     runCU = baseCU;
//     runQP = baseCGPA * baseCU;
//   }

//   // Append hypothetical scenarios
//   for (const sc of scenarios) {
//     runCU += sc.cu;
//     runQP += sc.gpa * sc.cu;
//     points.push({ label: sc.label, cgpa: runCU > 0 ? runQP / runCU : 0, isHypo: true });
//   }

//   return points;
// }
