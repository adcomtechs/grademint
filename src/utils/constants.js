/**
 * @module constants
 * @description Centralised, immutable application configuration.
 *
 * KEY DESIGN DECISIONS:
 *
 * 1. Object.freeze() at every level — prevents runtime mutation of configuration.
 *    Shallow freeze (Object.freeze) only protects the top-level object; we also
 *    freeze nested arrays and objects so nothing can be accidentally pushed or
 *    reassigned from component code.
 *
 * 2. GRADE_SCALES replaces the old flat GRADE_SCALE — it is a registry (Record)
 *    keyed by scale ID. This makes the app multi-scale without changing any
 *    calculation logic (GPACalculatorService and helpers just accept a scaleId).
 *
 * 3. Backward-compatible re-exports — HONOR_ROLL and GRADE_SCALE are kept as
 *    deprecated named exports so existing code that imports them still works
 *    during the migration period.
 *
 * 4. JSDoc @typedef blocks define the TypeScript-like types used throughout
 *    the app. Since this is vanilla JS, these are documentation only — but they
 *    enable IntelliSense in VS Code and serve as the canonical shape contract.
 */

// ── Type Definitions (JSDoc only — no runtime cost) ─────────────────────────

/**
 * A single row in a grading scale.
 * @typedef {{
 *   letter: string, points: number,
 *   minScore: number, maxScore: number, cssClass: string
 * }} GradeEntry
 */

/**
 * One honor classification tier within a grading scale.
 * @typedef {{ label: string, min: number, cssClass: string, badge: string }} HonorEntry
 */

/**
 * A complete grading scale — grades + honor tiers.
 * @typedef {{ id: string, label: string, maxGPA: number, grades: GradeEntry[], honors: HonorEntry[] }} GradeScale
 */

// ── Grade Scale Registry ─────────────────────────────────────────────────────

/**
 * All supported grading scales, keyed by their ID string.
 * Adding a new scale here makes it available everywhere with no other changes.
 * @type {Readonly<Record<string, GradeScale>>}
 */
export const GRADE_SCALES = Object.freeze({
  '5.0': Object.freeze({
    id: '5.0',
    label: '5.0 Scale (Nigerian / West African)',
    maxGPA: 5.0,
    grades: Object.freeze([
      { letter: 'A', points: 5.0, minScore: 70, maxScore: 100, cssClass: 'grade-badge--A' },
      { letter: 'B', points: 4.0, minScore: 60, maxScore: 69, cssClass: 'grade-badge--B' },
      { letter: 'C', points: 3.0, minScore: 50, maxScore: 59, cssClass: 'grade-badge--C' },
      { letter: 'D', points: 2.0, minScore: 45, maxScore: 49, cssClass: 'grade-badge--D' },
      { letter: 'E', points: 1.0, minScore: 40, maxScore: 44, cssClass: 'grade-badge--E' },
      { letter: 'F', points: 0.0, minScore: 0, maxScore: 39, cssClass: 'grade-badge--F' },
    ]),
    honors: Object.freeze([
      { label: 'First Class', min: 4.5, cssClass: 'grade--first', badge: '◈' },
      { label: 'Second Class Upper', min: 3.5, cssClass: 'grade--second-upper', badge: '◇' },
      { label: 'Second Class Lower', min: 2.4, cssClass: 'grade--second-lower', badge: '◆' },
      { label: 'Third Class', min: 1.5, cssClass: 'grade--third', badge: '○' },
      { label: 'Pass', min: 1.0, cssClass: 'grade--pass', badge: '·' },
      { label: 'Fail', min: 0.0, cssClass: 'grade--fail', badge: '✕' },
    ]),
  }),

  '4.0': Object.freeze({
    id: '4.0',
    label: '4.0 Scale (US / International)',
    maxGPA: 4.0,
    grades: Object.freeze([
      { letter: 'A+', points: 4.0, minScore: 97, maxScore: 100, cssClass: 'grade-badge--A' },
      { letter: 'A', points: 4.0, minScore: 93, maxScore: 96, cssClass: 'grade-badge--A' },
      { letter: 'A−', points: 3.7, minScore: 90, maxScore: 92, cssClass: 'grade-badge--A' },
      { letter: 'B+', points: 3.3, minScore: 87, maxScore: 89, cssClass: 'grade-badge--B' },
      { letter: 'B', points: 3.0, minScore: 83, maxScore: 86, cssClass: 'grade-badge--B' },
      { letter: 'B−', points: 2.7, minScore: 80, maxScore: 82, cssClass: 'grade-badge--B' },
      { letter: 'C+', points: 2.3, minScore: 77, maxScore: 79, cssClass: 'grade-badge--C' },
      { letter: 'C', points: 2.0, minScore: 73, maxScore: 76, cssClass: 'grade-badge--C' },
      { letter: 'C−', points: 1.7, minScore: 70, maxScore: 72, cssClass: 'grade-badge--C' },
      { letter: 'D+', points: 1.3, minScore: 67, maxScore: 69, cssClass: 'grade-badge--D' },
      { letter: 'D', points: 1.0, minScore: 63, maxScore: 66, cssClass: 'grade-badge--D' },
      { letter: 'D−', points: 0.7, minScore: 60, maxScore: 62, cssClass: 'grade-badge--D' },
      { letter: 'F', points: 0.0, minScore: 0, maxScore: 59, cssClass: 'grade-badge--F' },
    ]),
    honors: Object.freeze([
      { label: 'Summa Cum Laude', min: 3.9, cssClass: 'grade--first', badge: '◈' },
      { label: 'Magna Cum Laude', min: 3.7, cssClass: 'grade--second-upper', badge: '◇' },
      { label: 'Cum Laude', min: 3.5, cssClass: 'grade--second-lower', badge: '◆' },
      { label: 'Good Standing', min: 2.0, cssClass: 'grade--third', badge: '○' },
      { label: 'Pass', min: 1.0, cssClass: 'grade--pass', badge: '·' },
      { label: 'Fail', min: 0.0, cssClass: 'grade--fail', badge: '✕' },
    ]),
  }),

  '7.0': Object.freeze({
    id: '7.0',
    label: '7.0 Scale (Some African Universities)',
    maxGPA: 7.0,
    grades: Object.freeze([
      { letter: 'A+', points: 7.0, minScore: 90, maxScore: 100, cssClass: 'grade-badge--A' },
      { letter: 'A', points: 6.0, minScore: 75, maxScore: 89, cssClass: 'grade-badge--A' },
      { letter: 'B', points: 5.0, minScore: 65, maxScore: 74, cssClass: 'grade-badge--B' },
      { letter: 'C', points: 4.0, minScore: 55, maxScore: 64, cssClass: 'grade-badge--C' },
      { letter: 'D', points: 3.0, minScore: 45, maxScore: 54, cssClass: 'grade-badge--D' },
      { letter: 'E', points: 2.0, minScore: 40, maxScore: 44, cssClass: 'grade-badge--E' },
      { letter: 'F', points: 0.0, minScore: 0, maxScore: 39, cssClass: 'grade-badge--F' },
    ]),
    honors: Object.freeze([
      { label: 'First Class', min: 6.0, cssClass: 'grade--first', badge: '◈' },
      { label: 'Second Class Upper', min: 5.0, cssClass: 'grade--second-upper', badge: '◇' },
      { label: 'Second Class Lower', min: 4.0, cssClass: 'grade--second-lower', badge: '◆' },
      { label: 'Third Class', min: 3.0, cssClass: 'grade--third', badge: '○' },
      { label: 'Pass', min: 2.0, cssClass: 'grade--pass', badge: '·' },
      { label: 'Fail', min: 0.0, cssClass: 'grade--fail', badge: '✕' },
    ]),
  }),
});

// ── Sentinel Values ──────────────────────────────────────────────────────────

/**
 * Sentinel used as `activeSemesterId` in the store when the user has selected
 * the "Overview / All Semesters" tab. This causes GPARings to display aggregate
 * stats (total CU, total courses, CGPA) rather than single-semester stats.
 *
 * WHY a string sentinel instead of null?
 * null already means "nothing selected yet / page just loaded". Having a
 * distinct value for "user explicitly chose the overview" lets us:
 *   - Persist the tab selection across reloads via localStorage
 *   - Differentiate between "no data yet" and "user is looking at the overview"
 *   - Handle it cleanly in a switch without checking multiple conditions
 *
 * The value '__ALL__' uses double-underscores (a common convention for
 * internal/meta identifiers) and can never collide with crypto.randomUUID().
 */
export const ALL_SEMESTERS_ID = '__ALL__';

/** The scale used when no explicit scaleId is provided. */
export const DEFAULT_SCALE_ID = '5.0';

/**
 * How a course grade was entered.
 * 'score' → raw percentage, grade computed automatically.
 * 'grade' → student picks the letter directly (no score stored).
 * 'both'  → both entered; gradeKey takes precedence for GPA.
 */
export const INPUT_MODES = Object.freeze({ SCORE: 'score', GRADE: 'grade', BOTH: 'both' });

export const CREDIT_UNITS = Object.freeze([1, 2, 3, 4, 5, 6]);

export const DB_CONFIG = Object.freeze({
  name: 'gpa_pro_db',
  version: 1,
  stores: Object.freeze({ SEMESTERS: 'semesters', SETTINGS: 'settings' }),
});

export const UI_KEYS = Object.freeze({
  ACTIVE_SEMESTER_ID: 'ui_active_sem',
  SCROLL_POSITION: 'ui_scroll_y',
});

export const EVENTS = Object.freeze({
  STATE_CHANGED: 'state:changed',
  SEMESTER_ADDED: 'semester:added',
  SEMESTER_DELETED: 'semester:deleted',
  COURSE_ADDED: 'course:added',
  COURSE_DELETED: 'course:deleted',
  COURSE_UPDATED: 'course:updated',
});

export const APP_NAME = 'GPA Pro';
export const APP_VERSION = '2.0.0';
export const MAX_SCORE = 100;
export const MIN_SCORE = 0;

/** Ring geometry — must match the SVG r values in index.html */
export const RING = Object.freeze({
  CGPA_CIRCUMFERENCE: 527.8, // 2π × 84
  SEM_CIRCUMFERENCE: 263.9, // 2π × 42
  MAX_GPA: 5,
});
