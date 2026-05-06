/**
 * @module analytics/buildKPIs
 * @description Renders the KPI summary strip for AnalyticsPanel.
 */

import { createElement } from '../../../utils/dom.js';
import { formatGPA } from '../../../utils/formatters.js';

/**
 * @param {number}      cgpa
 * @param {object|null} honor   - honor classification or null
 * @param {object}      stats   - { semesterCount, totalCU, courseCount }
 * @param {string}      trend   - 'up' | 'down' | 'stable' | 'neutral'
 * @param {object}      scale   - grading scale object
 * @returns {HTMLElement}
 */
export function buildKPIs(cgpa, honor, stats, trend, scale) {
  const TREND_MAP = {
    up: { icon: '↑', label: 'Improving', cls: 'ap-trend-up' },
    down: { icon: '↓', label: 'Declining', cls: 'ap-trend-down' },
    stable: { icon: '→', label: 'Steady', cls: 'ap-trend-flat' },
    neutral: { icon: '—', label: '—', cls: 'ap-trend-flat' },
  };
  const tm = TREND_MAP[trend] ?? TREND_MAP.neutral;

  const kpis = [
    {
      variant: 'gold',
      icon: '◎',
      value: formatGPA(cgpa),
      label: 'CGPA',
      sub: `/ ${scale.maxGPA.toFixed(2)} scale`,
      extra: honor
        ? createElement(
            'span',
            { className: `ap-kpi-honor ${honor.cssClass}` },
            `${honor.badge} ${honor.label}`
          )
        : null,
    },
    {
      variant: 'blue',
      icon: '◑',
      value: String(stats.semesterCount),
      label: 'Semesters',
      sub: 'recorded',
    },
    {
      variant: 'green',
      icon: '◷',
      value: String(stats.totalCU),
      label: 'Credit Units',
      sub: 'accumulated',
    },
    {
      variant: 'purple',
      icon: '◻',
      value: String(stats.courseCount),
      label: 'Courses',
      sub: `avg ${
        stats.semesterCount ? (stats.courseCount / stats.semesterCount).toFixed(1) : '—'
      } / sem`,
    },
    {
      variant: 'teal',
      icon: tm.icon,
      value: tm.label,
      label: 'Trend',
      sub: 'based on last 2 sems',
      valueCls: tm.cls,
    },
  ];

  const strip = createElement('div', { className: 'ap-kpi-strip' });

  kpis.forEach(({ variant, icon, value, label, sub, extra, valueCls }) => {
    const card = createElement(
      'div',
      { className: `ap-kpi ap-kpi--${variant}` },
      createElement('span', { className: 'ap-kpi-icon' }, icon),
      createElement('span', { className: `ap-kpi-val ${valueCls ?? ''}` }, value),
      createElement('span', { className: 'ap-kpi-label' }, label),
      createElement('span', { className: 'ap-kpi-sub' }, sub)
    );
    if (extra) card.append(extra);
    strip.append(card);
  });

  return strip;
}
