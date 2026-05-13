/**
 * @module metadata
 * @description Runtime metadata helpers for deploy-specific canonical and OG URLs.
 *
 * Set VITE_PUBLIC_ORIGIN in the deployment environment, for example:
 *   VITE_PUBLIC_ORIGIN=https://gpapro.example.com
 */

const PUBLIC_ORIGIN = import.meta.env?.VITE_PUBLIC_ORIGIN?.replace(/\/$/, '') ?? '';

export const METADATA = Object.freeze({
  publicOrigin: PUBLIC_ORIGIN,
  pages: Object.freeze({
    dashboard: Object.freeze({
      path: '/',
      title: 'GradeMint — Advanced GPA & CGPA Calculator',
    }),
    docs: Object.freeze({
      path: '/docs.html',
      title: 'GradeMint — Docs & Grade Guide',
    }),
  }),
});

/**
 * Applies canonical and Open Graph URL metadata when a production origin exists.
 * If no origin is configured, the function removes stale URL tags so the app
 * never ships placeholder metadata.
 *
 * @param {'dashboard'|'docs'} pageId
 */
export function applyPageMetadata(pageId) {
  const page = METADATA.pages[pageId];
  if (!page) return;

  const url = METADATA.publicOrigin ? `${METADATA.publicOrigin}${page.path}` : '';
  _upsertMetaProperty('og:title', page.title);

  if (!url) {
    _removeLink('canonical');
    _removeMetaProperty('og:url');
    return;
  }

  _upsertLink('canonical', url);
  _upsertMetaProperty('og:url', url);
}

function _upsertLink(rel, href) {
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.append(el);
  }
  el.href = href;
}

function _removeLink(rel) {
  document.querySelector(`link[rel="${rel}"]`)?.remove();
}

function _upsertMetaProperty(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.append(el);
  }
  el.content = content;
}

function _removeMetaProperty(property) {
  document.querySelector(`meta[property="${property}"]`)?.remove();
}
