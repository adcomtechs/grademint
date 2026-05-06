/**
 * @module GPACalculatorService
 * @description Pure calculation service — zero DOM, zero storage, zero side effects.
 *
 * All methods are `static` because GPACalculatorService is a stateless
 * namespace for related pure functions. Instantiating it would be meaningless.
 * The constructor throws to enforce this — same pattern as Java's Math class.
 *
 * PATTERNS DEMONSTRATED:
 * - Static utility class (namespace for pure functions)
 * - Array reduce/flatMap — functional data processing
 * - Optional chaining (?.) and nullish coalescing (??)
 * - Derived computation — never storing what can be calculated
 */

import { DEFAULT_SCALE_ID } from '../utils/constants.js';
import { getScale, honorFromGPA } from '../utils/helpers.js';

export class GPACalculatorService {
  constructor() {
    throw new Error('GPACalculatorService is a static utility class.');
  }

  // ── Core GPA ──────────────────────────────────────────────────────────────

  /**
   * Semester GPA = Σ(qualityPoints) / Σ(creditUnits).
   * @param {{ creditUnits: number, qualityPoints: number }[]} courses
   * @returns {number}
   */
  static semesterGPA(courses) {
    const totalCU = courses.reduce((s, c) => s + c.creditUnits, 0);
    return totalCU === 0 ? 0 : courses.reduce((s, c) => s + c.qualityPoints, 0) / totalCU;
  }

  /**
   * Cumulative GPA across all semesters in the current session.
   * @param {Semester[]} semesters
   * @returns {number}
   */
  static cumulativeGPA(semesters) {
    const totalCU = semesters.reduce((s, sem) => s + sem.totalCreditUnits, 0);
    return totalCU === 0
      ? 0
      : semesters.reduce((s, sem) => s + sem.totalQualityPoints, 0) / totalCU;
  }

  /**
   * CGPA inclusive of a previous institutional record (transfer credits).
   * @param {Semester[]} semesters
   * @param {{ creditUnits?: number, qualityPoints?: number }|null} previousRecord
   * @returns {number}
   */
  static cgpaWithPreviousRecord(semesters, previousRecord = null) {
    const allCourses = semesters.flatMap((s) => s.courses);
    const prevCU = previousRecord?.creditUnits ?? 0;
    const prevQP = previousRecord?.qualityPoints ?? 0;
    const totalCU = allCourses.reduce((s, c) => s + c.creditUnits, 0) + prevCU;
    const totalQP = allCourses.reduce((s, c) => s + c.qualityPoints, 0) + prevQP;
    return totalCU > 0 ? totalQP / totalCU : 0;
  }

  // ── Honor Classification ──────────────────────────────────────────────────

  /**
   * Returns the honor classification for a GPA value on the given scale.
   * Delegates to the pure helper in constants.js.
   *
   * @param {number} cgpa
   * @param {string} [scaleId]  Pass student.scaleId from the store
   * @returns {{ label: string, cssClass: string, badge: string } | null}
   */
  static getHonorClassification(cgpa, scaleId = DEFAULT_SCALE_ID) {
    return honorFromGPA(cgpa, scaleId);
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  /**
   * Aggregate quick-stats used by the hero zone.
   * @param {Semester[]} semesters
   */
  static aggregateStats(semesters) {
    const allCourses = semesters.flatMap((s) => s.courses);
    return {
      semesterCount: semesters.length,
      totalCU: allCourses.reduce((s, c) => s + c.creditUnits, 0),
      courseCount: allCourses.length,
    };
  }

  /**
   * Builds a semester-by-semester trend array with running CGPA.
   * Skips semesters with no courses so they don't flatten the chart.
   * @param {Semester[]} semesters
   * @returns {{ label: string, gpa: number, cgpa: number, totalCU: number }[]}
   */
  static buildTrend(semesters) {
    let runCU = 0,
      runQP = 0;
    return semesters
      .filter((sem) => sem.courses.length > 0)
      .map((sem) => {
        runCU += sem.totalCreditUnits;
        runQP += sem.totalQualityPoints;
        return {
          label: sem.label,
          gpa: sem.gpa,
          cgpa: runCU > 0 ? runQP / runCU : 0,
          totalCU: runCU,
        };
      });
  }

  /**
   * Grade distribution frequency count.
   * @param {import('../models/Course.js').Course[]} courses
   * @returns {Record<string, number>}
   */
  static gradeDistribution(courses) {
    return courses.reduce((acc, c) => {
      const g = c.grade ?? 'F';
      acc[g] = (acc[g] ?? 0) + 1;
      return acc;
    }, {});
  }

  /**
   * 'up' | 'down' | 'stable' | 'neutral' based on last two semester GPAs.
   * @param {Semester[]} semesters
   * @returns {'up'|'down'|'stable'|'neutral'}
   */
  static trendDirection(semesters) {
    const active = semesters.filter((s) => s.courses.length > 0);
    if (active.length < 2) return 'neutral';
    const delta = active.at(-1).gpa - active.at(-2).gpa;
    if (Math.abs(delta) < 0.05) return 'stable';
    return delta > 0 ? 'up' : 'down';
  }

  // ── Premium: What-If Calculator ───────────────────────────────────────────

  /**
   * GPA required over `plannedCU` future units to reach `targetCGPA`.
   * @param {{ currentCGPA: number, currentCU: number, targetCGPA: number, plannedCU: number, scaleId?: string }} p
   */
  static requiredGPAForTarget({
    currentCGPA,
    currentCU,
    targetCGPA,
    plannedCU,
    scaleId = DEFAULT_SCALE_ID,
  }) {
    const scale = getScale(scaleId);
    const max = scale.maxGPA;

    if (plannedCU <= 0)
      return {
        requiredGPA: 0,
        achievable: false,
        message: 'Enter at least 1 planned credit unit.',
      };

    if (targetCGPA > max || targetCGPA < 0)
      return {
        requiredGPA: 0,
        achievable: false,
        message: `Target CGPA must be between 0.00 and ${max.toFixed(2)}.`,
      };

    if (currentCGPA >= targetCGPA) {
      return {
        requiredGPA: 0,
        achievable: true,
        message: `You've already met or exceeded your target CGPA.`,
      };
    }

    const currentQP = currentCGPA * currentCU;
    const requiredQP = targetCGPA * (currentCU + plannedCU) - currentQP;
    const requiredGPA = requiredQP / plannedCU;

    // if (requiredGPA < 0)
    //   return {
    //     requiredGPA: 0,
    //     achievable: true,
    //     message: `You've already surpassed your target! Keep going.`,
    //   };

    if (requiredGPA > max)
      return {
        requiredGPA,
        achievable: false,
        message: `Not achievable — would need ${requiredGPA.toFixed(2)}/${max.toFixed(2)}, which exceeds the maximum.`,
      };

    return {
      requiredGPA,
      achievable: true,
      message: `Maintain a GPA of ${requiredGPA.toFixed(2)} across the next ${plannedCU} credit unit(s).`,
    };
  }

  // ── Premium: Programme-level CGPA ─────────────────────────────────────────

  /**
   * @param {{ level: string, semesters: Semester[] }[]} levels
   * @returns {{ levelGPAs: Record<string, number>, programmeCGPA: number }}
   */
  static programmeCGPA(levels) {
    let totalCU = 0,
      totalQP = 0;
    const levelGPAs = {};
    for (const { level, semesters } of levels) {
      const lCU = semesters.reduce((s, sem) => s + sem.totalCreditUnits, 0);
      const lQP = semesters.reduce((s, sem) => s + sem.totalQualityPoints, 0);
      levelGPAs[level] = lCU === 0 ? 0 : lQP / lCU;
      totalCU += lCU;
      totalQP += lQP;
    }
    return { levelGPAs, programmeCGPA: totalCU === 0 ? 0 : totalQP / totalCU };
  }

  /**
   * Computes a projected CGPA by appending hypothetical future semesters
   * to an existing record.
   *
   * @param {number} baseCGPA            The student's current CGPA
   * @param {number} baseCU              Total credit units earned so far
   * @param {{ gpa: number, cu: number }[]} scenarios  Hypothetical semesters
   * @returns {number}  Projected CGPA after all scenarios
   */
  static computeProjectedCGPA(baseCGPA, baseCU, scenarios) {
    if (!scenarios.length) return baseCGPA;
    let totalCU = baseCU;
    let totalQP = baseCGPA * baseCU;
    for (const s of scenarios) {
      totalQP += s.gpa * s.cu;
      totalCU += s.cu;
    }
    return totalCU > 0 ? totalQP / totalCU : 0;
  }

  /**
   * Builds the CGPA trajectory array for a projection chart.
   * Real semesters come first (isHypo: false), then hypothetical (isHypo: true).
   *
   * @param {import('../domain/Semester.js').Semester[]} realSemesters
   * @param {{ id: number, label: string, gpa: number, cu: number }[]} scenarios
   * @param {number} baseCGPA   Fallback when realSemesters have no courses
   * @param {number} baseCU     Fallback credit units
   * @returns {{ label: string, cgpa: number, isHypo: boolean }[]}
   */
  static buildProjectionPoints(realSemesters, scenarios, baseCGPA, baseCU) {
    const points = [];
    let runCU = 0;
    let runQP = 0;

    // Real semesters
    for (const sem of realSemesters) {
      if (!sem.courses.length) continue;
      runCU += sem.totalCreditUnits;
      runQP += sem.totalQualityPoints;
      points.push({
        label: sem.label,
        cgpa: runCU > 0 ? runQP / runCU : 0,
        isHypo: false,
      });
    }

    // Baseline when no real semesters produced data points
    if (!points.length) {
      points.push({ label: 'Current', cgpa: baseCGPA, isHypo: false });
      runCU = baseCU;
      runQP = baseCGPA * baseCU;
    }

    // Hypothetical semesters
    for (const sc of scenarios) {
      runCU += sc.cu;
      runQP += sc.gpa * sc.cu;
      points.push({
        label: sc.label,
        cgpa: runCU > 0 ? runQP / runCU : 0,
        isHypo: true,
      });
    }

    return points;
  }
}
