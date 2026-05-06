/**
 * @module analytics/buildWhatIf
 * @description Renders the What-If GPA calculator section for AnalyticsPanel.
 *
 * Accepts `addListener` as a parameter (instead of closing over `this`) so
 * event cleanup is still delegated to BaseComponent's AbortController, while
 * keeping this builder a pure function with no class dependency.
 */

import { createElement } from '../../../utils/dom.js';
import { formatGPA } from '../../../utils/formatters.js';
import { GPACalculatorService } from '../../../services/GPACalculatorService.js';
import { setWhatIfResult } from './whatIfHelpers.js';

/**
 * @param {number}   currentCGPA
 * @param {number}   currentCU
 * @param {string}   scaleId
 * @param {object}   scale        - grading scale object
 * @param {Function} addListener  - BaseComponent.addListener bound to the instance
 * @returns {HTMLElement}
 */
export function buildWhatIf(currentCGPA, currentCU, scaleId, scale, addListener) {
  const section = createElement('div', { className: 'ap-whatif' });

  section.append(
    createElement(
      'h3',
      { className: 'ap-section-title', style: { marginBottom: 0 } },
      '🎯 What-If Calculator'
    ),
    createElement(
      'p',
      {
        style: {
          fontSize: '0.8rem',
          color: 'var(--color-text-dim)',
          marginTop: '0.4rem',
          marginBottom: 0,
        },
      },
      'Estimate the GPA required across future semesters to reach a target CGPA.'
    )
  );

  // ── Inputs ─────────────────────────────────────────────────────────────────
  const targetInput = createElement('input', {
    id: 'ap-wi-target',
    className: 'form-input',
    type: 'number',
    min: '0',
    max: String(scale.maxGPA),
    step: '0.01',
    placeholder: (scale.maxGPA * 0.9).toFixed(2),
  });

  const cuInput = createElement('input', {
    id: 'ap-wi-cu',
    className: 'form-input',
    type: 'number',
    min: '1',
    max: '120',
    step: '1',
    placeholder: '30',
  });

  const resultBox = createElement(
    'div',
    { className: 'ap-whatif-result' },
    createElement('span', { className: 'ap-whatif-icon' }, 'ℹ'),
    createElement(
      'span',
      { className: 'ap-whatif-msg' },
      'Enter a target CGPA and planned credit units.'
    )
  );

  const calcBtn = createElement('button', { className: 'btn btn--primary btn--sm' }, 'Calculate');

  // addListener() routes through BaseComponent's AbortController — the handler
  // is cleaned up automatically on unmount without a manual removeEventListener.
  addListener(calcBtn, 'click', () => {
    const target = parseFloat(targetInput.value);
    const planned = parseInt(cuInput.value, 10);

    if (!Number.isFinite(target) || !Number.isFinite(planned)) {
      setWhatIfResult(
        resultBox,
        'error',
        '✕',
        'Please enter both a target CGPA and planned credit units.'
      );
      return;
    }

    const result = GPACalculatorService.requiredGPAForTarget({
      currentCGPA,
      currentCU,
      targetCGPA: target,
      plannedCU: planned,
      scaleId,
    });

    if (result.achievable) {
      const alreadyThere = result.requiredGPA <= 0;
      setWhatIfResult(
        resultBox,
        'success',
        alreadyThere ? '🎉' : '✓',
        result.message,
        alreadyThere ? null : formatGPA(result.requiredGPA)
      );
    } else {
      setWhatIfResult(resultBox, 'error', '✕', result.message);
    }
  });

  // ── Layout grid ────────────────────────────────────────────────────────────
  const grid = createElement(
    'div',
    { className: 'ap-whatif-grid' },
    createElement(
      'div',
      { className: 'form-group' },
      createElement('label', { className: 'form-label', for: 'ap-wi-target' }, 'Target CGPA'),
      targetInput
    ),
    createElement(
      'div',
      { className: 'form-group' },
      createElement('label', { className: 'form-label', for: 'ap-wi-cu' }, 'Planned Credit Units'),
      cuInput
    ),
    createElement(
      'div',
      { className: 'ap-whatif-actions' },
      createElement('label', { className: 'form-label', style: { opacity: 0 } }, 'x'),
      calcBtn
    )
  );

  section.append(grid, resultBox);
  return section;
}
