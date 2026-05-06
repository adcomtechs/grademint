/**
 * @module search
 * @description Full-text article search for the documentation page.
 *
 * ALGORITHM:
 *   Each article's visible text content is concatenated with its data-tags
 *   attribute value. The query is split on whitespace so that multi-word
 *   queries require ALL words to match (AND logic, not OR).
 *
 * DIVIDER HANDLING:
 *   Each article is followed by an <hr class="article-divider"> in the HTML.
 *   When an article is hidden, its divider is also hidden so the page does
 *   not show stray horizontal rules between hidden sections.
 *
 * DEBOUNCE:
 *   The caller wraps filterArticles() in debounce() — this module exports
 *   the pure filtering function and leaves debounce wiring to the entry point.
 */

/**
 * Filters visible articles based on a search query string.
 * Shows all articles when the query is empty.
 *
 * @param {string}      query
 * @param {Element[]}   articles     All .docs-article elements
 * @param {Element|null} noResults   The #no-results container
 * @param {Element|null} noResultsQ  The <span> inside #no-results showing the query
 */
export function filterArticles(query, articles, noResults, noResultsQ) {
  const q = query.trim().toLowerCase();

  if (!q) {
    articles.forEach((article) => {
      article.hidden = false;
      _toggleDivider(article, false);
    });
    if (noResults) noResults.hidden = true;
    return;
  }

  const words = q.split(/\s+/).filter(Boolean);
  let visibleCount = 0;

  articles.forEach((article) => {
    const text = (article.textContent + ' ' + (article.dataset.tags ?? '')).toLowerCase();

    // All words must match — AND logic
    const matches = words.every((word) => text.includes(word));

    article.hidden = !matches;
    _toggleDivider(article, !matches);

    if (matches) visibleCount++;
  });

  if (noResults) noResults.hidden = visibleCount > 0;
  if (noResultsQ) noResultsQ.textContent = query;
}

/**
 * Shows or hides the <hr class="article-divider"> that immediately follows
 * an article element.
 *
 * @param {Element} article
 * @param {boolean} hidden
 */
function _toggleDivider(article, hidden) {
  const divider = article.nextElementSibling;
  if (divider?.classList.contains('article-divider')) {
    divider.hidden = hidden;
  }
}

/**
 * Mounts all search-related event listeners.
 *
 * @param {{
 *   searchInput:   HTMLInputElement | null,
 *   clearBtn:      HTMLElement | null,
 *   noResults:     HTMLElement | null,
 *   noResultsQ:    HTMLElement | null,
 *   articles:      Element[],
 *   debounce:      (fn: Function, wait: number) => Function,
 * }} opts
 */
export function initSearch({ searchInput, clearBtn, noResults, noResultsQ, articles, debounce }) {
  if (!searchInput) return;

  const debouncedFilter = debounce(
    (value) => filterArticles(value, articles, noResults, noResultsQ),
    280
  );

  searchInput.addEventListener('input', (e) => debouncedFilter(e.target.value));

  // Clear button inside the no-results card
  clearBtn?.addEventListener('click', () => {
    searchInput.value = '';
    filterArticles('', articles, noResults, noResultsQ);
  });

  // Enter key — scroll to the first visible result
  searchInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const firstVisible = articles.find((a) => !a.hidden);
    if (firstVisible) {
      firstVisible.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}
