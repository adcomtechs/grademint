/**
 * @module ScoreSection
 * @description Score entry with live grade preview and progressive grade override.
 *
 * SINGLE RESPONSIBILITY:
 *   Own the score input, the animated fill bar, the live grade badge,
 *   and the contextual "No score? Enter grade instead" override toggle.
 *   Notify the caller of changes — never mutates external state itself.
 *
 * DOES NOT:
 *   - Know about credit units, course code, or title
 *   - Know what store dispatch looks like
 *   - Validate values (CourseFormValidator's job)
 *
 * PROGRESSIVE DISCLOSURE MODEL:
 *   Score is always the primary input. The grade badge is a *derived output*
 *   shown live next to the score. The grade picker is hidden by default and
 *   only revealed via the override toggle — either clicked manually or
 *   triggered automatically when the score field is cleared.
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │  Score (0 – 100)                                │
 *   │  [ 75 ]  ━━━━━━━━━━━━━━━━━━━░░░  [ A  5.0pts ] │
 *   │  ↳ No score? Enter grade directly  (link)        │
 *   │    ┌────────────────────────────────────────┐   │  ← only when open
 *   │    │  A    B    C    D    E    F             │   │
 *   │    └────────────────────────────────────────┘   │
 *   └──────────────────────────────────────────────────┘
 *
 * GRADE BADGE OVERRIDE SEMANTICS:
 *   When a grade is manually selected via the override picker, the badge
 *   switches to show the override with a distinct "overridden" visual style.
 *   Clearing the score field while a grade override is active keeps the
 *   override — the student explicitly chose it. Clearing the override
 *   resets to computed-from-score mode.
 */

import { createElement } from '@/utils/dom.js';
import { gradeFromScore, getGradeEntries } from '@/utils/helpers.js';
import { DEFAULT_SCALE_ID } from '@/utils/constants.js';

export class ScoreSection {
  /**
   * @param {{
   *   scaleId?:            string,
   *   initialScore?:       number | null,
   *   initialOverride?:    string | null,
   *   initialOverrideOpen?: boolean,
   *   onScoreChange:       (score: number | null) => void,
   *   onOverrideChange:    (grade: string | null) => void,
   *   onOverrideOpenChange: (open: boolean) => void,
   * }} options
   */
  constructor(options = {}) {
    this._scaleId = options.scaleId ?? DEFAULT_SCALE_ID;
    this._opts = options;
    this._ctrl = new AbortController();

    // DOM refs
    this._scoreInput = null;
    this._barFill = null;
    this._gradeBadge = null;
    this._gradeLetterEl = null;
    this._gradePtsEl = null;
    this._overrideToggle = null;
    this._overridePanel = null;
    this._overrideBtns = [];
    this.gradeErr = null;

    // Internal UI state (mirrors CourseFormState, kept for badge updates)
    this._currentScore = options.initialScore ?? null;
    this._overrideGrade = options.initialOverride ?? null;
    this._isOverrideOpen = options.initialOverrideOpen ?? false;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Builds and returns the section root. Does not append to DOM. */
  build() {
    const root = createElement('div', { className: 'cf2-score-section' });
    root.append(
      this._buildScoreRow(),
      this._buildOverrideToggle(),
      this._buildOverridePanel(),
      this._buildGradeErr()
    );

    // Seed initial UI state
    if (this._currentScore !== null) this._updateBar(this._currentScore);
    if (this._overrideGrade) this._updateBadgeOverride(this._overrideGrade);
    if (this._isOverrideOpen) this._applyOverrideOpen(true);

    return root;
  }

  /** Returns current raw score value or null. */
  getScore() {
    const raw = this._scoreInput?.value;
    if (raw === null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
  }

  /** Returns currently selected override grade letter or null. */
  getOverrideGrade() {
    return this._overrideGrade;
  }

  /** Resets the section to empty state. */
  reset() {
    if (this._scoreInput) this._scoreInput.value = '';
    this._currentScore = null;
    this._overrideGrade = null;
    this._isOverrideOpen = false;
    this._clearBar();
    this._clearBadge();
    this._clearOverrideSelection();
    this._applyOverrideOpen(false);
    if (this.gradeErr) this.gradeErr.textContent = '';
    this._scoreInput?.classList.remove('input--error');
  }

  /** Marks or clears error state on the score input. */
  setScoreError(hasError) {
    this._scoreInput?.classList.toggle('input--error', hasError);
  }

  /** Cancels all event listeners. */
  destroy() {
    this._ctrl.abort();
  }

  // ── Build helpers ──────────────────────────────────────────────────────────

  _buildScoreRow() {
    // Score input
    this._scoreInput = createElement('input', {
      id: 'cf2-score-input',
      className: 'form-input cf2-score-input',
      type: 'number',
      min: '0',
      max: '100',
      placeholder: '0 – 100',
      autocomplete: 'off',
      value: this._currentScore !== null ? String(this._currentScore) : '',
    });

    // Progress bar
    this._barFill = createElement('div', {
      className: 'cf2-score-bar-fill',
      style: { width: '0%' },
    });
    const bar = createElement('div', { className: 'cf2-score-bar' }, this._barFill);

    // Grade badge (live output)
    this._gradeLetterEl = createElement('span', { className: 'cf2-badge-letter' }, '—');
    this._gradePtsEl = createElement('span', { className: 'cf2-badge-pts' });
    this._gradeBadge = createElement(
      'div',
      {
        className: 'cf2-grade-badge',
        role: 'status',
        'aria-live': 'polite',
        'aria-label': 'Computed grade',
      },
      this._gradeLetterEl,
      this._gradePtsEl
    );

    // Wire score input
    this._scoreInput.addEventListener(
      'input',
      () => {
        this._scoreInput.classList.remove('input--error');
        if (this.gradeErr) this.gradeErr.textContent = '';

        const score = this.getScore();
        this._currentScore = score;
        this._opts.onScoreChange?.(score);

        if (score === null) {
          this._clearBar();
          // If override is not active, clear badge
          if (!this._overrideGrade) this._clearBadge();
          // Auto-open the override panel when score is cleared so the user
          // naturally discovers grade-only entry
          if (!this._isOverrideOpen) this._triggerOverrideOpen(true);
        } else {
          this._updateBar(score);
          // If no manual override, show computed grade
          if (!this._overrideGrade) this._updateBadgeFromScore(score);
          // Auto-close the override panel when a score is entered
          if (this._isOverrideOpen && !this._overrideGrade) {
            this._triggerOverrideOpen(false);
          }
        }
      },
      { signal: this._ctrl.signal }
    );

    return createElement(
      'div',
      { className: 'cf2-score-row' },
      createElement(
        'div',
        { className: 'cf2-score-field' },
        createElement(
          'label',
          { className: 'form-label', for: 'cf2-score-input' },
          'Score (0 – 100)'
        ),
        this._scoreInput,
        bar
      ),
      this._gradeBadge
    );
  }

  _buildOverrideToggle() {
    this._overrideToggle = createElement(
      'button',
      {
        type: 'button',
        className: 'cf2-override-toggle',
        'aria-expanded': String(this._isOverrideOpen),
      },
      createElement('span', { className: 'cf2-override-toggle-icon', 'aria-hidden': 'true' }, '↳'),
      createElement(
        'span',
        { className: 'cf2-override-toggle-text' },
        this._isOverrideOpen ? 'Hide grade picker' : 'No score? Enter grade directly'
      )
    );

    this._overrideToggle.addEventListener(
      'click',
      () => {
        const next = !this._isOverrideOpen;
        this._triggerOverrideOpen(next);
        // If closing and no score, clear override so form is not in an invalid state
        if (!next && this._currentScore === null) {
          this._overrideGrade = null;
          this._clearBadge();
          this._clearOverrideSelection();
          this._opts.onOverrideChange?.(null);
        }
      },
      { signal: this._ctrl.signal }
    );

    return this._overrideToggle;
  }

  _buildOverridePanel() {
    const entries = getGradeEntries(this._scaleId);
    this._overrideBtns = [];

    const grid = createElement('div', {
      className: 'cf2-override-grid',
      role: 'listbox',
      'aria-label': 'Select a grade letter',
    });

    entries.forEach(({ letter, points, cssClass }) => {
      const mod = cssClass.replace('grade-badge--', '');
      const isSelected = letter === this._overrideGrade;

      const btn = createElement(
        'button',
        {
          type: 'button',
          className: `cf2-override-btn cf2-override-btn--${mod}${isSelected ? ' is-selected' : ''}`,
          role: 'option',
          'aria-selected': String(isSelected),
          'aria-label': `${letter}: ${points.toFixed(1)} grade points`,
          dataset: { grade: letter },
        },
        createElement('span', { className: 'cf2-override-letter' }, letter),
        createElement('span', { className: 'cf2-override-pts' }, `${points.toFixed(1)}`)
      );

      btn.addEventListener(
        'click',
        () => {
          const alreadySelected = this._overrideGrade === letter;

          // Clicking the selected grade deselects it (toggle-off)
          if (alreadySelected) {
            this._overrideGrade = null;
            this._clearOverrideSelection();
            this._opts.onOverrideChange?.(null);
            // Restore computed badge if score exists
            if (this._currentScore !== null) {
              this._updateBadgeFromScore(this._currentScore);
            } else {
              this._clearBadge();
            }
            return;
          }

          this._overrideGrade = letter;
          this._overrideBtns.forEach((b) => {
            b.classList.remove('is-selected');
            b.setAttribute('aria-selected', 'false');
          });
          btn.classList.add('is-selected');
          btn.setAttribute('aria-selected', 'true');

          this._updateBadgeOverride(letter);
          this._opts.onOverrideChange?.(letter);
          if (this.gradeErr) this.gradeErr.textContent = '';
        },
        { signal: this._ctrl.signal }
      );

      this._overrideBtns.push(btn);
      grid.append(btn);
    });

    this._overridePanel = createElement(
      'div',
      {
        className: `cf2-override-panel${this._isOverrideOpen ? ' is-open' : ''}`,
        'aria-hidden': String(!this._isOverrideOpen),
      },
      createElement(
        'p',
        { className: 'cf2-override-hint' },
        'Select a grade letter. Click again to deselect.'
      ),
      grid
    );

    return this._overridePanel;
  }

  _buildGradeErr() {
    this.gradeErr = createElement('span', {
      className: 'field-error cf2-field-error cf2-grade-err',
      role: 'alert',
    });
    return this.gradeErr;
  }

  // ── Badge helpers ──────────────────────────────────────────────────────────

  _updateBadgeFromScore(score) {
    const { letter, points, cssClass } = gradeFromScore(score, this._scaleId);
    const mod = cssClass.replace('grade-badge--', '');
    this._gradeLetterEl.textContent = letter;
    this._gradePtsEl.textContent = `${points.toFixed(1)} pts`;
    this._gradeBadge.className = `cf2-grade-badge cf2-grade-badge--${mod}`;
    this._gradeBadge.removeAttribute('data-override');
  }

  _updateBadgeOverride(letter) {
    const entries = getGradeEntries(this._scaleId);
    const entry = entries.find((e) => e.letter === letter);
    if (!entry) return;

    const mod = entry.cssClass.replace('grade-badge--', '');
    this._gradeLetterEl.textContent = entry.letter;
    this._gradePtsEl.textContent = `${entry.points.toFixed(1)} pts`;
    this._gradeBadge.className = `cf2-grade-badge cf2-grade-badge--${mod} is-override`;
    this._gradeBadge.dataset.override = 'true';
  }

  _clearBadge() {
    this._gradeLetterEl.textContent = '—';
    this._gradePtsEl.textContent = '';
    this._gradeBadge.className = 'cf2-grade-badge';
    delete this._gradeBadge.dataset.override;
  }

  // ── Bar helpers ────────────────────────────────────────────────────────────

  _updateBar(score) {
    if (this._barFill) {
      this._barFill.style.width = `${Math.max(0, Math.min(100, score))}%`;
    }
  }

  _clearBar() {
    if (this._barFill) this._barFill.style.width = '0%';
  }

  // ── Override panel open/close ──────────────────────────────────────────────

  _triggerOverrideOpen(open) {
    this._isOverrideOpen = open;
    this._applyOverrideOpen(open);
    this._opts.onOverrideOpenChange?.(open);
  }

  _applyOverrideOpen(open) {
    this._overridePanel?.classList.toggle('is-open', open);
    this._overridePanel?.setAttribute('aria-hidden', String(!open));
    this._overrideToggle?.setAttribute('aria-expanded', String(open));

    const textEl = this._overrideToggle?.querySelector('.cf2-override-toggle-text');
    if (textEl) {
      textEl.textContent = open ? 'Hide grade picker' : 'No score? Enter grade directly';
    }
  }

  _clearOverrideSelection() {
    this._overrideBtns.forEach((b) => {
      b.classList.remove('is-selected');
      b.setAttribute('aria-selected', 'false');
    });
  }
}
