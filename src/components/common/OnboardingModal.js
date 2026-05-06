/**
 * @module OnboardingModal
 * @description First-run onboarding prompt for new GPA Pro users.
 *
 * ── PURPOSE ─────────────────────────────────────────────────────────────────
 *
 * Eliminates the "staring at zeroes and not knowing why" moment for users
 * who open GPA Pro for the first time. The modal fires once, explains what
 * the app does, and offers two immediate entry points:
 *
 *   1. "Set Up Profile" — navigate to Profile & Settings
 *   2. "Add My First Semester" — open the Add Semester modal directly
 *
 * Either action (plus the Skip link) marks the user as onboarded so the
 * modal never appears again.
 *
 * ── PERSISTENCE ─────────────────────────────────────────────────────────────
 *
 * Gated by a localStorage flag: 'gpapro.hasOnboarded'.
 * localStorage is appropriate here (not IndexedDB) because:
 *   • This is a one-time UI preference, not academic data.
 *   • It must be readable synchronously before any async IDB open.
 *   • It follows the same pattern as UIStorageService for UI state.
 *
 * ── INTERACTION MODEL ────────────────────────────────────────────────────────
 *
 * Two callbacks supplied by dashboard.js (same pattern as GPARings):
 *   onNavigateProfile  — calls router.navigate('profile')
 *   onAddSemester      — calls openAddSemesterModal(store)
 *
 * The modal uses the existing #modal-overlay / #modal-box / #modal-content
 * infrastructure so it inherits all existing focus-trap, close-button,
 * and keyboard-dismiss behaviour for free.
 *
 * ── USAGE ────────────────────────────────────────────────────────────────────
 *
 *   import { showOnboardingIfNeeded } from '@/components/common/OnboardingModal.js';
 *
 *   // At the end of dashboard boot(), after router.init():
 *   showOnboardingIfNeeded({
 *     onNavigateProfile: () => router.navigate('profile'),
 *     onAddSemester:     () => openAddSemesterModal(store),
 *   });
 */

import { openModal } from '@/utils/dom.js';

const STORAGE_KEY = 'gpapro.hasOnboarded';

/**
 * Returns true if this is the user's first visit (flag not set in localStorage).
 * @returns {boolean}
 */
export function isFirstRun() {
  try {
    return !localStorage.getItem(STORAGE_KEY);
  } catch {
    // Privacy mode / storage blocked — treat as not-first-run to avoid
    // showing the modal on every page load when storage is unavailable.
    return false;
  }
}

/**
 * Marks the user as onboarded. Idempotent — safe to call multiple times.
 */
export function markOnboarded() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Storage unavailable — silently swallow; the modal will reappear
    // next visit but that is preferable to an unhandled exception.
  }
}

/**
 * Shows the onboarding modal if this is the user's first run.
 * No-ops silently if the user has already been onboarded or if the
 * modal overlay elements are not present in the DOM.
 *
 * @param {object}   options
 * @param {Function} options.onNavigateProfile  navigate to Profile & Settings
 * @param {Function} options.onAddSemester      open Add Semester modal
 */
export function showOnboardingIfNeeded({ onNavigateProfile, onAddSemester } = {}) {
  if (!isFirstRun()) return;

  // Build modal content
  const content = _buildContent({
    onNavigateProfile,
    onAddSemester,
  });

  // openModal injects content into #modal-content and shows the overlay.
  // It also sets up focus-trap and Escape-key dismiss automatically.
  openModal(content, { size: 'md' });
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Builds the onboarding modal DOM content.
 *
 * @param {object}   opts
 * @param {Function} opts.onNavigateProfile
 * @param {Function} opts.onAddSemester
 * @returns {HTMLElement}
 */
function _buildContent({ onNavigateProfile, onAddSemester }) {
  const root = document.createElement('div');
  root.className = 'onboarding';
  root.setAttribute('role', 'document');

  root.innerHTML = `
    <div class="onboarding-header">
      <div class="onboarding-icon" aria-hidden="true">🎓</div>
      <h2 class="onboarding-title" id="modal-heading">Welcome to GPA Pro</h2>
      <p class="onboarding-sub">
        Your local-first academic companion — no sign-up, no server, your data stays on your device.
      </p>
    </div>

    <ul class="onboarding-features" aria-label="What GPA Pro does">
      <li class="onboarding-feature">
        <span class="feature-icon" aria-hidden="true">📊</span>
        <div>
          <strong>Real-time GPA &amp; CGPA</strong>
          <p>Calculates your semester and cumulative GPA as you type.</p>
        </div>
      </li>
      <li class="onboarding-feature">
        <span class="feature-icon" aria-hidden="true">🎯</span>
        <div>
          <strong>What-If Planning</strong>
          <p>Simulate future grades and see exactly how they affect your CGPA.</p>
        </div>
      </li>
      <li class="onboarding-feature">
        <span class="feature-icon" aria-hidden="true">📋</span>
        <div>
          <strong>Transcript View</strong>
          <p>Generate a clean, printable academic transcript any time.</p>
        </div>
      </li>
      <li class="onboarding-feature">
        <span class="feature-icon" aria-hidden="true">🔒</span>
        <div>
          <strong>100% Private</strong>
          <p>All data lives in your browser's IndexedDB — exportable as JSON backup.</p>
        </div>
      </li>
    </ul>

    <p class="onboarding-cta-label">Where would you like to start?</p>

    <div class="onboarding-actions">
      <button class="btn btn--primary" id="ob-profile-btn" type="button">
        ⚙ Set Up Profile First
      </button>
      <button class="btn btn--ghost" id="ob-semester-btn" type="button">
        ＋ Add My First Semester
      </button>
    </div>

    <button class="onboarding-skip" id="ob-skip" type="button"
            aria-label="Skip onboarding and go to the dashboard">
      Skip — I'll explore on my own
    </button>
  `;

  // ── Wire actions ────────────────────────────────────────────────────────────

  const _dismiss = () => {
    markOnboarded();
    // Close the modal by clicking the existing close button
    document.getElementById('modal-close')?.click();
  };

  root.querySelector('#ob-profile-btn')?.addEventListener('click', () => {
    _dismiss();
    onNavigateProfile?.();
  });

  root.querySelector('#ob-semester-btn')?.addEventListener('click', () => {
    _dismiss();
    onAddSemester?.();
  });

  root.querySelector('#ob-skip')?.addEventListener('click', _dismiss);

  return root;
}
