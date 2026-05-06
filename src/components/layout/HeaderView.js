/**
 * @module HeaderView
 * @description Reusable application header shell.
 *
 * HeaderView owns the header markup for both the dashboard app and docs page.
 * It renders a consistent brand, SVG logo mark, navigation links, optional
 * dashboard actions, and the reactive student-name context.
 */

import { clearElement, createElement } from '@/utils/dom.js';
import { watchState } from '@/utils/selector.js';

const DASHBOARD_NAV = Object.freeze([
  { label: 'Dashboard', href: '#dashboard', view: 'dashboard' },
  { label: 'Analytics', href: '#analytics', view: 'analytics' },
  { label: 'Transcript', href: '#transcript', view: 'transcript' },
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
  }

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
  }

  render() {
    clearElement(this.container);
    this.container.className = 'app-header';

    const inner = createElement(
      'div',
      { className: 'header-inner' },
      createElement(
        'div',
        { className: 'header-left' },
        this._buildBrand(),
        this._buildNav()
      )
    );

    if (this.showActions) {
      inner.append(this._buildActions());
    }

    this.container.append(inner);
  }

  _buildBrand() {
    return createElement(
      'a',
      { href: '/', className: 'brand', 'aria-label': 'GPA Pro home' },
      _buildLogoMark(),
      createElement(
        'span',
        { className: 'brand-name' },
        'GPA',
        createElement('span', {}, 'Pro')
      )
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
        createElement('button', { className: 'btn btn--ghost btn--sm', id: 'btn-export' }, 'Export'),
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

  _syncStudentName(name) {
    const el = this.container.querySelector('#header-student-name');
    if (!el) return;
    el.textContent = name ? `— ${name}` : '';
  }
}

function _buildLogoMark() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'brand-mark');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'GPA Pro logo');

  const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  title.textContent = 'GPA Pro logo';

  const crest = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  crest.setAttribute(
    'd',
    'M24 4 7 12v12c0 10.4 7.1 16.7 17 20 9.9-3.3 17-9.6 17-20V12L24 4Z'
  );
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
