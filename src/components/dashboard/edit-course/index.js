/**
 * @module edit-course/index
 * @description Barrel export for the edit-course module.
 *
 * External consumers import openEditCourseModal only.
 * EditCourseModal and EditCourseFormState are exported for direct unit testing.
 */

export { openEditCourseModal, EditCourseModal } from './EditCourseModal.js';
export { EditCourseFormState } from './EditCourseFormState.js';
