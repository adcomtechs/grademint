/**
 * @module dashboard
 * @description Entry point for index.html (Dashboard page).
 *
 * Boot sequence:
 * 1. Bootstrap              — IDB open + store hydration
 * 2. Mount HeaderView        — app-header
 * 3. Mount GPARings          — hero-zone (with onAddSemester / onNavigateProfile callbacks)
 * 4. Mount SemesterManager   — #semesters-section
 * 5. Mount AcademicInsights  — #desk-right
 * 6. Mount ProfileView       — #profile-view
 * 7. Register lazy routes    — AnalyticsPanel / TranscriptView / WhatIfView
 * 8. Wire ViewRouter         — hash-based SPA navigation
 * 9. Wire "Add Semester" buttons, Settings, Export
 * 10. Show onboarding modal  — first run only (gated by localStorage flag)
 */

import { initApp } from '../core/bootstrap.js';
import { ViewRouter } from '../core/ViewRouter.js';
import { GPARings } from '../components/dashboard/rings/index.js';
import { SemesterManager, openAddSemesterModal } from '../components/dashboard/SemesterManager.js';
import { AcademicInsights } from '../components/dashboard/AcademicInsights/index.js';
import { HeaderView } from '../components/layout/HeaderView.js';
import { renderFatalErrorView } from '../components/common/FatalErrorView.js';
import { showOnboardingIfNeeded } from '../components/common/OnboardingModal.js';
import { applyPageMetadata } from '../config/metadata.js';
import { createExportJson } from '../services/DataPortabilityService.js';
import { showToast } from '../utils/dom.js';
import { createLogger } from '../utils/logger.js';
import { ProfileView } from '../components/profile/ProfileView.js';

const log = createLogger('dashboard');

const lazyViews = {
  analytics: null,
  transcript: null,
  whatif: null,
};

// ── Export ────────────────────────────────────────────────────────────────────

function exportData(store) {
  const json = createExportJson(store.getState());
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gpa-pro-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data exported.', 'success');
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function boot() {
  try {
    applyPageMetadata('dashboard');

    const store = await initApp();

    // ── Header ─────────────────────────────────────────────────────────────
    const headerEl = document.getElementById('app-header');
    if (headerEl) new HeaderView(headerEl, { store, variant: 'dashboard' }).mount();

    // ── Router (declared early so callbacks can reference it) ───────────────
    const router = new ViewRouter();

    // ── Shared callbacks wired once ────────────────────────────────────────
    // These are the only two navigation actions GPARings and OnboardingModal
    // need. Passing them as callbacks keeps both modules free of router and
    // modal dependencies, preserving the architectural boundary contract.
    const onAddSemester = () => openAddSemesterModal(store);
    const onNavigateProfile = () => router.navigate('profile');

    // ── GPARings — now receives interaction callbacks ───────────────────────
    const dashSection = document.getElementById('dashboard-section');
    if (dashSection) {
      new GPARings(dashSection, store, { onAddSemester, onNavigateProfile }).mount();
    }

    // ── SemesterManager ────────────────────────────────────────────────────
    const semWrapper =
      document.getElementById('semesters-section') ?? document.getElementById('app-main');
    if (semWrapper) new SemesterManager(semWrapper, store).mount();

    // ── AcademicInsights ───────────────────────────────────────────────────
    const insightsEl = document.getElementById('desk-right');
    if (insightsEl) new AcademicInsights(insightsEl, store).mount();

    // ── Lazy view containers ───────────────────────────────────────────────
    const analyticsView = document.getElementById('analytics-view');
    const transcriptView = document.getElementById('transcript-view');
    const whatifView = document.getElementById('whatif-view');

    // ── ProfileView ────────────────────────────────────────────────────────
    const profileEl = document.getElementById('profile-view');
    let profileView = null;

    if (profileEl) {
      const onNavigateDashboard = () => router.navigate('dashboard');

      profileView = new ProfileView(profileEl, store, { onSave: onNavigateDashboard });

      profileView.mount();
    }

    // ── ViewRouter registration ────────────────────────────────────────────
    const dashView = document.getElementById('dashboard-view');
    if (dashView) router.register('dashboard', dashView);
    if (analyticsView)
      router.register('analytics', analyticsView, () => activateAnalytics(analyticsView, store));
    if (transcriptView)
      router.register('transcript', transcriptView, () =>
        activateTranscript(transcriptView, store)
      );
    if (whatifView) router.register('whatif', whatifView, () => activateWhatIf(whatifView, store));
    if (profileEl) router.register('profile', profileEl, () => profileView?.activate());

    document.querySelectorAll('[data-view]').forEach((link) => {
      router.addNavLink(link, link.dataset.view);
    });

    router.init('dashboard');

    // ── "Add Semester" buttons ─────────────────────────────────────────────
    ['btn-add-semester', 'btn-add-semester-2', 'btn-add-semester-empty'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', onAddSemester);
    });

    // ── Settings ───────────────────────────────────────────────────────────
    document.getElementById('btn-settings')?.addEventListener('click', onNavigateProfile);

    // ── Export ─────────────────────────────────────────────────────────────
    document.getElementById('btn-export')?.addEventListener('click', () => exportData(store));

    // ── First-run onboarding modal ─────────────────────────────────────────
    // Fires after all components are mounted and the router is initialised
    // so that navigation callbacks work correctly inside the modal.
    // Gated by localStorage — silently no-ops on all subsequent visits.
    showOnboardingIfNeeded({ onNavigateProfile, onAddSemester });
  } catch (err) {
    log.error('[Dashboard] Fatal boot error:', err);
    const main = document.getElementById('app-main');
    if (main) renderFatalErrorView(main);
  }
}

// ── Lazy view activators ───────────────────────────────────────────────────────

async function activateAnalytics(container, store) {
  if (!lazyViews.analytics) {
    const { AnalyticsPanel } = await import('../components/dashboard/AnalyticsPanel.js');
    lazyViews.analytics = new AnalyticsPanel(container, store);
    lazyViews.analytics.mount();
  }
  lazyViews.analytics.activate?.();
}

async function activateTranscript(container, store) {
  if (!lazyViews.transcript) {
    const { TranscriptView } = await import('../components/dashboard/TranscriptView.js');
    lazyViews.transcript = new TranscriptView(container, store);
    lazyViews.transcript.mount();
  }
}

async function activateWhatIf(container, store) {
  if (!lazyViews.whatif) {
    const { WhatIfView } = await import('../components/dashboard/WhatIfView.js');
    lazyViews.whatif = new WhatIfView(container, store);
    lazyViews.whatif.mount();
  }
  lazyViews.whatif.activate?.();
}

// ── Entry ─────────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
