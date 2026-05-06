/**
 * @module IdentityRenderer
 * @description Renders the student identity strip in the hero zone.
 *
 * Writes to these IDs in index.html:
 *   #identity-name, #fv-dept, #fv-level, #fv-scale, #fv-session
 *
 * The profile nudge is rendered separately by NudgeRenderer so that
 * IdentityRenderer stays a pure data→DOM projection with no control flow.
 */

import { setText } from './RingAnimator.js';

/**
 * @param {object} student   state.student (may be empty object)
 * @param {object} scale     resolved GradeScale from getScale()
 */
export function renderIdentity(student, scale) {
  setText('identity-name', student.name || 'Your Name');
  setText('fv-dept', student.dept || '—');
  setText('fv-level', student.level || '—');
  setText('fv-session', student.session || '—');
  // Show only the short label: "5.0 Scale" not "5.0 Scale (Nigerian)"
  setText('fv-scale', scale.label.split(' (')[0]);
}
