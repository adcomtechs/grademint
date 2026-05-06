/**
 * @module gradeWidget
 * @description Sidebar GPA quick-check widget.
 *
 * The widget shows the grade letter, grade point, and quality points (for
 * a 3-unit course) for any score the user types. It runs entirely in the
 * browser using the same gradeFromScore() function used by the main app.
 *
 * DOM MUTATION:
 *   Uses createElement() and clearElement() from dom.js — consistent with
 *   every other component in the project. No innerHTML anywhere.
 *
 * GRADE LOOKUP:
 *   Delegates to gradeFromScore() from helpers.js — the single authoritative
 *   score→grade converter for the 5.0 scale. No local reimplementation.
 */

import { createElement, clearElement } from '@/utils/dom.js';
import { gradeFromScore } from '@/utils/helpers.js';
import { DEFAULT_SCALE_ID } from '@/utils/constants.js';

/**
 * Renders grade information rows into the widget result container.
 *
 * @param {HTMLElement} resultEl   The #widget-result container
 * @param {number}      score      Validated score in [0, 100]
 */
function _renderWidgetResult(resultEl, score) {
  const { letter, points, cssClass } = gradeFromScore(score, DEFAULT_SCALE_ID);

  clearElement(resultEl);

  resultEl.append(
    _resultRow(
      'Grade',
      createElement('span', { className: `grade-badge ${cssClass} widget-result-value` }, letter)
    ),
    _resultRow(
      'Grade Point',
      createElement('span', { className: 'widget-result-value' }, points.toFixed(1))
    ),
    _resultRow(
      'Quality Points (3 CU)',
      createElement('span', { className: 'widget-result-value' }, (points * 3).toFixed(1))
    )
  );
}

/**
 * Renders an error message into the widget result container.
 *
 * @param {HTMLElement} resultEl
 * @param {string}      message
 */
function _renderWidgetError(resultEl, message) {
  clearElement(resultEl);
  resultEl.append(
    createElement(
      'p',
      {
        style: { fontSize: '0.78rem', color: 'var(--color-danger)' },
      },
      message
    )
  );
}

/**
 * Creates one label + value row for the widget result.
 *
 * @param {string}      label
 * @param {HTMLElement} valueEl
 * @returns {HTMLElement}
 */
function _resultRow(label, valueEl) {
  return createElement(
    'div',
    { className: 'widget-result-row' },
    createElement('span', {}, label),
    valueEl
  );
}

/**
 * Mounts the score input listener for the sidebar GPA widget.
 *
 * @param {HTMLInputElement | null} scoreInput   #widget-score
 * @param {HTMLElement | null}      resultEl     #widget-result
 */
export function initGradeWidget(scoreInput, resultEl) {
  if (!scoreInput || !resultEl) return;

  scoreInput.addEventListener('input', () => {
    const raw = scoreInput.value.trim();

    if (!raw) {
      clearElement(resultEl);
      return;
    }

    const n = Number(raw);

    if (!Number.isFinite(n) || n < 0 || n > 100) {
      _renderWidgetError(resultEl, 'Enter a score between 0 and 100');
      return;
    }

    _renderWidgetResult(resultEl, n);
  });
}
