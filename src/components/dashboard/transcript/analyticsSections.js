import { createElement } from '@/utils/dom.js';
import { formatGPA } from '@/utils/formatters.js';
import { _gpaRgba, _gradeBarColor, _setCssVars } from './transcriptHelpers.js';

export const transcriptAnalyticsMethods = {
  _buildGPATimeline(trend, scale) {
    const W = 800;
    const H = 110;
    const PAD = { top: 12, right: 24, bottom: 36, left: 36 };
    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top - PAD.bottom;
    const maxG = scale.maxGPA;
    const n = trend.length;
    const step = n < 2 ? cW : cW / (n - 1);
    const xOf = (i) => PAD.left + i * step;
    const yOf = (v) => PAD.top + cH * (1 - Math.min(v, maxG) / maxG);

    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'tv-timeline-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'GPA progression chart');

    // Helper: create SVG element
    const el = (tag, attrs) => {
      const e = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
      return e;
    };

    // Grid lines
    [1, 2, 3, 4, 5]
      .filter((g) => g <= maxG)
      .forEach((g) => {
        const y = yOf(g);
        svg.append(
          el('line', {
            x1: PAD.left,
            y1: y,
            x2: PAD.left + cW,
            y2: y,
            stroke: 'rgba(255,255,255,0.06)',
            'stroke-width': '1',
          })
        );
        const txt = document.createElementNS(NS, 'text');
        txt.setAttribute('x', PAD.left - 5);
        txt.setAttribute('y', y + 3);
        txt.setAttribute('text-anchor', 'end');
        txt.setAttribute('font-family', 'DM Mono, monospace');
        txt.setAttribute('font-size', '8');
        txt.setAttribute('fill', 'rgba(232,226,213,0.28)');
        txt.textContent = g.toFixed(1);
        svg.append(txt);
      });

    // CGPA area fill
    const areaPoints = [
      `${xOf(0)},${yOf(trend[0].cgpa)}`,
      ...trend.map((d, i) => `${xOf(i)},${yOf(d.cgpa)}`),
      `${xOf(n - 1)},${PAD.top + cH}`,
      `${xOf(0)},${PAD.top + cH}`,
    ].join(' ');

    const fillId = `tv-cgpa-fill-${this._docId}`;
    const defs = el('defs', {});
    const grad = el('linearGradient', { id: fillId, x1: '0', y1: '0', x2: '0', y2: '1' });
    const s1 = el('stop', { offset: '0%', 'stop-color': 'rgba(168,230,207,0.22)' });
    const s2 = el('stop', { offset: '100%', 'stop-color': 'rgba(168,230,207,0)' });
    grad.append(s1, s2);
    defs.append(grad);
    svg.append(defs);

    svg.append(
      el('polygon', {
        points: areaPoints,
        fill: `url(#${fillId})`,
      })
    );

    // GPA area fill (lighter)
    const gpaPoints = [
      `${xOf(0)},${yOf(trend[0].gpa)}`,
      ...trend.map((d, i) => `${xOf(i)},${yOf(d.gpa)}`),
      `${xOf(n - 1)},${PAD.top + cH}`,
      `${xOf(0)},${PAD.top + cH}`,
    ].join(' ');
    svg.append(
      el('polygon', {
        points: gpaPoints,
        fill: 'rgba(246,211,101,0.07)',
      })
    );

    // Lines — helper: polyline from points array
    const polyline = (pts, stroke, dash = '') => {
      const pLine = el('polyline', {
        points: pts,
        fill: 'none',
        stroke,
        'stroke-width': '1.8',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        ...(dash ? { 'stroke-dasharray': dash } : {}),
      });
      svg.append(pLine);
    };

    polyline(trend.map((d, i) => `${xOf(i)},${yOf(d.cgpa)}`).join(' '), 'rgba(168,230,207,0.85)');
    polyline(
      trend.map((d, i) => `${xOf(i)},${yOf(d.gpa)}`).join(' '),
      'rgba(246,211,101,0.8)',
      '5,3'
    );

    // Dots + X labels
    trend.forEach((d, i) => {
      // CGPA dot
      svg.append(
        el('circle', {
          cx: xOf(i),
          cy: yOf(d.cgpa),
          r: '3.5',
          fill: _gpaRgba(d.cgpa, 0.9),
          stroke: 'rgba(12,15,26,0.9)',
          'stroke-width': '1.5',
        })
      );
      // GPA dot
      svg.append(
        el('circle', {
          cx: xOf(i),
          cy: yOf(d.gpa),
          r: '3',
          fill: _gpaRgba(d.gpa, 0.85),
          stroke: 'rgba(12,15,26,0.7)',
          'stroke-width': '1',
        })
      );
      // X label (rotated)
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('transform', `translate(${xOf(i)},${PAD.top + cH + 12}) rotate(-22)`);
      const xt = document.createElementNS(NS, 'text');
      xt.setAttribute('text-anchor', 'end');
      xt.setAttribute('font-family', 'DM Mono, monospace');
      xt.setAttribute('font-size', '7.5');
      xt.setAttribute('fill', 'rgba(232,226,213,0.4)');
      xt.textContent = d.label.length > 14 ? d.label.slice(0, 13) + '…' : d.label;
      g.append(xt);
      svg.append(g);
    });

    // Legend
    const legendY = PAD.top + 6;
    [
      ['rgba(246,211,101,0.85)', 'Sem. GPA', '4,3'],
      ['rgba(168,230,207,0.85)', 'Running CGPA', ''],
    ].forEach(([c, t, dash], idx) => {
      const lx = PAD.left + idx * 100;
      svg.append(
        el('line', {
          x1: lx,
          y1: legendY,
          x2: lx + 18,
          y2: legendY,
          stroke: c,
          'stroke-width': '2',
          ...(dash ? { 'stroke-dasharray': dash } : {}),
        })
      );
      const lt = document.createElementNS(NS, 'text');
      lt.setAttribute('x', lx + 22);
      lt.setAttribute('y', legendY + 3);
      lt.setAttribute('font-family', 'DM Mono, monospace');
      lt.setAttribute('font-size', '8');
      lt.setAttribute('fill', 'rgba(232,226,213,0.55)');
      lt.textContent = t;
      svg.append(lt);
    });

    return createElement(
      'div',
      { className: 'tv-timeline-section' },
      createElement('p', { className: 'tv-section-title' }, 'GPA Progression'),
      createElement('div', { className: 'tv-timeline-svg-wrap' }, svg)
    );
  },

  _buildGradeDistribution(dist, scale, totalCourses) {
    const gradeOrder = scale.grades.map((g) => g.letter);
    const maxCount = Math.max(...Object.values(dist), 1);

    const grid = createElement('div', { className: 'tv-dist-grid' });

    gradeOrder.forEach((letter) => {
      const count = dist[letter] ?? 0;
      if (!count) return;
      const pct = ((count / totalCourses) * 100).toFixed(0);
      const barH = Math.max(4, Math.round((count / maxCount) * 54));
      const color = _gradeBarColor(letter);

      const fill = _setCssVars(createElement('div', { className: 'tv-dist-bar-fill' }), {
        '--tv-bar-height': `${barH}px`,
        '--tv-bar-color': color,
      });
      const track = createElement('div', { className: 'tv-dist-bar-track' }, fill);

      grid.append(
        createElement(
          'div',
          { className: 'tv-dist-cell' },
          track,
          createElement(
            'div',
            { className: 'tv-dist-label' },
            _setCssVars(createElement('span', { className: 'tv-dist-letter' }, letter), {
              '--tv-grade-color': color,
            }),
            createElement('span', { className: 'tv-dist-count' }, `×${count}`)
          ),
          createElement('span', { className: 'tv-dist-pct' }, `${pct}%`)
        )
      );
    });

    return createElement(
      'div',
      { className: 'tv-dist-section' },
      createElement(
        'p',
        { className: 'tv-section-title' },
        `Grade Distribution — ${totalCourses} course${totalCourses !== 1 ? 's' : ''}`
      ),
      grid
    );
  },

  _buildSummaryBar(cgpa, stats, honor, scale) {
    const items = [
      {
        label: 'Cumulative GPA',
        value: formatGPA(cgpa),
        valClass: 'tv-summary-val tv-summary-val--cgpa',
      },
      {
        label: `/ ${scale.maxGPA.toFixed(2)}`,
        value: scale.id,
        valClass: 'tv-summary-val',
        mono: true,
      },
      { label: 'Total Credit Units', value: String(stats.totalCU), valClass: 'tv-summary-val' },
      { label: 'Total Courses', value: String(stats.courseCount), valClass: 'tv-summary-val' },
      { label: 'Semesters', value: String(stats.semesterCount), valClass: 'tv-summary-val' },
      honor
        ? {
            label: 'Classification',
            value: null,
            valClass: '',
            honorEl: createElement(
              'span',
              { className: `tv-summary-val tv-summary-val--honor ${honor.cssClass}` },
              `${honor.badge} `,
              honor.label
            ),
          }
        : null,
    ].filter(Boolean);

    const bar = createElement('div', { className: 'tv-summary-bar' });
    items.forEach(({ label, value, valClass, honorEl, mono }) => {
      const valEl =
        honorEl ??
        createElement(
          'span',
          {
            className: `${valClass}${mono ? ' tv-mono-value' : ''}`,
          },
          value
        );
      bar.append(
        createElement(
          'div',
          { className: 'tv-summary-item' },
          createElement('span', { className: 'tv-summary-label' }, label),
          valEl
        )
      );
    });

    return bar;
  },
};
