import { createElement } from '@/utils/dom.js';
import { formatGPA, formatShortDate } from '@/utils/formatters.js';
import { _gpaRgba, _setCssVars } from './transcriptHelpers.js';

export const transcriptHeaderMethods = {
  _buildDocHeader(student, scale, cgpa, honor, stats) {
    // Identity key-value pairs
    const idFields = [
      student.matricNo ? ['Matric No.', student.matricNo] : null,
      student.dept ? ['Department', student.dept] : null,
      student.level ? ['Level', student.level] : null,
      student.session ? ['Session', student.session] : null,
      ['Scale', scale.label.split(' (')[0]],
      ['Issued', formatShortDate(this._issuedAt)],
    ].filter(Boolean);

    const idGrid = createElement('div', { className: 'tv-identity-grid' });
    idFields.forEach(([k, v]) => {
      idGrid.append(
        createElement('span', { className: 'tv-id-key' }, k),
        createElement('span', { className: 'tv-id-val' }, v)
      );
    });

    // Classification badge (shown in header when data exists)
    const classBadgeEl =
      honor && cgpa > 0
        ? _setCssVars(
            createElement(
              'span',
              { className: 'tv-header-class-badge tv-dynamic-badge' },
              `${honor.badge}  ${honor.label}`
            ),
            {
              '--tv-accent-color': _gpaRgba(cgpa, 0.9),
              '--tv-accent-border': _gpaRgba(cgpa, 0.35),
              '--tv-accent-bg': _gpaRgba(cgpa, 0.08),
            }
          )
        : null;

    // Decorative seal
    const seal = createElement(
      'div',
      { className: 'tv-seal', 'aria-hidden': 'true' },
      createElement('span', { className: 'tv-seal-icon' }, '🎓'),
      createElement('span', { className: 'tv-seal-text' }, 'GPA\nPRO')
    );

    // Right meta column: seal + doc ID + date
    const metaCol = createElement(
      'div',
      { className: 'tv-header-seal-col' },
      seal,
      createElement(
        'div',
        { className: 'tv-doc-meta' },
        createElement('span', { className: 'tv-doc-meta-label' }, 'Document ID'),
        createElement('span', { className: 'tv-doc-id' }, this._docId),
        stats.semesterCount > 0
          ? createElement(
              'span',
              { className: 'tv-doc-meta-label tv-doc-meta-label--spaced' },
              `${stats.semesterCount} Semester${stats.semesterCount !== 1 ? 's' : ''} on Record`
            )
          : null
      )
    );

    const leftCol = createElement(
      'div',
      {},
      createElement('p', { className: 'tv-institution' }, 'GPA Pro — Academic Record'),
      createElement('h1', { className: 'tv-student-name' }, student.name || 'Student Name'),
      idGrid,
      classBadgeEl ? createElement('div', { className: 'tv-class-badge-wrap' }, classBadgeEl) : null
    );

    return createElement(
      'div',
      { className: 'tv-doc-header', 'data-running-header': student.name || 'Academic Transcript' },
      createElement('div', { className: 'tv-header-cols' }, leftCol, metaCol)
    );
  },

  _buildProgStrip(cgpa, stats, scale, semesters) {
    const best = semesters.length > 0 ? Math.max(...semesters.map((s) => s.gpa)) : null;

    const items = [
      { label: 'Cumulative GPA', value: formatGPA(cgpa), highlight: true },
      { label: `/ ${scale.maxGPA.toFixed(2)} Scale`, value: scale.id, mono: true },
      { label: 'Credit Units', value: String(stats.totalCU) },
      { label: 'Courses', value: String(stats.courseCount) },
      { label: 'Semesters', value: String(stats.semesterCount) },
      best !== null ? { label: 'Best Sem. GPA', value: formatGPA(best) } : null,
    ].filter(Boolean);

    const strip = createElement('div', { className: 'tv-prog-strip' });
    items.forEach(({ label, value, highlight, mono }) => {
      const valEl = createElement(
        'span',
        {
          className: `tv-prog-val${highlight ? ' tv-prog-val--cgpa' : ''}${mono ? ' tv-mono-value' : ''}`,
        },
        value
      );
      strip.append(
        createElement(
          'div',
          { className: 'tv-prog-item' },
          createElement('span', { className: 'tv-prog-label' }, label),
          valEl
        )
      );
    });

    return strip;
  },
};
