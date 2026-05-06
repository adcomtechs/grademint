/**
 * @module gpaColors
 * @description Centralised GPA and grade colour utilities.
 *
 * SINGLE SOURCE OF TRUTH:
 * These functions were previously duplicated across WhatIfView, AnalyticsPanel,
 * OverviewPanel, and ChartRenderer. Every component that needs a colour for
 * a GPA value or grade letter imports from here.
 *
 * COLOUR PALETTE (matches the Dark Academic design tokens in main.css):
 *   First Class       ≥ 4.5  → gold   rgba(246,211,101)
 *   Second Upper      ≥ 3.5  → green  rgba(168,230,207)
 *   Second Lower      ≥ 2.4  → blue   rgba(116,185,224)
 *   Third Class       ≥ 1.5  → amber  rgba(246,173,85)
 *   Pass / Fail       < 1.5  → rose   rgba(255,139,148)
 */

/**
 * Returns an rgba colour string for a GPA value, scaled by the given alpha.
 * Colour thresholds match the Nigerian 5.0 honour classification tiers.
 * Safe to call with any GPA value including 0 and values above 5.
 *
 * @param {number} gpa
 * @param {number} [alpha=1]   Opacity between 0 and 1
 * @returns {string}           e.g. 'rgba(246,211,101,0.8)'
 */
export function gpaColor(gpa, alpha = 1) {
  if (gpa >= 4.5) return `rgba(246,211,101,${alpha})`; // gold   — First Class
  if (gpa >= 3.5) return `rgba(168,230,207,${alpha})`; // green  — Second Upper
  if (gpa >= 2.4) return `rgba(116,185,224,${alpha})`; // blue   — Second Lower
  if (gpa >= 1.5) return `rgba(246,173,85, ${alpha})`; // amber  — Third Class
  return `rgba(255,139,148,${alpha})`; // rose   — Pass / Fail
}

/**
 * Returns a hex colour string for a grade letter.
 * Handles both 5.0-scale (A–F) and 4.0-scale (A+, A−, B+, etc.) letters.
 * Falls back to the Fail colour for unrecognised letters.
 *
 * @param {string} letter  e.g. 'A', 'B+', 'C−', 'F'
 * @returns {string}       hex colour string e.g. '#f6d365'
 */
export function gradeLetterColor(letter) {
  if (!letter) return '#ff8b94';
  if (letter === 'A' || letter === 'A+') return '#f6d365'; // gold
  if (letter.startsWith('A')) return '#f6d365'; // A−
  if (letter.startsWith('B')) return '#a8e6cf'; // green
  if (letter.startsWith('C')) return '#74b9e0'; // blue
  if (letter.startsWith('D')) return '#f6ad55'; // amber
  if (letter.startsWith('E')) return '#a0aec0'; // grey
  return '#ff8b94'; // F / unknown
}

/**
 * Returns a difficulty classification for a required GPA relative to
 * the scale maximum.
 *
 * Used by TargetCalculatorPanel to label results as Easy / Moderate /
 * Hard / Very Hard / Impossible.
 *
 * @param {number} requiredGPA  The GPA the student must achieve
 * @param {number} maxGPA       The scale maximum (4.0, 5.0, or 7.0)
 * @returns {{ label: string, cls: string }}
 */
export function gpaDifficulty(requiredGPA, maxGPA) {
  const ratio = requiredGPA / maxGPA;
  if (ratio <= 0.6) return { label: 'Easy', cls: 'wi-difficulty--easy' };
  if (ratio <= 0.75) return { label: 'Moderate', cls: 'wi-difficulty--moderate' };
  if (ratio <= 0.88) return { label: 'Hard', cls: 'wi-difficulty--hard' };
  if (ratio <= 1.0) return { label: 'Very Hard', cls: 'wi-difficulty--very-hard' };
  return { label: 'Impossible', cls: 'wi-difficulty--impossible' };
}
