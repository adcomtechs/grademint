/**
 * @module DataPortabilityService
 * @description Import/export helpers for local-first GPA Pro data.
 */

import { APP_NAME, APP_VERSION, DEFAULT_SCALE_ID } from '@/utils/constants.js';

const EXPORT_SCHEMA_VERSION = 1;

/**
 * Builds a stable, versioned export payload from app state.
 * @param {object} state
 * @returns {{ app: string, version: string, schemaVersion: number, exportedAt: string, state: object }}
 */
export function createExportPayload(state) {
  return {
    app: APP_NAME,
    version: APP_VERSION,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    state: normalizeImportedState(state),
  };
}

/**
 * Serialises app state for a downloadable JSON export.
 * @param {object} state
 * @returns {string}
 */
export function createExportJson(state) {
  return JSON.stringify(createExportPayload(state), null, 2);
}

/**
 * Parses and validates a JSON import file.
 * Accepts both the versioned export envelope and a raw legacy state object.
 *
 * @param {string} json
 * @returns {object} Normalised application state
 */
export function parseImportJson(json) {
  let parsed;

  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(`Import file is not valid JSON: ${err.message}`, { cause: err });
  }

  const state = parsed?.state ?? parsed;
  return normalizeImportedState(state);
}

/**
 * Restores imported state to persistence first, then memory.
 * If persistence fails, the store is not mutated.
 *
 * @param {ReturnType<import('../core/Store.js').createStore>} store
 * @param {import('./IndexedDBService.js').IndexedDBService | null} idb
 * @param {object} importedState
 * @returns {Promise<object>} The normalised state applied to the app
 */
export async function restoreImportedState(store, idb, importedState) {
  const state = normalizeImportedState(importedState);

  if (idb?.isOpen) {
    await idb.syncAllSemesters(state.semesters);
    await idb.putSetting('student', state.student);
    await idb.putSetting('previousRecord', state.previousRecord);
  }

  store.dispatch({ type: 'HYDRATE', payload: state });
  return state;
}

/**
 * Normalises user-provided data into the current state contract.
 * @param {object} state
 * @returns {{ semesters: object[], activeSemesterId: string|null, student: object, previousRecord: object }}
 */
export function normalizeImportedState(state) {
  if (!state || typeof state !== 'object') {
    throw new Error('Import file does not contain a GPA Pro state object.');
  }

  if (!Array.isArray(state.semesters)) {
    throw new Error('Import file is missing a valid semesters array.');
  }

  const student = state.student && typeof state.student === 'object' ? state.student : {};
  const previousRecord =
    state.previousRecord && typeof state.previousRecord === 'object' ? state.previousRecord : {};

  return {
    semesters: state.semesters.map(_normalizeSemester),
    activeSemesterId: state.activeSemesterId ?? null,
    student: {
      name: String(student.name ?? ''),
      matricNo: String(student.matricNo ?? ''),
      dept: String(student.dept ?? ''),
      level: String(student.level ?? ''),
      session: String(student.session ?? ''),
      scaleId: String(student.scaleId ?? DEFAULT_SCALE_ID),
    },
    previousRecord: {
      creditUnits: _nonNegativeNumber(previousRecord.creditUnits, 0),
      qualityPoints: _nonNegativeNumber(previousRecord.qualityPoints, 0),
    },
  };
}

function _normalizeSemester(semester) {
  if (!semester || typeof semester !== 'object') {
    throw new Error('Import file contains an invalid semester record.');
  }
  if (!semester.id || !semester.label) {
    throw new Error('Import file contains a semester without an id or label.');
  }
  if (!Array.isArray(semester.courses)) {
    throw new Error(`Semester "${semester.label}" is missing a valid courses array.`);
  }

  return {
    ...semester,
    id: String(semester.id),
    label: String(semester.label),
    courses: semester.courses,
    createdAt: _nonNegativeNumber(semester.createdAt, Date.now()),
  };
}

function _nonNegativeNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
