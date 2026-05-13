/**
 * @module HeaderView
 * @description Reusable application header shell.
 *
 * HeaderView owns the header markup for both the dashboard app and docs page.
 * It renders a consistent brand, SVG logo mark, navigation links, optional
 * dashboard actions, and the reactive student-name context.
 *
 * ── STACKING CONTEXT FIX (scrim placement) ────────────────────────────────
 * The scrim MUST be a sibling of .header-menu-panel, NOT a child.
 *
 * WHY THIS MATTERS:
 * .header-menu-panel has `position: fixed; z-index: 150`. That combination
 * creates an independent stacking context. Any child with an explicit
 * positive z-index is evaluated WITHIN that stacking context — not at the
 * document level. Concretely:
 *
 *   panel (stacking context)
 *     ├─ scrim (z-index: 149 within panel's context)  ← ABOVE nav content (auto)
 *     └─ header-menu-content (z-index: auto)           ← BELOW scrim → unclickable
 *
 * With the scrim inside the panel, every click on a nav link lands on the
 * scrim first — navigation never fires and the menu closes immediately.
 * The toggle button is similarly blocked: the scrim's `inset: 0` covers
 * the full viewport so the toggle is never the topmost hit target.
 *
 * CORRECT STRUCTURE:
 *   header.app-header  (stacking context: z-index 100)
 *     ├─ button.header-menu-toggle  (z-index: auto)
 *     ├─ div.header-menu-scrim      (position: fixed; z-index: 149 ← within HEADER's context)
 *     └─ div.header-menu-panel      (position: fixed; z-index: 150 ← own stacking context)
 *           └─ div.header-menu-content
 *                 └─ nav.header-nav  (z-index: auto ← nothing blocks it)
 *
 * With scrim as a sibling:
 *   - Panel (150) > scrim (149) in the HEADER's context → clicks inside the
 *     panel reach nav links, not the scrim ✓
 *   - Scrim uses `top: var(--header-h)` so it never covers the header bar →
 *     the toggle button is always reachable ✓
 *   - Clicks in the content area hit the scrim (149) which closes the menu ✓
 * ──────────────────────────────────────────────────────────────────────────
 */

import { clearElement, createElement } from '@/utils/dom.js';
import { watchState } from '@/utils/selector.js';

const DASHBOARD_NAV = Object.freeze([
  { label: 'What-If', href: '#whatif', view: 'whatif' },
  { label: 'Documentation', href: '/docs.html' },
]);

const DOCS_NAV = Object.freeze([
  { label: 'Calculator', href: '/' },
  { label: 'Documentation', href: '/docs.html', active: true },
]);

export class HeaderView {
  /**
   * @param {HTMLElement} container
   * @param {{
   *   store?: ReturnType<import('../../core/Store.js').createStore>|null,
   *   variant?: 'dashboard'|'docs',
   *   activeView?: string,
   *   showActions?: boolean,
   * }} [options]
   */
  constructor(container, options = {}) {
    if (!(container instanceof HTMLElement)) {
      throw new TypeError('HeaderView: container must be an HTMLElement.');
    }

    this.container = container;
    this.store = options.store ?? null;
    this.variant = options.variant ?? 'dashboard';
    this.activeView = options.activeView ?? (this.variant === 'docs' ? 'docs' : 'dashboard');
    this.showActions = options.showActions ?? this.variant === 'dashboard';
    this._unsub = null;
    this._ctrl = null;
    this._menuOpen = false;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  mount() {
    this.unmount();
    this.render();
    this._syncStudentName(this.store?.getState().student?.name ?? '');

    if (!this.store) return;

    this._unsub = watchState(
      this.store,
      (s) => s.student?.name,
      () => this._syncStudentName(this.store.getState().student?.name ?? '')
    );
  }

  unmount() {
    this._unsub?.();
    this._unsub = null;
    this._closeMenu();
    this._ctrl?.abort();
    this._ctrl = null;
  }

  render() {
    clearElement(this.container);
    this.container.className = 'app-header';
    this._ctrl?.abort();
    this._ctrl = new AbortController();

    const inner = createElement(
      'div',
      { className: 'header-inner' },
      createElement('div', { className: 'header-left' }, this._buildBrand()),
      this._buildMenuToggle(),
      // ── SCRIM IS A SIBLING OF THE PANEL, NOT A CHILD ──────────────────────
      // See module-level JSDoc for the full explanation.
      // The scrim must be at this level so its z-index is evaluated in the
      // header's stacking context, where:
      //   scrim (149) < panel (150) → nav links are above the scrim ✓
      //   scrim top: var(--header-h) → toggle button is never covered ✓
      createElement('div', { className: 'header-menu-scrim', 'aria-hidden': 'true' }),
      this._buildMenuPanel()
    );

    this.container.append(inner);
    this._bindMenu();
  }

  // ── Builders ───────────────────────────────────────────────────────────────

  _buildBrand() {
    return createElement(
      'a',
      { href: '/', className: 'brand', 'aria-label': 'GradeMint home' },
      _buildLogoMark(),
      createElement('span', { className: 'brand-name' }, 'GPA', createElement('span', {}, 'Pro'))
    );
  }

  _buildNav() {
    const items = this.variant === 'docs' ? DOCS_NAV : DASHBOARD_NAV;

    return createElement(
      'nav',
      { className: 'header-nav', 'aria-label': 'Main navigation' },
      items.map((item) => {
        const isActive = item.active || item.view === this.activeView;
        const attrs = {
          href: item.href,
          className: `nav-link${isActive ? ' is-active' : ''}`,
          'aria-current': isActive ? 'page' : 'false',
        };
        if (item.view) attrs.dataset = { view: item.view };
        return createElement('a', attrs, item.label);
      })
    );
  }

  _buildActions() {
    return createElement(
      'div',
      { className: 'header-actions' },
      createElement(
        'div',
        { className: 'header-context' },
        createElement('span', { id: 'header-student-name', className: 'header-student-name' })
      ),
      createElement(
        'div',
        { className: 'header-group' },
        createElement(
          'button',
          { className: 'btn btn--ghost btn--sm', id: 'btn-export' },
          'Export'
        ),
        createElement(
          'button',
          { className: 'btn btn--ghost btn--sm', id: 'btn-settings' },
          'Settings'
        )
      ),
      createElement(
        'div',
        { className: 'header-group' },
        createElement(
          'button',
          { className: 'btn btn--primary btn--sm', id: 'btn-add-semester' },
          '+ Semester'
        )
      )
    );
  }

  _buildMenuToggle() {
    return createElement(
      'button',
      {
        type: 'button',
        className: 'header-menu-toggle',
        'aria-label': 'Open menu',
        'aria-expanded': 'false',
        'aria-controls': 'header-menu-panel',
      },
      createElement(
        'span',
        { className: 'header-menu-icon', 'aria-hidden': 'true' },
        createElement('span', {}),
        createElement('span', {}),
        createElement('span', {})
      ),
      createElement('span', { className: 'header-menu-text' }, 'Menu')
    );
  }

  /**
   * Builds the sliding panel / dropdown that contains nav links and actions.
   *
   * NOTE: The scrim is NOT included here. It is rendered as a sibling element
   * in render(). See the module-level JSDoc for a full explanation.
   */
  _buildMenuPanel() {
    const children = [this._buildNav()];
    if (this.showActions) children.push(this._buildActions());

    return createElement(
      'div',
      {
        className: 'header-menu-panel',
        id: 'header-menu-panel',
      },
      // No scrim child here — it lives as a sibling in the DOM tree.
      createElement('div', { className: 'header-menu-content' }, children)
    );
  }

  // ── Menu behaviour ─────────────────────────────────────────────────────────

  _bindMenu() {
    const toggle = this.container.querySelector('.header-menu-toggle');
    const panel = this.container.querySelector('.header-menu-panel');
    const scrim = this.container.querySelector('.header-menu-scrim');

    if (!toggle || !panel) return;

    // Toggle open / closed
    toggle.addEventListener('click', () => this._setMenuOpen(!this._menuOpen), {
      signal: this._ctrl.signal,
    });

    // Scrim click closes the menu — the scrim now starts at top: var(--header-h)
    // so it never intercepts clicks on the toggle or the panel's nav links.
    scrim?.addEventListener('click', () => this._closeMenu(), {
      signal: this._ctrl.signal,
    });

    // Panel clicks:
    // – Nav links (a[data-view]): let ViewRouter's handler fire first, then close.
    // – External links:           close after navigation.
    // – Action buttons:           close after the button's own handler fires.
    // All closures are deferred via setTimeout(0) so any synchronous handler
    // on the target element (e.g. ViewRouter's navigate()) runs first.
    panel.addEventListener(
      'click',
      (event) => {
        const link = event.target.closest('a');
        const button = event.target.closest('button');

        if (link) {
          // Both internal and external links get the same close-after treatment.
          // setTimeout(0) ensures ViewRouter's click listener fires before close.
          setTimeout(() => this._closeMenu(), 0);
          return;
        }

        if (button && !button.classList.contains('header-menu-toggle')) {
          setTimeout(() => this._closeMenu(), 0);
        }
      },
      { signal: this._ctrl.signal }
    );

    // Escape key always closes
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') this._closeMenu();
      },
      { signal: this._ctrl.signal }
    );
  }

  _setMenuOpen(open) {
    this._menuOpen = open;
    this.container.classList.toggle('is-menu-open', open);
    document.body.classList.toggle('no-scroll', open);

    const toggle = this.container.querySelector('.header-menu-toggle');
    toggle?.setAttribute('aria-expanded', String(open));
    toggle?.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  _closeMenu() {
    if (!this._menuOpen) return;
    this._setMenuOpen(false);
  }

  // ── Reactive state ─────────────────────────────────────────────────────────

  _syncStudentName(name) {
    const el = this.container.querySelector('#header-student-name');
    if (!el) return;
    el.textContent = name ? `— ${name}` : '';
  }
}

// ── Logo SVG (private) ─────────────────────────────────────────────────────

function _buildLogoMark() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'brand-mark');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'GradeMint logo');

  const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  title.textContent = 'GradeMint logo';

  const crest = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  crest.setAttribute('d', 'M24 4 7 12v12c0 10.4 7.1 16.7 17 20 9.9-3.3 17-9.6 17-20V12L24 4Z');
  crest.setAttribute('class', 'brand-mark-crest');

  const cap = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  cap.setAttribute('d', 'M12 20 24 13l12 7-12 7-12-7Z');
  cap.setAttribute('class', 'brand-mark-cap');

  const band = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  band.setAttribute('d', 'M17 24v5c3.8 2.8 10.2 2.8 14 0v-5');
  band.setAttribute('class', 'brand-mark-line');

  const tassel = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  tassel.setAttribute('d', 'M34 21v7m0 0 3 4');
  tassel.setAttribute('class', 'brand-mark-line');

  svg.append(title, crest, cap, band, tassel);
  return svg;
}
