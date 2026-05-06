/**
 * @module ProfileView
 * @description Full-page Profile & Settings SPA view.
 *
 * REPLACES: the modal-based ProfileManager used in all previous versions.
 *
 * ROUTING:
 *   Registered as "#profile" in ViewRouter.
 *   The Settings button in the header calls router.navigate('profile')
 *   instead of opening a modal overlay.
 *
 * BENEFITS OVER MODAL:
 *   - Fully scrollable on mobile — no fixed-height overlay
 *   - Deep-linkable via URL hash: navigate directly to /index.html#profile
 *   - No z-index conflicts with other overlays
 *   - Standard browser Back navigation works correctly
 *
 * SECTION LIFECYCLE:
 *   All three sections are mounted once in render() and live for the
 *   application's lifetime. Each section manages its own watchState
 *   subscription — ProfileView does not subscribe to the store.
 *
 * ACTIVATION:
 *   ViewRouter calls activate() when the user navigates to #profile.
 *   No re-render is needed on activation since sections are always subscribed.
 *   ProfileView scrolls the content area to the top on each activation.
 */

import { BaseComponent } from '@/components/common/BaseComponent.js';
import { StudentSection } from '@/components/profile/sections/StudentSection.js';
import { PreviousRecordSection } from '@/components/profile/sections/PreviousRecordSection.js';
import { DangerZoneSection } from '@/components/profile/sections/DangerZoneSection.js';
import { createElement, clearElement } from '@/utils/dom.js';
import { createLogger } from '@/utils/logger.js';

const log = createLogger('ProfileView');

export class ProfileView extends BaseComponent {
  constructor(container, store) {
    super(container, store);
    /** @type {BaseComponent[]} Active section components */
    this._sections = [];
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  // ProfileView does not subscribe to the store.
  // All reactivity is delegated to the three section components.

  unmount() {
    this._sections.forEach((s) => s.unmount());
    this._sections = [];
    super.unmount();
  }

  /**
   * Called by ViewRouter each time the user navigates to #profile.
   * Sections are already mounted — scroll to top is the only action needed.
   */
  activate() {
    log.debug('ProfileView activated');
    this.container.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  render() {
    // Unmount any previous sections before rebuilding the layout
    this._sections.forEach((s) => s.unmount());
    this._sections = [];
    clearElement(this.container);

    const root = createElement('div', { className: 'pv-root' });

    // Page heading
    root.append(
      createElement(
        'div',
        { className: 'pv-heading' },
        createElement('h2', { className: 'pv-heading-title' }, '⚙ Profile & Settings'),
        createElement(
          'p',
          { className: 'pv-heading-sub' },
          'Manage your academic identity, grading scale, and application data.'
        )
      )
    );

    // Section host containers — sections are mounted after root is in the DOM
    const studentContainer = createElement('div', { className: 'pv-section-host' });
    const prevContainer = createElement('div', { className: 'pv-section-host' });
    const dangerContainer = createElement('div', { className: 'pv-section-host' });

    root.append(studentContainer, prevContainer, dangerContainer);
    this.container.append(root);

    // Mount all three sections now that their containers are in the document
    this._mountSection(new StudentSection(studentContainer, this.store));
    this._mountSection(new PreviousRecordSection(prevContainer, this.store));
    this._mountSection(new DangerZoneSection(dangerContainer, this.store));
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Mounts a section and registers it for cleanup when ProfileView unmounts.
   * @param {BaseComponent} section
   */
  _mountSection(section) {
    section.mount();
    this._sections.push(section);
  }
}
