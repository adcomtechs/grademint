/**
 * @module SemesterPanel
 * @description Renders the course table and manages CourseForm for one semester.
 *
 * RESPONSIBILITIES (exactly three):
 *   1. Render the course table for the active semester
 *   2. Mount/unmount CourseForm when the active semester changes
 *   3. Animate course rows into view via IntersectionObserver
 *
 * SCROLL FIX:
 *   After ADD_COURSE the store emits state:changed, watchState fires, and
 *   render() rebuilds the table. The previous implementation had no scroll
 *   call after the rebuild — new rows appeared below the fold silently.
 *
 *   Fix: _prevCourseCount tracks the count before each render. If the new
 *   count is greater (a course was added), _scrollLastRowIntoView() is called
 *   after the DOM is painted, bringing the new row into view smoothly.
 *
 * DOES NOT:
 *   - Know about tabs (SemesterTabStrip)
 *   - Know about the overview table (OverviewPanel)
 *   - Open modals directly — delegates to callbacks injected by SemesterManager
 */

import { BaseComponent } from '../../common/BaseComponent.js';
import { CourseForm } from '../course-form/index.js';
import { Semester } from '../../../domain/Semester.js';
import { createElement, clearElement } from '../../../utils/dom.js';
import { formatGPA } from '../../../utils/formatters.js';
import { watchState } from '../../../utils/selector.js';
import { createLogger } from '../../../utils/logger.js';

const log = createLogger('SemesterPanel');

export class SemesterPanel extends BaseComponent {
  /**
   * @param {HTMLElement} container
   * @param {ReturnType<import('../../../core/Store.js').createStore>} store
   * @param {{
   *   onEditCourse:   (course: Course, semId: string) => void,
   *   onDeleteCourse: (course: Course, semId: string) => void,
   * }} callbacks
   */
  constructor(container, store, { onEditCourse, onDeleteCourse }) {
    super(container, store);
    this._onEditCourse = onEditCourse;
    this._onDeleteCourse = onDeleteCourse;

    /** Currently mounted CourseForm instance. */
    this._activeForm = null;

    /**
     * Course count from the previous render cycle.
     * Used to detect whether a course was just added so we can scroll
     * the new row into view without scrolling on unrelated state changes.
     * @type {number}
     */
    this._prevCourseCount = 0;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  afterMount() {
    const unsub = watchState(
      this.store,
      (s) => [s.semesters, s.activeSemesterId, s.student?.scaleId],
      () => this.safeRender()
    );
    this.addSubscription(unsub);
  }

  unmount() {
    this._activeForm?.unmount();
    this._activeForm = null;
    super.unmount();
  }

  render() {
    // Always unmount the previous form before rebuilding. A stale form holds
    // an AbortController and listeners that would target detached DOM nodes.
    this._activeForm?.unmount();
    this._activeForm = null;

    clearElement(this.container);

    const state = this.store.getState();
    const semesters = state.semesters.map(Semester.fromJSON);
    const activeId = state.activeSemesterId;
    const activeSem = semesters.find((s) => s.id === activeId) ?? semesters.at(-1);

    if (!activeSem) {
      log.debug('SemesterPanel render called with no active semester');
      return;
    }

    // ── Scroll detection ─────────────────────────────────────────────────────
    // Capture the count BEFORE we update _prevCourseCount so we can compare
    // after the DOM is built.
    const prevCount = this._prevCourseCount;
    const newCount = activeSem.courseCount;
    this._prevCourseCount = newCount;
    const courseAdded = newCount > prevCount;

    // ── Build card ───────────────────────────────────────────────────────────
    const card = createElement('div', { className: 'semester-card' });
    card.append(this._buildCourseTable(activeSem));

    const formContainer = createElement('div', { className: 'semester-card-footer' });
    card.append(formContainer);
    this.container.append(card);

    // ── Mount CourseForm ─────────────────────────────────────────────────────
    this._activeForm = new CourseForm(formContainer, this.store, activeSem.id);
    this._activeForm.mount();

    // ── Animate rows ─────────────────────────────────────────────────────────
    this._observeRows(this.container);

    // ── Scroll new row into view ─────────────────────────────────────────────
    // Deferred one rAF so the browser has painted the new row before we scroll.
    if (courseAdded) {
      requestAnimationFrame(() => this._scrollLastRowIntoView());
    }
  }

  // ── Course table ───────────────────────────────────────────────────────────

  _buildCourseTable(sem) {
    const wrapper = createElement('div', { className: 'table-wrapper' });

    const table = createElement('table', {
      className: 'course-table',
      'aria-label': `Courses in ${sem.label}`,
    });

    const thead = createElement(
      'thead',
      {},
      createElement(
        'tr',
        {},
        ...['Code', 'Course Title', 'Score', 'Units', 'Grade', 'Pts', ''].map((h) =>
          createElement('th', { scope: 'col' }, h)
        )
      )
    );

    const tbody = createElement('tbody');

    if (sem.courseCount === 0) {
      tbody.append(
        createElement(
          'tr',
          { className: 'course-empty-row' },
          createElement(
            'td',
            { colspan: '7', className: 'semester-empty' },
            'No courses yet — use the button below to add one.'
          )
        )
      );
    } else {
      sem.courses.forEach((c) => tbody.append(this._buildCourseRow(c, sem.id)));
    }

    const tfoot = createElement(
      'tfoot',
      {},
      createElement(
        'tr',
        { className: 'table-footer' },
        createElement('td', { colspan: '3', className: 'footer-label' }, 'Semester Totals'),
        createElement('td', { style: { textAlign: 'center' } }, String(sem.totalCreditUnits)),
        createElement('td'),
        createElement('td', { style: { textAlign: 'center' } }, sem.totalQualityPoints.toFixed(1)),
        createElement(
          'td',
          { style: { textAlign: 'right' } },
          createElement(
            'span',
            { className: 'semester-gpa-badge', title: 'Semester GPA' },
            formatGPA(sem.gpa)
          )
        )
      )
    );

    table.append(thead, tbody, tfoot);
    wrapper.append(table);
    return wrapper;
  }

  _buildCourseRow(course, semId) {
    const scoreDisplay = course.hasScore ? String(course.score) : '—';

    return createElement(
      'tr',
      { className: 'course-row', dataset: { id: course.id } },
      createElement('td', { className: 'td-code course-code-cell' }, course.code),
      createElement('td', { className: 'td-name' }, course.title),
      createElement('td', { className: 'td-score' }, scoreDisplay),
      createElement('td', { className: 'td-credits' }, String(course.creditUnits)),
      createElement(
        'td',
        { className: 'td-grade' },
        createElement('span', { className: `grade-badge ${course.gradeCssClass}` }, course.grade)
      ),
      createElement('td', { className: 'td-points' }, course.qualityPoints.toFixed(1)),
      createElement(
        'td',
        { className: 'td-actions' },
        createElement(
          'div',
          { className: 'action-group' },
          createElement(
            'button',
            {
              className: 'btn btn--icon',
              title: 'Edit course',
              onClick: () => this._onEditCourse(course, semId),
            },
            '✎'
          ),
          createElement(
            'button',
            {
              className: 'btn btn--icon btn--danger-icon',
              title: 'Delete course',
              onClick: () => this._onDeleteCourse(course, semId),
            },
            '×'
          )
        )
      )
    );
  }

  // ── Animation ──────────────────────────────────────────────────────────────

  /**
   * Stagger-animates course rows as they enter the viewport.
   * @param {HTMLElement} root
   */
  _observeRows(root) {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.style.animationPlayState = 'running';
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.1 }
    );

    root.querySelectorAll('.course-row').forEach((row) => {
      row.style.animationPlayState = 'paused';
      io.observe(row);
    });
  }

  /**
   * Scrolls the last course row into view after a course is added.
   *
   * Uses `scrollIntoView` with `behavior: 'smooth'` so the scroll is
   * visible and communicates that something changed, rather than a jarring
   * instant jump. `block: 'nearest'` avoids scrolling when the row is
   * already partially visible — it only scrolls as much as needed.
   */
  _scrollLastRowIntoView() {
    const rows = this.container.querySelectorAll('.course-row');
    const last = rows[rows.length - 1];
    if (!last) return;

    last.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }
}
