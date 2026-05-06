/**
 * @module course-form/index
 * @description Barrel export for the course-form module.
 *
 * External consumers (SemesterPanel, EditCourseModal) import CourseForm only.
 * Internal sub-modules are exported for direct unit testing.
 */

export { CourseForm } from './CourseForm.js';
export { CourseFormState } from './CourseFormState.js';
export { validateCourseFormSnapshot } from './CourseFormValidator.js';
export { CourseFormErrorDisplay } from './CourseFormErrorDisplay.js';
export { IdentitySection } from './sections/IdentitySection.js';
export { ScoreSection } from './sections/ScoreSection.js';
export { ThresholdSection } from './sections/ThresholdSection.js';
export { FormFooter } from './sections/FormFooter.js';
