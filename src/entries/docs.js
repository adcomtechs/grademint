/**
 * @module docs
 * @description Entry point for docs.html — wires all interactive behaviours.
 *
 * This module is intentionally thin. Each behaviour lives in its own module
 * under src/docs/. This file is responsible only for:
 *   1. Querying the stable DOM elements the behaviours need
 *   2. Calling each behaviour's init function with those elements
 *
 * BOOT ORDER:
 *   Order matters only for initSmoothScroll (which calls activateLink from
 *   sidebarTracker) — but because all modules are ES modules, imports are
 *   resolved before any code executes, so init ordering is safe regardless.
 *
 * GRACEFUL DEGRADATION:
 *   Every init function guards its own entry points with optional chaining
 *   and early returns. This file does not need to verify that elements exist
 *   before calling init — the modules handle missing elements cleanly.
 */

import { debounce } from '@/utils/dom.js';
import { applyPageMetadata } from '@/config/metadata.js';
import { HeaderView } from '@/components/layout/HeaderView.js';
import { initSearch } from '../docs/search.js';
import { initFaqAccordion } from '../docs/faqAccordion.js';
import { initSidebarTracker } from '../docs/sidebarTracker.js';
import { initGradeWidget } from '../docs/gradeWidget.js';
import { initSmoothScroll } from '../docs/smoothScroll.js';

// ── Stable DOM queries — run once at module evaluation time ───────────────────
// The docs page is static HTML — these elements are present at parse time.

const searchInput = document.getElementById('docs-search');
const noResults = document.getElementById('no-results');
const noResultsQ = document.getElementById('no-results-query');
const clearBtn = document.getElementById('clear-search');
const widgetScore = document.getElementById('widget-score');
const widgetResult = document.getElementById('widget-result');
const tocEl = document.querySelector('#docs-toc');

const articles = Array.from(document.querySelectorAll('.docs-article'));
const sidebarLinks = Array.from(document.querySelectorAll('.sidebar-link'));
const faqItems = Array.from(document.querySelectorAll('.faq-item'));

// ── Behaviour initialisation ──────────────────────────────────────────────────

applyPageMetadata('docs');
const headerEl = document.getElementById('app-header');
if (headerEl) new HeaderView(headerEl, { variant: 'docs' }).mount();

// 1. Full-text search (with debounce)
initSearch({ searchInput, clearBtn, noResults, noResultsQ, articles, debounce });

// 2. FAQ accordion
initFaqAccordion(faqItems);

// 3. IntersectionObserver active-link tracking
initSidebarTracker(articles, sidebarLinks);

// 4. Sidebar GPA quick-check widget
initGradeWidget(widgetScore, widgetResult);

// 5. Smooth scroll + hash-based initial activation
initSmoothScroll(tocEl, sidebarLinks);
