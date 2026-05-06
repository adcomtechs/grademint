/**
 * @module EmptyHeroState
 * @description Renders a purposeful empty state inside the hero zone.
 *
 * DESIGN RATIONALE:
 *   The original architecture placed an #empty-state div below the hero
 *   zone, requiring the user to scroll to see it while the hero zone above
 *   showed confusing zeroes and dashes. This module eliminates that split:
 *   the hero zone itself becomes the communication surface when there is
 *   no data, treating the first impression as a feature rather than a gap.
 *
 * VISIBILITY MODEL:
 *   When active, this renderer:
 *     1. Hides the normal hero body children (rings, sparkline, tier
 *        progress, footer) via a CSS class on the container.
 *     2. Injects (or updates) #hero-empty inside the container.
 *   When inactive (semesters exist), it removes #hero-empty and removes
 *   the hiding class so the normal hero zone renders cleanly.
 *
 * INTERACTION MODEL:
 *   Two callbacks supplied by dashboard.js via the GPARings constructor:
 *     - onAddSemester      → opens the Add Semester modal
 *     - onNavigateProfile  → navigates to the Profile view
 *   GPARings never touches ViewRouter or modal internals directly.
 *
 * ELEMENT CONTRACT:
 *   Injects #hero-empty as a direct child of the hero zone container
 *   (the element passed to GPARings). Uses the CSS class
 *   `hero-zone--empty` on the container to suppress normal children.
 */

import { removeNudge } from './NudgeRenderer.js';

const EMPTY_ID = 'hero-empty';
const EMPTY_CLASS = 'hero-zone--empty';

/**
 * @param {HTMLElement}   container         GPARings root container
 * @param {boolean}       isEmpty           true when semesters.length === 0
 * @param {object}        student           state.student
 * @param {Function|null} onAddSemester     callback to open add-semester modal
 * @param {Function|null} onNavigateProfile callback to navigate to profile view
 */
export function renderEmptyHeroState(
  container,
  isEmpty,
  student,
  onAddSemester,
  onNavigateProfile
) {
  if (!isEmpty) {
    // Restore normal hero zone rendering
    container.classList.remove(EMPTY_CLASS);
    document.getElementById(EMPTY_ID)?.remove();
    return;
  }

  // Suppress normal hero zone children via CSS
  container.classList.add(EMPTY_CLASS);

  // Remove the profile nudge — not needed when the full empty CTA is shown
  removeNudge();

  let el = document.getElementById(EMPTY_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = EMPTY_ID;
    el.className = 'hero-empty';
    container.append(el);
  }

  const hasName = Boolean(student.name);
  const greeting = hasName ? `Welcome, ${student.name.split(' ')[0]}.` : 'Welcome to GPA Pro.';

  el.innerHTML = `
    <div class="hero-empty-inner">
      <div class="hero-empty-graphic" aria-hidden="true">
        <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg"
             class="hero-empty-svg">
          <!-- Outer ring (unfilled) -->
          <circle cx="60" cy="60" r="52"
                  stroke="var(--color-border-light)" stroke-width="6"
                  stroke-dasharray="8 5" />
          <!-- Inner accent ring -->
          <circle cx="60" cy="60" r="36"
                  stroke="var(--color-gold)" stroke-width="2.5" opacity="0.35" />
          <!-- Centre mortar board icon -->
          <text x="60" y="68" text-anchor="middle"
                font-size="28" fill="var(--color-gold)" opacity="0.7">🎓</text>
        </svg>
      </div>

      <div class="hero-empty-text">
        <h2 class="hero-empty-title">${greeting}</h2>
        <p class="hero-empty-desc">
          Add your first semester to begin tracking your GPA and CGPA in real time.
        </p>
      </div>

      <div class="hero-empty-actions">
        <button class="btn btn--primary" id="hero-empty-add-sem" type="button">
          Add First Semester
        </button>
        ${
          !hasName
            ? `<button class="btn btn--ghost btn--sm" id="hero-empty-profile" type="button">
                 Set Up Profile
               </button>`
            : ''
        }
      </div>

      ${
        !hasName
          ? `<p class="hero-empty-hint">
               Tip: Setting up your profile personalises your transcript and academic record.
             </p>`
          : ''
      }
    </div>
  `;

  // Wire callbacks — use once:true so replaced HTML never accumulates listeners
  const addBtn = el.querySelector('#hero-empty-add-sem');
  if (addBtn && onAddSemester) {
    addBtn.addEventListener('click', onAddSemester, { once: true });
  }

  const profileBtn = el.querySelector('#hero-empty-profile');
  if (profileBtn && onNavigateProfile) {
    profileBtn.addEventListener('click', onNavigateProfile, { once: true });
  }
}
