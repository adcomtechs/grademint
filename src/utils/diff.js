/**
 * @module diff
 * @description Pure diffing utilities for comparing state slices.
 *
 * These functions are intentionally free of any IDB, DOM, or store
 * knowledge. They take plain arrays and return plain objects — making
 * them trivially testable and reusable across any future state slice
 * that needs efficient change detection.
 */

/**
 * @typedef {Object} SemesterDiff
 * @property {Object[]} added   - Semesters present in next but not in prev
 * @property {Object[]} updated - Semesters present in both but with changed content
 * @property {string[]} deleted - IDs of semesters present in prev but not in next
 */

/**
 * Computes the minimal diff between two arrays of semester plain objects.
 *
 * Identity is determined by the `id` field (a UUID string). Content
 * equality is determined by JSON serialisation of the individual record —
 * not the entire array — so the cost is proportional to the number of
 * changed records, not the total collection size.
 *
 * COMPLEXITY:
 *   Building the lookup maps: O(n + m)
 *   Comparing each record:    O(k) where k = number of changed records
 *   Overall:                  O(n + m) — linear in collection size
 *
 * This is a strict improvement over the previous approach:
 *   Previous: O(n) serialisation + O(n) IDB writes on every change
 *   After:    O(n + m) diff + O(k) IDB writes  where k << n in practice
 *
 * @param {Object[]} prev - Previous semester plain objects (from prevState)
 * @param {Object[]} next - Next semester plain objects (from state)
 * @returns {SemesterDiff}
 */
export function diffSemesters(prev, next) {
  // Build an id → serialised-record map for the previous state.
  // Serialising each record individually (not the whole array) means we
  // only pay the serialisation cost for records that exist in both sides.
  /** @type {Map<string, string>} */
  const prevMap = new Map(prev.map((sem) => [sem.id, JSON.stringify(sem)]));

  // Build an id → record map for the next state.
  /** @type {Map<string, Object>} */
  const nextMap = new Map(next.map((sem) => [sem.id, sem]));

  const added = [];
  const updated = [];
  const deleted = [];

  // Identify added and updated records.
  for (const [id, sem] of nextMap) {
    if (!prevMap.has(id)) {
      // New ID — this semester did not exist before.
      added.push(sem);
    } else if (prevMap.get(id) !== JSON.stringify(sem)) {
      // Same ID, different content — this semester was modified.
      updated.push(sem);
    }
    // If ID exists and content matches: no-op — do not touch IDB.
  }

  // Identify deleted records.
  for (const [id] of prevMap) {
    if (!nextMap.has(id)) {
      deleted.push(id);
    }
  }

  return { added, updated, deleted };
}
