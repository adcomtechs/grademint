import { createElement } from '@/utils/dom.js';
import { GPACalculatorService } from '@/services/GPACalculatorService.js';
import { formatGPA } from '@/utils/formatters.js';
import { _badgeStyle, _gradeBarColor, _setCssVars } from './transcriptHelpers.js';

export const transcriptSemesterMethods = {
  _buildSemesterBlock(sem, idx, scaleId, scale, runningCGPA) {
    const style = _badgeStyle(sem.gpa);
    const gpaHonor = GPACalculatorService.getHonorClassification(sem.gpa, scaleId);
    const gpaBarPct = Math.min((sem.gpa / scale.maxGPA) * 100, 100).toFixed(1);
    const block = createElement('div', { className: 'tv-semester-block' });

    const mixEl = createElement('div', { className: 'tv-sem-grade-mix' });
    const semDist = GPACalculatorService.gradeDistribution(sem.courses);
    scale.grades.forEach(({ letter }) => {
      const count = semDist[letter];
      if (!count) return;

      const color = _gradeBarColor(letter);
      mixEl.append(
        _setCssVars(
          createElement('span', { className: 'tv-sem-grade-chip' }, `${letter}×${count}`),
          {
            '--tv-grade-color': color,
            '--tv-grade-border': color.replace('0.75', '0.25'),
          }
        )
      );
    });

    const titleCol = createElement(
      'div',
      { className: 'tv-sem-title-col' },
      createElement(
        'span',
        { className: 'tv-sem-label' },
        createElement('span', { className: 'tv-sem-idx' }, String(idx + 1)),
        sem.label
      ),
      createElement(
        'div',
        { className: 'tv-sem-gpa-bar-wrap' },
        createElement(
          'div',
          { className: 'tv-sem-gpa-bar-track' },
          _setCssVars(createElement('div', { className: 'tv-sem-gpa-bar-fill' }), {
            '--tv-gpa-bar-width': `${gpaBarPct}%`,
            '--tv-accent-color': style.color,
          })
        ),
        createElement('span', { className: 'tv-sem-gpa-pct-label' }, `${gpaBarPct}%`)
      ),
      mixEl
    );

    const statsCol = createElement(
      'div',
      { className: 'tv-sem-stats-col' },
      _setCssVars(
        createElement(
          'span',
          { className: 'tv-sem-gpa-badge tv-dynamic-badge' },
          `GPA ${formatGPA(sem.gpa)}`
        ),
        {
          '--tv-accent-color': style.color,
          '--tv-accent-border': style.border,
          '--tv-accent-bg': style.bg,
        }
      ),
      createElement(
        'div',
        { className: 'tv-sem-meta-row' },
        createElement('span', {}, `${sem.totalCreditUnits} CU`),
        createElement('span', {}, `${sem.totalQualityPoints.toFixed(1)} QP`),
        createElement('span', {}, `${sem.courseCount} course${sem.courseCount !== 1 ? 's' : ''}`),
        gpaHonor
          ? createElement(
              'span',
              { className: gpaHonor.cssClass },
              `${gpaHonor.badge} ${gpaHonor.label}`
            )
          : null
      ),
      Number.isFinite(runningCGPA) && runningCGPA > 0
        ? createElement(
            'span',
            { className: 'tv-sem-running-cgpa', title: 'Cumulative GPA as of this semester' },
            '∑',
            ` CGPA ${formatGPA(runningCGPA)}`
          )
        : null
    );

    block.append(createElement('div', { className: 'tv-sem-header' }, titleCol, statsCol));

    if (sem.courseCount === 0) {
      block.append(
        createElement(
          'p',
          { className: 'tv-empty-semester-note' },
          'No courses recorded for this semester.'
        )
      );
      return block;
    }

    const thead = createElement(
      'thead',
      {},
      createElement(
        'tr',
        {},
        ...['Course Code', 'Course Title', 'Score', 'Grade', 'Grade Pt', 'CU', 'Quality Pts'].map(
          (h) => createElement('th', { scope: 'col' }, h)
        )
      )
    );

    const tbody = createElement('tbody');
    sem.courses.forEach((course) => {
      const inputModeBadge =
        course.inputMode !== 'score'
          ? createElement('span', { className: 'tv-input-mode-badge' }, course.inputMode)
          : null;

      tbody.append(
        createElement(
          'tr',
          {},
          createElement('td', { className: 'tv-code-cell' }, course.code),
          createElement('td', { className: 'tv-title-cell' }, course.title, inputModeBadge),
          createElement(
            'td',
            { className: `tv-score-cell${course.hasScore ? '' : ' is-dash'}` },
            course.hasScore ? String(course.score) : '—'
          ),
          createElement(
            'td',
            {},
            createElement(
              'span',
              { className: `grade-badge ${course.gradeCssClass}` },
              course.grade
            )
          ),
          createElement('td', { className: 'tv-gp-cell' }, course.gradePoint.toFixed(1)),
          createElement('td', { className: 'tv-cu-cell' }, String(course.creditUnits)),
          createElement('td', { className: 'tv-qp-cell' }, course.qualityPoints.toFixed(1))
        )
      );
    });

    const tfoot = createElement(
      'tfoot',
      {},
      createElement(
        'tr',
        {},
        createElement('td', { colspan: '5' }, 'Semester Total'),
        createElement('td', {}, String(sem.totalCreditUnits)),
        createElement('td', {}, sem.totalQualityPoints.toFixed(1))
      )
    );

    block.append(
      createElement(
        'div',
        { className: 'tv-table-wrap' },
        createElement('table', { className: 'tv-table' }, thead, tbody, tfoot)
      )
    );

    return block;
  },

  _buildPreviousRecord({ creditUnits, qualityPoints }) {
    const gpa = creditUnits > 0 ? qualityPoints / creditUnits : 0;

    const thead = createElement(
      'thead',
      {},
      createElement(
        'tr',
        {},
        ...['Description', 'Credit Units Earned', 'Quality Points Earned', 'Equivalent GPA'].map(
          (h) => createElement('th', { scope: 'col' }, h)
        )
      )
    );

    const tbody = createElement(
      'tbody',
      {},
      createElement(
        'tr',
        {},
        createElement('td', {}, 'Transfer / Previous Institution'),
        createElement('td', {}, String(creditUnits)),
        createElement('td', {}, qualityPoints.toFixed(1)),
        createElement('td', {}, formatGPA(gpa))
      )
    );

    return createElement(
      'div',
      { className: 'tv-prev-block' },
      createElement(
        'p',
        { className: 'tv-prev-label' },
        '📌 Previous Institutional Record (Transfer / Carry-Over Credits)'
      ),
      createElement(
        'div',
        { className: 'tv-table-wrap' },
        createElement('table', { className: 'tv-table' }, thead, tbody)
      )
    );
  },
};
