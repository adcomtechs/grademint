/**
 * @module OverviewMode
 * @description Renders the hero zone in Overview mode (activeSemesterId = ALL or null).
 *
 * OVERVIEW MODE:
 *   – CGPA ring   → full programme CGPA (rendered by GPARings before dispatch)
 *   – Sem ring    → mirrors programme CGPA, labelled "Programme GPA"
 *   – Stats       → programme totals (all semesters, all CU, all courses)
 *   – Sparkline   → mini bar chart of every semester's GPA
 *   – GPA delta   → hidden
 *   – Scope       → "∑ All Semesters"
 */

import { GPACalculatorService } from '@/services/GPACalculatorService.js';
import { formatGPA } from '@/utils/formatters.js';
import { animateRing, setText, setHidden } from './RingAnimator.js';
import { renderSparkline } from './SparklineRenderer.js';
import { RING } from '@/utils/constants.js';

/**
 * @param {Semester[]}  semesters
 * @param {number}      cgpa       programme CGPA
 * @param {number}      maxGPA
 * @param {GradeScale}  scale
 */
export function renderOverviewMode(semesters, cgpa, maxGPA, scale) {
  const stats = GPACalculatorService.aggregateStats(semesters);

  // Semester ring mirrors CGPA — labelled "Programme GPA" in overview
  animateRing('ring-fill-sem', cgpa, maxGPA, RING.SEM_CIRCUMFERENCE);
  setText('sem-value', formatGPA(cgpa));
  setText('sem-denom', `/ ${maxGPA.toFixed(2)}`);
  setText('sem-ring-label', 'Programme GPA');
  setText(
    'sem-ring-name',
    semesters.length > 0 ? `${semesters.length} semester${semesters.length !== 1 ? 's' : ''}` : '—'
  );

  // Stats → programme totals
  setText('stat-sems', String(stats.semesterCount));
  setText('stat-cu', String(stats.totalCU));
  setText('stat-courses', String(stats.courseCount));
  setText('stat-sems-label', 'Semesters');
  setText('stat-cu-label', 'Total CU');
  setText('stat-courses-label', 'Total Courses');

  // GPA delta hidden in overview
  setHidden('hero-delta', true);

  // Sparkline — only when there are ≥2 semesters worth charting
  if (semesters.length >= 2) {
    renderSparkline(semesters, null, maxGPA, scale);
    setHidden('hero-sparkline-row', false);
  } else {
    setHidden('hero-sparkline-row', true);
  }
}
