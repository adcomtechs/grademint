/**
 * @module NudgeRenderer
 * @description Renders a contextual profile-setup nudge inside the hero zone.
 *
 * WHEN IT APPEARS:
 *   The student has at least one semester (so we are not in empty mode) but
 *   has not yet filled in their name. The hero zone identity strip shows
 *   "Your Name" as a placeholder — this nudge explains why and offers a
 *   direct path to fix it.
 *
 * WHEN IT DISAPPEARS:
 *   Automatically on the next GPARings render cycle once the student saves
 *   their profile, because GPARings subscribes to watchState and re-renders
 *   on every store change.
 *
 * INTERACTION MODEL:
 *   The nudge button fires a callback supplied by dashboard.js via the
 *   GPARings constructor. This keeps NudgeRenderer (and GPARings) free of
 *   any dependency on ViewRouter or any other navigation mechanism.
 *
 * ELEMENT CONTRACT:
 *   Injects/updates #hero-profile-nudge immediately after #identity-name.
 *   Removes the element entirely when the nudge is not needed so it does
 *   not occupy space or affect layout.
 */

const NUDGE_ID = 'hero-profile-nudge';

/**
 * @param {object}        student            state.student
 * @param {number}        semesterCount      total number of semesters
 * @param {Function|null} onNavigateProfile  callback to open profile view
 */
export function renderNudge(student, semesterCount, onNavigateProfile) {
  // Only show when there are semesters but no name has been set
  const shouldShow = semesterCount > 0 && !student.name;

  let el = document.getElementById(NUDGE_ID);

  if (!shouldShow) {
    el?.remove();
    return;
  }

  if (!el) {
    el = document.createElement('div');
    el.id = NUDGE_ID;
    el.className = 'hero-profile-nudge';

    // Insert after #identity-name
    const anchor = document.getElementById('identity-name');
    anchor?.insertAdjacentElement('afterend', el);
  }

  el.innerHTML = `
    <span class="nudge-text">Personalise your record —</span>
    <button class="nudge-btn" type="button" id="nudge-profile-btn"
            aria-label="Set up your student profile">
      Set Up Profile
    </button>
  `;

  if (onNavigateProfile) {
    el.querySelector('#nudge-profile-btn')?.addEventListener('click', onNavigateProfile, {
      once: true,
    });
  }
}

/**
 * Removes the nudge element unconditionally. Called by EmptyHeroState
 * when the hero zone is in empty mode (where the nudge is irrelevant
 * because the empty state already surfaces both CTAs).
 */
export function removeNudge() {
  document.getElementById(NUDGE_ID)?.remove();
}
