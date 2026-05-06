/**
 * @module TranscriptView
 * @description Full academic transcript view orchestration. Section renderers live
 * in ./transcript/* and visual styling lives in src/styles/transcript.css.
 */

import { BaseComponent } from '../common/BaseComponent.js';
import { Semester } from '@/domain/Semester.js';
import { GPACalculatorService } from '@/services/GPACalculatorService.js';
import { createElement, clearElement } from '@/utils/dom.js';
import { DEFAULT_SCALE_ID } from '@/utils/constants.js';
import { getScale } from '@/utils/helpers.js';
import { _computeRunningCGPAs } from './transcript/transcriptHelpers.js';
import { transcriptActionBarMethods } from './transcript/actionBar.js';
import { transcriptHeaderMethods } from './transcript/header.js';
import { transcriptAnalyticsMethods } from './transcript/analyticsSections.js';
import { transcriptSemesterMethods } from './transcript/semesterSections.js';
import { transcriptDocumentEndMethods } from './transcript/documentEndSections.js';

export class TranscriptView extends BaseComponent {
  /**
   * @param {HTMLElement} container
   * @param {ReturnType<import('../../core/Store.js').createStore>} store
   */
  constructor(container, store) {
    super(container, store);
    this._docId = `TRX-${Date.now().toString(36).toUpperCase()}`;
    this._issuedAt = Date.now();
  }

  afterMount() {
    const unsub = this.store.subscribe(({ state, prevState }) => {
      const changed =
        JSON.stringify(state.semesters) !== JSON.stringify(prevState?.semesters) ||
        JSON.stringify(state.student) !== JSON.stringify(prevState?.student) ||
        JSON.stringify(state.previousRecord) !== JSON.stringify(prevState?.previousRecord);

      if (changed && !this.container.hidden) this.render();
    });
    this.addSubscription(unsub);
  }

  render() {
    const state = this.store.getState();
    const semesters = state.semesters.map(Semester.fromJSON);
    const student = state.student ?? {};
    const scaleId = student.scaleId ?? DEFAULT_SCALE_ID;
    const scale = getScale(scaleId);
    const allCourses = semesters.flatMap((s) => s.courses);

    const cgpa = GPACalculatorService.cgpaWithPreviousRecord(semesters, state.previousRecord);
    const honor = GPACalculatorService.getHonorClassification(cgpa, scaleId);
    const stats = GPACalculatorService.aggregateStats(semesters);
    const trend = GPACalculatorService.buildTrend(semesters);
    const dist = GPACalculatorService.gradeDistribution(allCourses);

    clearElement(this.container);

    const root = createElement('div', { className: 'tv-root' });
    root.append(this._buildActionBar(stats));

    const doc = createElement('div', { className: 'tv-document' });
    doc.append(this._buildDocHeader(student, scale, cgpa, honor, stats));
    doc.append(this._buildProgStrip(cgpa, stats, scale, semesters));

    if (semesters.length === 0) {
      doc.append(this._buildEmpty());
      root.append(doc);
      this.container.append(root);
      return;
    }

    if (trend.length >= 2) doc.append(this._buildGPATimeline(trend, scale));
    if (allCourses.length > 0)
      doc.append(this._buildGradeDistribution(dist, scale, allCourses.length));

    doc.append(this._buildSummaryBar(cgpa, stats, honor, scale));

    const body = createElement('div', { className: 'tv-body' });
    const runningCGPAs = _computeRunningCGPAs(semesters, state.previousRecord);

    semesters.forEach((sem, idx) => {
      body.append(this._buildSemesterBlock(sem, idx, scaleId, scale, runningCGPAs[idx]));
    });

    if (state.previousRecord?.creditUnits > 0) {
      body.append(this._buildPreviousRecord(state.previousRecord));
    }

    doc.append(body);
    doc.append(this._buildCertification(student, cgpa, honor, scale, semesters.length, stats));
    doc.append(this._buildFooter(cgpa, honor, scale, semesters.length, stats));
    doc.append(this._buildAuthStrip(student, cgpa));

    root.append(doc);
    this.container.append(root);
  }
}

Object.assign(
  TranscriptView.prototype,
  transcriptActionBarMethods,
  transcriptHeaderMethods,
  transcriptAnalyticsMethods,
  transcriptSemesterMethods,
  transcriptDocumentEndMethods
);
