/**
 * @module reducer
 * @description Pure reducer: (state, action) → newState.
 *
 * Rules of a pure reducer:
 * 1. Never mutate the state argument — always return a NEW object.
 * 2. No side effects (no DOM, no IDB, no setTimeout).
 * 3. Same state + same action → always the same result.
 *
 * IndexedDB persistence is handled by a store subscriber (see bootstrap.js),
 * NOT here. This keeps the reducer testable in isolation.
 */

import { Semester } from '@/domain/Semester.js';
import { Course } from '@/domain/Course.js';
import { ALL_SEMESTERS_ID, DEFAULT_SCALE_ID } from '@/utils/constants.js';

export const initialState = Object.freeze({
  semesters: [],

  /**
   * Which semester tab is currently active in the UI.
   * See the module docstring above for the three possible states.
   * Starts as ALL_SEMESTERS_ID so the first thing the user sees after
   * adding any semesters is the overview — not an arbitrarily chosen semester.
   */
  activeSemesterId: ALL_SEMESTERS_ID,

  /**
   * Student profile — written by ProfileManager, read by GPARings + transcript.
   * scaleId selects which grading scale is used for new courses.
   */
  student: {
    name: '',
    matricNo: '',
    dept: '',
    level: '',
    session: '',
    scaleId: DEFAULT_SCALE_ID, // ← NEW: active grading scale
  },

  /**
   * Previous institutional record (transfer / carry-over credits).
   * Included in CGPA via GPACalculatorService.cgpaWithPreviousRecord().
   */
  previousRecord: {
    creditUnits: 0,
    qualityPoints: 0,
  },
});

/**
 * @param {typeof initialState} state
 * @param {{ type: string, payload?: * }} action
 * @returns {typeof initialState}
 */
export function reducer(state, action) {
  switch (action.type) {
    // ── Full Reset ────────────────────────────────────────────────
    /**
     * RESET_ALL — wipes every state slice back to initial defaults.
     * IDB is cleared BEFORE this dispatch fires (resetService.js).
     * The reducer only resets in-memory state — no async work here.
     */
    case 'RESET_ALL':
      return {
        semesters: [],
        activeSemesterId: null,
        student: {
          name: '',
          matricNo: '',
          dept: '',
          level: '',
          session: '',
          scaleId: DEFAULT_SCALE_ID,
        },
        previousRecord: {
          creditUnits: 0,
          qualityPoints: 0,
        },
      };

    // ── Active Semester ──────────────────────────────────────────
    case 'SET_ACTIVE_SEMESTER':
      return { ...state, activeSemesterId: action.payload.id };

    // ── Semesters ────────────────────────────────────────────────
    case 'ADD_SEMESTER': {
      const s = new Semester({ label: action.payload.label });
      return {
        ...state,
        semesters: [...state.semesters, s.toJSON()],
        activeSemesterId: s.id, // Automatically focus the newly created semester
      };
    }

    case 'DELETE_SEMESTER': {
      const nextSemesters = state.semesters.filter((s) => s.id !== action.payload.id);
      return {
        ...state,
        semesters: nextSemesters,
        // Fallback to the last available semester, or null if all are deleted
        activeSemesterId: nextSemesters.at(-1)?.id ?? null,
      };
    }

    case 'UPDATE_SEMESTER_LABEL':
      return {
        ...state,
        semesters: state.semesters.map((s) =>
          s.id === action.payload.id ? { ...s, label: action.payload.label } : s
        ),
      };

    // ── Courses ──────────────────────────────────────────────────
    case 'ADD_COURSE':
      return {
        ...state,
        semesters: state.semesters.map((s) => {
          if (s.id !== action.payload.semesterId) return s;
          return Semester.fromJSON(s).addCourse(new Course(action.payload.course)).toJSON();
        }),
      };

    case 'DELETE_COURSE':
      return {
        ...state,
        semesters: state.semesters.map((s) => {
          if (s.id !== action.payload.semesterId) return s;
          return Semester.fromJSON(s).removeCourse(action.payload.courseId).toJSON();
        }),
      };

    case 'UPDATE_COURSE':
      return {
        ...state,
        semesters: state.semesters.map((s) => {
          if (s.id !== action.payload.semesterId) return s;
          return Semester.fromJSON(s)
            .updateCourse(action.payload.courseId, action.payload.changes)
            .toJSON();
        }),
      };

    // ── Settings ─────────────────────────────────────────────────
    case 'SET_STUDENT':
      return { ...state, student: { ...state.student, ...action.payload } };

    case 'SET_PREVIOUS_RECORD':
      return { ...state, previousRecord: { ...action.payload } };

    // ── Bulk hydration (called once on startup from IDB) ──────────
    case 'HYDRATE':
      return { ...state, ...action.payload };

    default:
      return state; // Unknown actions → return state unchanged
  }
}
