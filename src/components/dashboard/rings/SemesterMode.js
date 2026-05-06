/**
 * @module SemesterMode
 * @description Renders the hero zone in Semester mode (a real UUID is active).
 *
 * SEMESTER MODE:
 *   – CGPA ring    → programme CGPA (rendered by GPARings before dispatch — constant)
 *   – Sem ring     → THIS semester's GPA only
 *   – Stats        → this semester: position (Sem X of N), CU, courses
 *   – GPA delta    → ▲/▼/→ vs the previous semester
 *   – Sparkline    → hidden
 *   – Scope        → "❑ This Semester"
 *
 * WHY keep the CGPA ring constant in semester mode?
 *   Students need a permanent reference point. Seeing "Sem GPA 4.50 /
 *   CGPA 3.20" tells a richer story than either number alone. Hiding the
 *   cumulative picture while browsing one semester reduces clarity.
 */

import { formatGPA } from '@/utils/formatters.js';
import { animateRing, setText, setHidden } from './RingAnimator.js';
import { RING } from '@/utils/constants.js';

/**
 * @param {Semester[]}    semesters   all semesters (for position label)
 * @param {Semester}      activeSem   the selected semester
 * @param {Semester|null} prevSem     the semester before activeSem (may be null)
 * @param {number}        maxGPA
 */
export function renderSemesterMode(semesters, activeSem, prevSem, maxGPA) {
  if (!activeSem) return;

  const position = semesters.indexOf(activeSem) + 1; // 1-based

  // Semester ring → this semester only
  animateRing('ring-fill-sem', activeSem.gpa, maxGPA, RING.SEM_CIRCUMFERENCE);
  setText('sem-value', formatGPA(activeSem.gpa));
  setText('sem-denom', `/ ${maxGPA.toFixed(2)}`);
  setText('sem-ring-label', 'Semester GPA');
  setText('sem-ring-name', activeSem.label);

  // Stats → this semester: position, CU, courses
  setText('stat-sems', `${position} of ${semesters.length}`);
  setText('stat-cu', String(activeSem.totalCreditUnits));
  setText('stat-courses', String(activeSem.courseCount));
  setText('stat-sems-label', 'Semester');
  setText('stat-cu-label', 'Sem. CU');
  setText('stat-courses-label', 'Sem. Courses');

  // Sparkline hidden in semester mode
  setHidden('hero-sparkline-row', true);

  // GPA delta
  _renderGPADelta(activeSem, prevSem);
}

// ── GPA Delta ──────────────────────────────────────────────────────────────────

/**
 * Renders the ▲/▼/→ delta badge.
 *
 * Threshold: ±0.05 is "stable" — differences smaller than that are within
 * rounding and don't represent meaningful academic change.
 *
 * @param {Semester}      activeSem
 * @param {Semester|null} prevSem
 */
function _renderGPADelta(activeSem, prevSem) {
  const el = document.getElementById('hero-delta');
  if (!el) return;

  if (!prevSem || prevSem.courseCount === 0) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }

  const delta = activeSem.gpa - prevSem.gpa;
  const abs = Math.abs(delta);

  let icon, cls, label;

  if (abs < 0.05) {
    icon = '→';
    cls = 'hero-delta--stable';
    label = `Steady vs ${prevSem.label}`;
  } else if (delta > 0) {
    icon = '▲';
    cls = 'hero-delta--up';
    label = `+${abs.toFixed(2)} vs ${prevSem.label}`;
  } else {
    icon = '▼';
    cls = 'hero-delta--down';
    label = `−${abs.toFixed(2)} vs ${prevSem.label}`;
  }

  el.className = `hero-delta ${cls}`;
  el.setAttribute('aria-label', `GPA change: ${label}`);
  el.innerHTML = `
    <span class="hero-delta-icon" aria-hidden="true">${icon}</span>
    <span class="hero-delta-text">${label}</span>
  `;
  el.hidden = false;
}
