/**
 * @module Semester
 * @description A named container for Course objects.
 *
 * PATTERNS DEMONSTRATED:
 * - Generator function* with [Symbol.iterator] — makes Semester natively iterable
 * - Immutable mutation API — addCourse/removeCourse/updateCourse each return a NEW Semester
 * - Defensive copy — get courses() returns a spread to prevent mutation of internal array
 * - Computed getters — gpa, totalCreditUnits derived from courses, no duplication of truth
 */

import { Course } from './Course.js';
import { ValidationError } from './AppError.js';
import { validateSemesterLabel } from '../utils/validators.js';

export class Semester {
  #id;
  #label;
  #courses;
  #createdAt;

  constructor({ id, label, courses = [], createdAt } = {}) {
    const check = validateSemesterLabel(label);
    if (!check.valid) throw new ValidationError(check.message, 'label');

    this.#id = id ?? crypto.randomUUID();
    this.#label = label.trim();
    this.#courses = courses.map((c) => (c instanceof Course ? c : Course.fromJSON(c)));
    this.#createdAt = createdAt ?? Date.now();
  }

  // ── Getters ────────────────────────────────────────────────────────
  get id() {
    return this.#id;
  }
  get label() {
    return this.#label;
  }
  get createdAt() {
    return this.#createdAt;
  }
  get courseCount() {
    return this.#courses.length;
  }

  /** Defensive copy — callers cannot mutate the internal array */
  get courses() {
    return [...this.#courses];
  }

  get totalCreditUnits() {
    return this.#courses.reduce((s, c) => s + c.creditUnits, 0);
  }
  get totalQualityPoints() {
    return this.#courses.reduce((s, c) => s + c.qualityPoints, 0);
  }

  /** Semester GPA = Σ(qualityPoints) / Σ(creditUnits) */
  get gpa() {
    return this.totalCreditUnits === 0 ? 0 : this.totalQualityPoints / this.totalCreditUnits;
  }

  // ── Immutable mutations ────────────────────────────────────────────

  addCourse(course) {
    return new Semester({
      ...this.toJSON(),
      courses: [...this.#courses.map((c) => c.toJSON()), course.toJSON()],
    });
  }

  removeCourse(courseId) {
    return new Semester({
      ...this.toJSON(),
      courses: this.#courses.filter((c) => c.id !== courseId).map((c) => c.toJSON()),
    });
  }

  updateCourse(courseId, changes) {
    return new Semester({
      ...this.toJSON(),
      courses: this.#courses.map((c) =>
        c.id === courseId ? c.with(changes).toJSON() : c.toJSON()
      ),
    });
  }

  getCourse(id) {
    return this.#courses.find((c) => c.id === id);
  }

  // ── Generator / Symbol.iterator ────────────────────────────────────
  /**
   * Generator function* — yields courses one at a time.
   * This is how for...of, spread [...semester], and destructuring work.
   *
   * @example
   * for (const course of semester) renderRow(course);
   * const [first] = semester;
   */
  *[Symbol.iterator]() {
    for (const course of this.#courses) yield course;
  }

  // ── Factory / Serialisation ────────────────────────────────────────

  static fromJSON(obj) {
    return new Semester(obj);
  }

  toJSON() {
    return {
      id: this.#id,
      label: this.#label,
      courses: this.#courses.map((c) => c.toJSON()),
      createdAt: this.#createdAt,
    };
  }

  toString() {
    return `[Semester "${this.#label}" | GPA: ${this.gpa.toFixed(2)} | ${this.courseCount} courses]`;
  }
}
