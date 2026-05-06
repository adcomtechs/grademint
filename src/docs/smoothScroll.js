/**
 * @module smoothScroll
 * @description Smooth-scroll sidebar links and hash-based initial activation.
 *
 * CLICK INTERCEPTION:
 *   Sidebar anchor tags (#section-id) are intercepted to apply smooth
 *   scrolling behaviour. The browser's default jump is prevented; the target
 *   article scrolls into view with CSS scroll-margin-top providing the header
 *   offset. The URL hash is updated via history.pushState so the address bar
 *   reflects the current section without triggering a page reload.
 *
 * HASH INITIALISATION:
 *   When the page loads with a URL hash, the matching sidebar link is
 *   activated and the target article is scrolled into view after one
 *   requestAnimationFrame to allow the browser to finish the initial layout.
 *
 * DEPENDENCY ON sidebarTracker:
 *   activateLink() is imported from sidebarTracker.js — it is the single
 *   authoritative function for marking a sidebar link active. This module
 *   does not duplicate that logic.
 */

import { activateLink } from './sidebarTracker.js';

/**
 * Mounts the delegated click listener on the sidebar TOC and handles the
 * initial URL hash scroll on page load.
 *
 * @param {Element | null} tocEl        #docs-toc
 * @param {Element[]}      sidebarLinks All .sidebar-link elements
 */
export function initSmoothScroll(tocEl, sidebarLinks) {
  // ── Click interception on the TOC container ───────────────────────────────
  tocEl?.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;

    e.preventDefault();

    const targetId = link.getAttribute('href').slice(1);
    const target = document.getElementById(targetId);

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.pushState(null, '', `#${targetId}`);
      activateLink(targetId, sidebarLinks);
    }
  });

  // ── Initial hash activation ───────────────────────────────────────────────
  if (!window.location.hash) return;

  const id = window.location.hash.slice(1);
  if (!id) return;

  activateLink(id, sidebarLinks);

  // One rAF ensures the browser has finished the initial layout paint before
  // attempting to scroll, preventing a no-op on first load.
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
