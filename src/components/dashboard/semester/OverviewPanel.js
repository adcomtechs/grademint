/**
 * @module OverviewPanel
 * @description Renders the "∑ Overview" breakdown table panel.
 *
 * RESPONSIBILITY:
 * Renders the per-semester breakdown table shown when the Overview tab is
 * active. Each row is clickable and dispatches SET_ACTIVE_SEMESTER to switch
 * to that semester's detail view.
 *
 * DOES NOT:
 * - Know about tab rendering (SemesterTabStrip)
 * - Know about course tables (SemesterPanel)
 * - Open any modals
 */

import { BaseComponent } from '../../common/BaseComponent.js';
import { Semester } from '../../../domain/Semester.js';
import { createElement, clearElement } from '../../../utils/dom.js';
import { formatGPA } from '../../../utils/formatters.js';
import { watchState } from '../../../utils/selector.js';
import { UI_KEYS } from '../../../utils/constants.js';
import { uiStorage } from '../../../services/UIStorageService.js';
import { gpaColor } from '../../../utils/gpaColors.js';

export class OverviewPanel extends BaseComponent {
  constructor(container, store) {
    super(container, store);
  }

  afterMount() {
    const unsub = watchState(
      this.store,
      (s) => [s.semesters, s.previousRecord],
      () => this.safeRender()
    );
    this.addSubscription(unsub);
  }

  render() {
    clearElement(this.container);

    const state = this.store.getState();
    const semesters = state.semesters.map(Semester.fromJSON);

    if (semesters.length === 0) {
      this.container.append(this._buildEmpty());
      return;
    }

    this.container.append(this._buildCard(semesters, state.previousRecord));
  }

  // ── Builders ───────────────────────────────────────────────────────────────

  _buildCard(semesters, previousRecord) {
    const cgpa = _computeCGPA(semesters, previousRecord);
    const totalCU = semesters.reduce((s, sem) => s + sem.totalCreditUnits, 0);
    const totalQP = semesters.reduce((s, sem) => s + sem.totalQualityPoints, 0);
    const totalCourses = semesters.reduce((s, sem) => s + sem.courseCount, 0);

    const card = createElement('div', { className: 'semester-card overview-card' });

    card.append(
      createElement(
        'div',
        { className: 'overview-header' },
        createElement('h3', { className: 'overview-title' }, '∑ Programme Overview'),
        createElement(
          'p',
          { className: 'overview-subtitle' },
          "All semesters combined — click any row to view that semester's courses."
        )
      )
    );

    card.append(this._buildTable(semesters, previousRecord, cgpa, totalCU, totalQP, totalCourses));

    return card;
  }

  _buildTable(semesters, previousRecord, cgpa, totalCU, totalQP, totalCourses) {
    const wrapper = createElement('div', { className: 'table-wrapper' });

    const table = createElement('table', {
      className: 'course-table overview-table',
      'aria-label': 'Programme semester breakdown',
    });

    const thead = createElement(
      'thead',
      {},
      createElement(
        'tr',
        {},
        ...['#', 'Semester', 'GPA', 'Credit Units', 'Courses', 'Quality Points'].map((h) =>
          createElement('th', { scope: 'col' }, h)
        )
      )
    );

    const tbody = createElement('tbody');
    semesters.forEach((sem, idx) => {
      tbody.append(this._buildRow(sem, idx, semesters.length));
    });

    // Previous institutional record row
    if (previousRecord?.creditUnits > 0) {
      tbody.append(this._buildPrevRecordRow(previousRecord));
    }

    const tfoot = createElement(
      'tfoot',
      {},
      createElement(
        'tr',
        { className: 'table-footer overview-totals' },
        createElement('td', { colspan: '2', className: 'footer-label' }, 'Programme Totals'),
        createElement(
          'td',
          { className: 'overview-cgpa-cell' },
          createElement(
            'span',
            { className: 'semester-gpa-badge', title: 'Cumulative GPA' },
            formatGPA(cgpa)
          ),
          createElement('span', { className: 'overview-cgpa-label' }, 'CGPA')
        ),
        createElement('td', { style: { textAlign: 'center' } }, String(totalCU)),
        createElement('td', { style: { textAlign: 'center' } }, String(totalCourses)),
        createElement('td', { style: { textAlign: 'center' } }, totalQP.toFixed(1))
      )
    );

    table.append(thead, tbody, tfoot);
    wrapper.append(table);
    return wrapper;
  }

  _buildRow(sem, idx, total) {
    const isLatest = idx === total - 1;

    return createElement(
      'tr',
      {
        className: `course-row overview-row ${isLatest ? 'overview-row--latest' : ''}`,
        title: `Click to view ${sem.label}`,
        onClick: () => {
          uiStorage.set(UI_KEYS.ACTIVE_SEMESTER_ID, sem.id);
          this.store.dispatch({ type: 'SET_ACTIVE_SEMESTER', payload: { id: sem.id } });
        },
      },
      createElement('td', { className: 'overview-index' }, String(idx + 1)),
      createElement(
        'td',
        { className: 'overview-sem-name' },
        createElement('span', {}, sem.label),
        isLatest
          ? createElement(
              'span',
              { className: 'overview-latest-badge', 'aria-label': 'Latest semester' },
              'Latest'
            )
          : null
      ),
      createElement(
        'td',
        { className: 'overview-gpa' },
        createElement(
          'span',
          {
            className: 'semester-gpa-badge overview-gpa-badge',
            style: {
              background: gpaColor(sem.gpa, 0.12),
              borderColor: gpaColor(sem.gpa, 0.4),
              color: gpaColor(sem.gpa, 1),
            },
          },
          formatGPA(sem.gpa)
        )
      ),
      createElement('td', { style: { textAlign: 'center' } }, String(sem.totalCreditUnits)),
      createElement('td', { style: { textAlign: 'center' } }, String(sem.courseCount)),
      createElement('td', { style: { textAlign: 'center' } }, sem.totalQualityPoints.toFixed(1))
    );
  }

  _buildPrevRecordRow({ creditUnits, qualityPoints }) {
    const prevGPA = creditUnits > 0 ? qualityPoints / creditUnits : 0;
    return createElement(
      'tr',
      { className: 'overview-row overview-row--prev' },
      createElement(
        'td',
        { className: 'overview-index', style: { color: 'var(--color-text-dim)' } },
        '—'
      ),
      createElement(
        'td',
        {
          className: 'overview-sem-name',
          style: { fontStyle: 'italic', color: 'var(--color-text-muted)' },
        },
        '📌 Previous Institutional Record'
      ),
      createElement(
        'td',
        { className: 'overview-gpa' },
        createElement(
          'span',
          { className: 'semester-gpa-badge', style: { opacity: '0.7' } },
          formatGPA(prevGPA)
        )
      ),
      createElement(
        'td',
        { style: { textAlign: 'center', color: 'var(--color-text-muted)' } },
        String(creditUnits)
      ),
      createElement(
        'td',
        { style: { textAlign: 'center', color: 'var(--color-text-muted)' } },
        '—'
      ),
      createElement(
        'td',
        { style: { textAlign: 'center', color: 'var(--color-text-muted)' } },
        qualityPoints.toFixed(1)
      )
    );
  }

  _buildEmpty() {
    return createElement(
      'div',
      { className: 'overview-empty' },
      createElement(
        'p',
        { className: 'overview-empty-text' },
        'No semesters added yet. Click "+ Semester" to begin tracking your academic record.'
      )
    );
  }
}

// ── Module-level helpers ───────────────────────────────────────────────────────

function _computeCGPA(semesters, prev) {
  const allCourses = semesters.flatMap((s) => s.courses);
  const prevCU = prev?.creditUnits ?? 0;
  const prevQP = prev?.qualityPoints ?? 0;
  const totalCU = allCourses.reduce((s, c) => s + c.creditUnits, 0) + prevCU;
  const totalQP = allCourses.reduce((s, c) => s + c.qualityPoints, 0) + prevQP;
  return totalCU > 0 ? totalQP / totalCU : 0;
}
