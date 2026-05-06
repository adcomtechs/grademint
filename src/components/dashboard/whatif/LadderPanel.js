/**
 * @module LadderPanel
 * @description Renders the honour classification ladder.
 *
 * Shows every tier with the gap from the student's current CGPA,
 * marks the current position, and marks achieved tiers.
 */

import { BaseComponent } from '../../common/BaseComponent.js';
import { GPACalculatorService } from '../../../services/GPACalculatorService.js';
import { Semester } from '../../../domain/Semester.js';
import { createElement } from '../../../utils/dom.js';
import { watchState } from '../../../utils/selector.js';
import { DEFAULT_SCALE_ID } from '../../../utils/constants.js';
import { getScale } from '../../../utils/helpers.js';

export class LadderPanel extends BaseComponent {
  constructor(container, store) {
    super(container, store);
  }

  afterMount() {
    const unsub = watchState(
      this.store,
      (s) => [s.semesters, s.student, s.previousRecord],
      () => this.safeRender()
    );
    this.addSubscription(unsub);
  }

  render() {
    const state = this.store.getState();
    const semesters = (state.semesters ?? []).map(Semester.fromJSON);
    const scaleId = state.student?.scaleId ?? DEFAULT_SCALE_ID;
    const scale = getScale(scaleId);
    const cgpa = GPACalculatorService.cgpaWithPreviousRecord(semesters, state.previousRecord);

    this.container.innerHTML = '';
    this.container.append(this._build(cgpa, scale));
  }

  _build(cgpa, scale) {
    const honors = [...scale.honors].sort((a, b) => b.min - a.min);
    const current = honors.find((h) => cgpa >= h.min);

    const rungs = honors.map((h, i) => {
      const nextTier = i > 0 ? honors[i - 1] : null;
      const rangeMax = nextTier ? (nextTier.min - 0.001).toFixed(2) : scale.maxGPA.toFixed(2);
      const isCurrent = h.label === current?.label;
      const isAchieved = cgpa >= h.min && !isCurrent;
      const gap = h.min - cgpa;

      const cls = ['wi-rung', isCurrent ? 'is-current' : '', isAchieved ? 'is-achieved' : '']
        .filter(Boolean)
        .join(' ');

      const gapEl = isCurrent
        ? null
        : gap > 0
          ? createElement('span', { className: 'wi-rung-gap is-positive' }, `+${gap.toFixed(3)}`)
          : createElement('span', { className: 'wi-rung-gap is-achieved' }, '✓');

      return createElement(
        'div',
        { className: cls },
        createElement('span', { className: `wi-rung-badge ${h.cssClass}` }, h.badge),
        createElement(
          'div',
          { className: 'wi-rung-body' },
          createElement('div', { className: `wi-rung-label ${h.cssClass}` }, h.label),
          createElement('div', { className: 'wi-rung-range' }, `${h.min.toFixed(2)} – ${rangeMax}`)
        ),
        gapEl,
        isCurrent ? createElement('span', { className: 'wi-rung-marker' }, 'You are here') : null
      );
    });

    const card = createElement('div', { className: 'wi-card' });
    card.append(
      createElement('h3', { className: 'wi-section-title' }, '🏛 Classification Ladder'),
      createElement('div', { className: 'wi-ladder' }, ...rungs)
    );
    return card;
  }
}
