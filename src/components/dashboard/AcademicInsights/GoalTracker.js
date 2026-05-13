/**
 * @module GoalTracker
 * @description Card ② of the AcademicInsights panel.
 *
 * An inline What-If calculator that answers the student's most common question:
 * "What GPA do I need over my remaining credit units to reach a target CGPA?"
 *
 * FEATURES:
 *   - Current standing context strip (CGPA / CU / classification)
 *   - One-tap preset buttons per honour tier (auto-populated from the active scale)
 *   - Two numeric inputs: target CGPA + planned credit units
 *   - Live result card showing: required GPA, difficulty rating, arithmetic breakdown,
 *     and the resulting honour classification if the target is met
 *   - Input validation with inline user-friendly messaging
 *   - Debounced input handlers (no thrashing on every keypress)
 *
 * SUBSCRIPTION SCOPE:
 * Subscribes to: semesters, student (scaleId), previousRecord.
 * Local UI state (target, plannedCU, activePreset) lives in the BaseComponent
 * WeakMap — not in the global store — because it is ephemeral form state that
 * other components do not need to know about.
 *
 * ARCHITECTURE NOTE — why local state instead of store:
 * The goal-tracker inputs are transient. If the student switches to another
 * tab and returns, a blank form is the right UX (the previous calculation
 * may no longer apply if they added courses). Storing this in the global store
 * would persist irrelevant numbers across navigations.
 *
 * CSS:
 * All styles live in insights.css (.gt-*). No CSS is injected here.
 *
 * PATTERNS:
 * - BaseComponent lifecycle (mount → render → afterMount → unmount)
 * - WeakMap-backed local state via this.localState / this.setState()
 * - AbortController event cleanup via this.addListener()
 * - Debounce on text inputs to avoid recalculating on every keystroke
 * - createElement for all DOM mutations
 */

import { BaseComponent } from '../../common/BaseComponent.js';
import { GPACalculatorService } from '../../../services/GPACalculatorService.js';
import { Semester } from '../../../domain/Semester.js';
import { createElement, clearElement, debounce } from '../../../utils/dom.js';
import { formatGPA } from '../../../utils/formatters.js';
import { DEFAULT_SCALE_ID } from '../../../utils/constants.js';
import { getScale } from '../../../utils/helpers.js';

// ─── Difficulty rating helper ─────────────────────────────────────────────────

/**
 * Maps a required GPA ratio (requiredGPA / maxGPA) to a human-readable
 * difficulty tier and its corresponding CSS modifier class.
 *
 * Thresholds are calibrated against the 5.0 scale as the primary target:
 *   ≤ 60% of max → Easy   (e.g. need 3.0 on a 5.0 scale)
 *   ≤ 75%        → Moderate
 *   ≤ 88%        → Hard
 *   ≤ 100%       → Very Hard
 *   > 100%       → Impossible
 *
 * @param {number} requiredGPA
 * @param {number} maxGPA
 * @returns {{ label: string, cls: string }}
 */
function _difficulty(requiredGPA, maxGPA) {
  const ratio = requiredGPA / maxGPA;
  if (ratio <= 0.6) return { label: 'Achievable', cls: 'gt-difficulty--easy' };
  if (ratio <= 0.75) return { label: 'Moderate', cls: 'gt-difficulty--moderate' };
  if (ratio <= 0.88) return { label: 'Challenging', cls: 'gt-difficulty--hard' };
  if (ratio <= 1.0) return { label: 'Very Hard', cls: 'gt-difficulty--very-hard' };
  return { label: 'Impossible', cls: 'gt-difficulty--impossible' };
}

// ─── Component ────────────────────────────────────────────────────────────────

export class GoalTracker extends BaseComponent {
  /**
   * @param {HTMLElement} container
   * @param {ReturnType<import('../../core/Store.js').createStore>} store
   */
  constructor(container, store) {
    super(container, store);

    // Initialise ephemeral form state in the WeakMap
    this.setState({
      targetCGPA: '',
      plannedCU: '',
      activePreset: null, // min value of the currently active preset tier, or null
    });
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
    const totalCU =
      semesters.reduce((s, sem) => s + sem.totalCreditUnits, 0) +
      (state.previousRecord?.creditUnits ?? 0);
    const honor = GPACalculatorService.getHonorClassification(cgpa, scaleId);

    clearElement(this.container);
    this.container.append(this._buildCard(cgpa, totalCU, honor, scale, scaleId));
  }

  // ── Card ───────────────────────────────────────────────────────────────────

  /**
   * @param {number}      cgpa
   * @param {number}      totalCU   accumulated credit units (current semesters + prev record)
   * @param {object|null} honor
   * @param {object}      scale
   * @param {string}      scaleId
   */
  _buildCard(cgpa, totalCU, honor, scale, scaleId) {
    const ls = this.localState;

    const card = createElement('div', { className: 'insights-card insights-card--goal' });

    // Header
    card.append(this._buildHeader());

    // Context strip
    card.append(this._buildContext(cgpa, totalCU, honor));

    // Preset tier buttons (one per honour tier above Fail)
    const validTiers = scale.honors.filter((h) => h.min > 0).sort((a, b) => b.min - a.min);
    card.append(this._buildPresets(validTiers));

    // Inputs + result
    const { inputsEl, resultEl } = this._buildInputsAndResult(cgpa, totalCU, scaleId, scale);
    card.append(inputsEl, resultEl);

    // Trigger initial computation if form values already exist
    if (ls.targetCGPA && ls.plannedCU) {
      this._compute(
        cgpa,
        totalCU,
        parseFloat(ls.targetCGPA),
        parseInt(ls.plannedCU, 10),
        scaleId,
        scale,
        resultEl
      );
    }

    return card;
  }

  // ── Header ─────────────────────────────────────────────────────────────────

  _buildHeader() {
    return createElement(
      'div',
      { className: 'insights-card-header' },
      createElement('span', { className: 'insights-card-icon', 'aria-hidden': 'true' }, '🎯'),
      createElement(
        'div',
        { className: 'insights-card-heading' },
        createElement('h3', { className: 'insights-card-title' }, 'Goal Tracker'),
        createElement('p', { className: 'insights-card-sub' }, 'What GPA do I need?')
      )
    );
  }

  // ── Context strip ──────────────────────────────────────────────────────────

  /**
   * Shows current CGPA, total CU, and classification side-by-side in a
   * compact strip so the student can calibrate their goal against reality.
   *
   * @param {number}      cgpa
   * @param {number}      totalCU
   * @param {object|null} honor
   */
  _buildContext(cgpa, totalCU, honor) {
    const cgpaItem = createElement(
      'div',
      {
        className: `gt-context-item${honor ? ` ${honor.cssClass}` : ''}`,
        'aria-label': `Current CGPA: ${formatGPA(cgpa)}`,
      },
      createElement('span', { className: 'gt-context-val' }, formatGPA(cgpa)),
      createElement('span', { className: 'gt-context-key' }, 'CGPA')
    );

    const cuItem = createElement(
      'div',
      { className: 'gt-context-item', 'aria-label': `${totalCU} credit units earned` },
      createElement('span', { className: 'gt-context-val' }, String(totalCU)),
      createElement('span', { className: 'gt-context-key' }, 'Credit Units')
    );

    const classItem = createElement(
      'div',
      {
        className: `gt-context-item${honor ? ` ${honor.cssClass}` : ''}`,
        'aria-label': honor ? `Classification: ${honor.label}` : 'No classification yet',
      },
      createElement('span', { className: 'gt-context-val' }, honor ? honor.badge : '—'),
      createElement(
        'span',
        { className: 'gt-context-key' },
        honor ? honor.label.split(' ')[0] : 'Class'
      )
    );

    return createElement(
      'div',
      { className: 'gt-context', role: 'group', 'aria-label': 'Your current standing' },
      cgpaItem,
      createElement('div', { className: 'gt-context-sep', 'aria-hidden': 'true' }),
      cuItem,
      createElement('div', { className: 'gt-context-sep', 'aria-hidden': 'true' }),
      classItem
    );
  }

  // ── Preset buttons ─────────────────────────────────────────────────────────

  /**
   * Builds one button per honour tier. Clicking pre-fills the target CGPA
   * field and immediately computes the result.
   *
   * @param {{ label: string, min: number, cssClass: string, badge: string }[]} tiers
   */
  _buildPresets(tiers) {
    const ls = this.localState;
    const wrapper = createElement(
      'div',
      { className: 'gt-presets', role: 'group', 'aria-label': 'Quick target presets' },
      createElement('span', { className: 'gt-presets-label' }, 'Quick target:')
    );

    tiers.forEach((tier) => {
      const isActive = ls.activePreset === tier.min;
      const btn = createElement(
        'button',
        {
          type: 'button',
          className: `gt-preset-btn ${tier.cssClass}${isActive ? ' is-active' : ''}`,
          'aria-pressed': String(isActive),
          'aria-label': `Set target to ${tier.label} (${tier.min.toFixed(2)})`,
          title: `${tier.label} — CGPA ≥ ${tier.min.toFixed(2)}`,
        },
        createElement('span', { 'aria-hidden': 'true' }, tier.badge),
        ` ${tier.min.toFixed(2)}`
      );

      this.addListener(btn, 'click', () => {
        // Persist preset selection into local state — survives re-renders
        this.setState({
          targetCGPA: String(tier.min.toFixed(2)),
          activePreset: tier.min,
        });
      });

      wrapper.append(btn);
    });

    return wrapper;
  }

  // ── Inputs & Result ────────────────────────────────────────────────────────

  /**
   * Two numeric inputs + a live result area wired with debounced compute.
   * Returns both elements so the card builder can append them in order and
   * pass `resultEl` to the initial computation trigger.
   *
   * @param {number} cgpa
   * @param {number} totalCU
   * @param {string} scaleId
   * @param {object} scale
   * @returns {{ inputsEl: HTMLElement, resultEl: HTMLElement }}
   */
  _buildInputsAndResult(cgpa, totalCU, scaleId, scale) {
    const ls = this.localState;

    // Target CGPA input
    const targetInput = createElement('input', {
      id: 'gt-target-cgpa',
      type: 'number',
      className: 'form-input',
      min: '0',
      max: String(scale.maxGPA),
      step: '0.01',
      placeholder: (scale.maxGPA * 0.9).toFixed(2),
      value: ls.targetCGPA ?? '',
    });

    // Planned CU input
    const cuInput = createElement('input', {
      id: 'gt-planned-cu',
      type: 'number',
      className: 'form-input',
      min: '1',
      max: '300',
      step: '1',
      placeholder: '30',
      value: ls.plannedCU ?? '',
    });

    // Result area
    const resultEl = createElement('div', {
      className: 'gt-result',
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'true',
    });
    this._renderResultIdle(resultEl);

    // Debounced compute — avoids recalculation on every single keypress
    const debouncedCompute = debounce(() => {
      const target = parseFloat(targetInput.value);
      const planned = parseInt(cuInput.value, 10);
      // Save raw input into local state so it survives a store-triggered re-render
      this.setState({ targetCGPA: targetInput.value, plannedCU: cuInput.value });
      this._compute(cgpa, totalCU, target, planned, scaleId, scale, resultEl);
    }, 320);

    this.addListener(targetInput, 'input', debouncedCompute);
    this.addListener(cuInput, 'input', debouncedCompute);

    const inputsEl = createElement(
      'div',
      { className: 'gt-inputs' },
      createElement(
        'div',
        { className: 'gt-field' },
        createElement(
          'label',
          { className: 'gt-field-label', for: 'gt-target-cgpa' },
          'Target CGPA'
        ),
        targetInput
      ),
      createElement(
        'div',
        { className: 'gt-field' },
        createElement('label', { className: 'gt-field-label', for: 'gt-planned-cu' }, 'Planned CU'),
        cuInput
      )
    );

    return { inputsEl, resultEl };
  }

  // ── Computation ────────────────────────────────────────────────────────────

  /**
   * Runs the what-if calculation and updates the result element in-place.
   * This does NOT call render() — it surgically updates only the result area,
   * which is the correct granularity for a live calculator.
   *
   * @param {number}      currentCGPA
   * @param {number}      currentCU
   * @param {number}      targetCGPA
   * @param {number}      plannedCU
   * @param {string}      scaleId
   * @param {object}      scale
   * @param {HTMLElement} resultEl
   */
  _compute(currentCGPA, currentCU, targetCGPA, plannedCU, scaleId, scale, resultEl) {
    // Guard: both fields must be valid numbers
    if (!Number.isFinite(targetCGPA) || !Number.isFinite(plannedCU) || plannedCU < 1) {
      this._renderResultIdle(resultEl);
      return;
    }

    const result = GPACalculatorService.requiredGPAForTarget({
      currentCGPA,
      currentCU,
      targetCGPA,
      plannedCU,
      scaleId,
    });

    clearElement(resultEl);

    if (!result.achievable && result.requiredGPA > scale.maxGPA) {
      // Impossible — required GPA exceeds scale maximum
      this._renderResultCard(resultEl, {
        variant: 'fail',
        gpaLabel: `${formatGPA(result.requiredGPA)} needed`,
        gpaText: formatGPA(result.requiredGPA),
        difficulty: _difficulty(result.requiredGPA, scale.maxGPA),
        math: `A GPA of <strong>${formatGPA(result.requiredGPA)}</strong> is required — above
                    the <strong>${scale.maxGPA.toFixed(2)}</strong> maximum. Lower your target or
                    earn more credit units before attempting this goal.`,
        honor: null,
        scaleId,
      });
      return;
    }

    if (!result.achievable) {
      this._renderResultCard(resultEl, {
        variant: 'fail',
        gpaLabel: 'Not achievable',
        gpaText: '—',
        difficulty: { label: 'Impossible', cls: 'gt-difficulty--impossible' },
        math: result.message,
        honor: null,
        scaleId,
      });
      return;
    }

    if (result.requiredGPA <= 0) {
      // Already there or above
      const honor = GPACalculatorService.getHonorClassification(targetCGPA, scaleId);
      this._renderResultCard(resultEl, {
        variant: 'already',
        gpaLabel: 'Already achieved',
        gpaText: formatGPA(currentCGPA),
        difficulty: { label: 'Achieved', cls: 'gt-difficulty--achieved' },
        math: `Your current CGPA of <strong>${formatGPA(currentCGPA)}</strong> already meets
                    or exceeds your target of <strong>${targetCGPA.toFixed(2)}</strong>. Keep it up!`,
        honor,
        scaleId,
      });
      return;
    }

    // Normal achievable result
    const diff = _difficulty(result.requiredGPA, scale.maxGPA);
    const honor = GPACalculatorService.getHonorClassification(targetCGPA, scaleId);

    const currentQP = currentCGPA * currentCU;
    const targetQP = targetCGPA * (currentCU + plannedCU);
    const shortfall = targetQP - currentQP;

    const mathHtml =
      `Current: <strong>${formatGPA(currentCGPA)} × ${currentCU} CU = ${currentQP.toFixed(2)} QP</strong>. ` +
      `Target: <strong>${targetCGPA.toFixed(2)} × ${currentCU + plannedCU} CU = ${targetQP.toFixed(2)} QP</strong>. ` +
      `Shortfall: <strong>${shortfall.toFixed(2)} QP ÷ ${plannedCU} CU = ${formatGPA(result.requiredGPA)} required</strong>.`;

    this._renderResultCard(resultEl, {
      variant: 'ok',
      gpaLabel: 'Required GPA',
      gpaText: formatGPA(result.requiredGPA),
      difficulty: diff,
      math: mathHtml,
      honor,
      scaleId,
    });
  }

  // ── Result renderers ───────────────────────────────────────────────────────

  /** Clears result area and shows the idle placeholder. */
  _renderResultIdle(resultEl) {
    clearElement(resultEl);
    resultEl.append(
      createElement(
        'div',
        { className: 'gt-result-idle' },
        'Enter a target CGPA and planned credit units to calculate your required GPA.'
      )
    );
  }

  /**
   * Renders the structured result card inside `resultEl`.
   *
   * @param {HTMLElement} resultEl
   * @param {{
   *   variant:    'ok'|'already'|'fail',
   *   gpaLabel:   string,
   *   gpaText:    string,
   *   difficulty: { label: string, cls: string },
   *   math:       string,
   *   honor:      object|null,
   *   scaleId:    string
   * }} opts
   */
  _renderResultCard(resultEl, { variant, gpaLabel, gpaText, difficulty, math, honor }) {
    const card = createElement('div', {
      className: `gt-result-card gt-result-card--${variant}`,
    });

    // Header row: GPA + difficulty badge
    const gpaGroup = createElement(
      'div',
      { className: 'gt-result-gpa-group' },
      createElement('span', { className: 'gt-result-gpa', 'aria-live': 'polite' }, gpaText),
      createElement('span', { className: 'gt-result-gpa-label' }, gpaLabel)
    );

    const diffBadge = createElement(
      'span',
      { className: `gt-difficulty ${difficulty.cls}` },
      difficulty.label
    );

    card.append(createElement('div', { className: 'gt-result-header' }, gpaGroup, diffBadge));

    // Math breakdown
    const mathEl = createElement('p', { className: 'gt-result-math' });
    mathEl.innerHTML = math; // Safe: math string is composed internally, never from user input
    card.append(mathEl);

    // Resulting honour classification
    if (honor) {
      card.append(
        createElement(
          'div',
          { className: `gt-result-honor ${honor.cssClass}` },
          `${honor.badge}  Achieving ${honor.label}`
        )
      );
    }

    resultEl.append(card);
  }
}
