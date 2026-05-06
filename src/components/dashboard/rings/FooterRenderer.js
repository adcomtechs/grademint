/**
 * @module FooterRenderer
 * @description Renders the hero footer row.
 *
 * Writes to:
 *   #hero-class-badge  — classification badge span
 *   #hero-trend        — trend direction indicator
 *   #hero-scope        — "∑ All Semesters" / "❑ This Semester" pill
 *   #record-meta       — "N semesters" text
 *
 * Each element is written to individually by ID to avoid clearing and
 * re-building the entire footer row on every render tick, which would
 * cause visible flashes for unchanged elements.
 */

const TREND_META = Object.freeze({
  up: { icon: '↑', label: 'Improving', cls: 'trend--up' },
  down: { icon: '↓', label: 'Declining', cls: 'trend--down' },
  stable: { icon: '→', label: 'Steady', cls: 'trend--stable' },
  neutral: { icon: '—', label: 'No data yet', cls: 'trend--neutral' },
});

/**
 * @param {Semester[]} semesters
 * @param {object}     honor       result of GPACalculatorService.getHonorClassification
 * @param {string}     trend       'up' | 'down' | 'stable' | 'neutral'
 * @param {boolean}    isOverview
 */
export function renderFooter(semesters, honor, trend, isOverview) {
  _renderClassBadge(semesters, honor);
  _renderTrend(trend);
  _renderScope(semesters, isOverview);
  _renderRecordMeta(semesters);
}

// ── Private helpers ────────────────────────────────────────────────────────────

function _renderClassBadge(semesters, honor) {
  const el = document.getElementById('hero-class-badge');
  if (!el) return;

  if (semesters.length > 0 && honor) {
    el.innerHTML = `
      <span class="classification-badge ${honor.cssClass}"
            role="status" aria-label="Classification: ${honor.label}">
        <span class="class-icon" aria-hidden="true">${honor.badge}</span>
        ${honor.label}
      </span>`;
  } else if (semesters.length > 0) {
    el.innerHTML = `<span class="classification-badge grade--empty">No classification yet</span>`;
  } else {
    el.innerHTML = '';
  }
}

function _renderTrend(trend) {
  const el = document.getElementById('hero-trend');
  if (!el) return;

  const { icon, label, cls } = TREND_META[trend] ?? TREND_META.neutral;
  el.innerHTML = `
    <span class="trend-badge ${cls}" aria-label="GPA trend: ${label}">
      <span class="trend-icon" aria-hidden="true">${icon}</span>
      ${label}
    </span>`;
}

function _renderScope(semesters, isOverview) {
  const el = document.getElementById('hero-scope');
  if (!el) return;

  if (semesters.length === 0) {
    el.innerHTML = '';
    return;
  }

  const scopeLabel = isOverview ? '∑ All Semesters' : '❑ This Semester';
  const scopeCls = isOverview ? 'scope-badge--overview' : 'scope-badge--semester';
  const scopeTitle = isOverview
    ? 'Both rings and stats show your full programme totals'
    : 'Semester ring and stats show only the selected semester';

  el.innerHTML = `
    <span class="scope-badge ${scopeCls}" title="${scopeTitle}"
          aria-label="${scopeLabel}">
      ${scopeLabel}
    </span>`;
}

function _renderRecordMeta(semesters) {
  const el = document.getElementById('record-meta');
  if (!el) return;

  const n = semesters.length;
  el.textContent = n > 0 ? `${n} semester${n !== 1 ? 's' : ''}` : '';
}
