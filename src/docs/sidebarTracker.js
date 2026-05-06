/**
 * @module sidebarTracker
 * @description IntersectionObserver-based active sidebar link tracking.
 *
 * STRATEGY:
 *   Each .docs-article is observed. When one enters the viewport at the
 *   configured threshold, its matching sidebar link is marked is-active.
 *
 * WHY IntersectionObserver instead of scroll listeners?
 *   - No scroll jank — detection runs off the main thread
 *   - No manual throttle/debounce required
 *   - Fires only when visibility actually changes — not on every pixel
 *
 * EXPORTED activateLink:
 *   Exported so smoothScroll.js can call it for hash-based initial activation
 *   without duplicating the sidebar-link query.
 *
 * HEADER OFFSET:
 *   rootMargin `-64px 0px -60% 0px` pushes the effective viewport top down
 *   by 64px (the header height) so a section is only "active" when it is
 *   comfortably below the sticky header.
 */

/**
 * Marks the sidebar link whose href matches `#${id}` as active.
 * All other links are deactivated.
 *
 * @param {string}    id           The article's element ID
 * @param {Element[]} sidebarLinks All .sidebar-link elements
 */
export function activateLink(id, sidebarLinks) {
  sidebarLinks.forEach((link) => {
    const isActive = link.getAttribute('href') === `#${id}`;
    link.classList.toggle('is-active', isActive);
  });
}

/**
 * Mounts the IntersectionObserver on all article elements.
 * Gracefully skips setup when the browser does not support IntersectionObserver.
 *
 * @param {Element[]}  articles
 * @param {Element[]}  sidebarLinks
 */
export function initSidebarTracker(articles, sidebarLinks) {
  if (!articles.length || !sidebarLinks.length) return;
  if (!('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      // Pick the entry with the greatest visible ratio
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (visible.length > 0) {
        activateLink(visible[0].target.id, sidebarLinks);
      }
    },
    {
      rootMargin: '-64px 0px -60% 0px',
      threshold: [0.1, 0.5],
    }
  );

  articles.forEach((article) => observer.observe(article));
}
