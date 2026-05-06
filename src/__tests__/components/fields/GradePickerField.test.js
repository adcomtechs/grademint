/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GradePickerField } from '@/components/dashboard/fields/GradePickerField.js';

function makeField(opts = {}) {
  const container = document.createElement('div');
  document.body.append(container); // needs to be in DOM for click events
  const field = new GradePickerField(container, { scaleId: '5.0', ...opts });
  field.mount();
  return { field, container };
}

describe('GradePickerField', () => {
  describe('getValue()', () => {
    it('returns null before any selection', () => {
      const { field } = makeField();
      expect(field.getValue()).toBeNull();
    });

    it('returns the initialGrade immediately after mount', () => {
      const { field } = makeField({ initialGrade: 'B' });
      expect(field.getValue()).toBe('B');
    });

    it('returns the selected letter after a click', () => {
      const { field } = makeField();
      const btnA = field._buttons.find((b) => b.dataset.grade === 'A');
      btnA.click();
      expect(field.getValue()).toBe('A');
    });

    it('updates to the new selection on re-click', () => {
      const { field } = makeField();
      field._buttons.find((b) => b.dataset.grade === 'A').click();
      field._buttons.find((b) => b.dataset.grade === 'C').click();
      expect(field.getValue()).toBe('C');
    });
  });

  describe('reset()', () => {
    it('clears the selected grade', () => {
      const { field } = makeField({ initialGrade: 'A' });
      field.reset();
      expect(field.getValue()).toBeNull();
    });

    it('removes is-selected from all buttons', () => {
      const { field } = makeField({ initialGrade: 'A' });
      field.reset();
      const selected = field._buttons.filter((b) => b.classList.contains('is-selected'));
      expect(selected).toHaveLength(0);
    });

    it('removes is-suggested from all buttons', () => {
      const { field } = makeField();
      field.suggestGrade('B');
      field.reset();
      const suggested = field._buttons.filter((b) => b.classList.contains('is-suggested'));
      expect(suggested).toHaveLength(0);
    });
  });

  describe('suggestGrade()', () => {
    it('adds is-suggested to the matching button', () => {
      const { field } = makeField();
      field.suggestGrade('B');
      const btnB = field._buttons.find((b) => b.dataset.grade === 'B');
      expect(btnB.classList.contains('is-suggested')).toBe(true);
    });

    it('removes is-suggested from previously suggested button', () => {
      const { field } = makeField();
      field.suggestGrade('A');
      field.suggestGrade('B');
      const btnA = field._buttons.find((b) => b.dataset.grade === 'A');
      expect(btnA.classList.contains('is-suggested')).toBe(false);
    });

    it('clears all suggestions when called with null', () => {
      const { field } = makeField();
      field.suggestGrade('A');
      field.suggestGrade(null);
      const suggested = field._buttons.filter((b) => b.classList.contains('is-suggested'));
      expect(suggested).toHaveLength(0);
    });

    it('does not change the selected grade', () => {
      const { field } = makeField({ initialGrade: 'A' });
      field.suggestGrade('B');
      expect(field.getValue()).toBe('A');
    });
  });

  describe('setError()', () => {
    it('adds field--error class to container when true', () => {
      const { field, container } = makeField();
      field.setError(true);
      expect(container.classList.contains('field--error')).toBe(true);
    });

    it('removes field--error class when false', () => {
      const { field, container } = makeField();
      field.setError(true);
      field.setError(false);
      expect(container.classList.contains('field--error')).toBe(false);
    });
  });

  describe('unmount()', () => {
    it('clears container and allows re-mount', () => {
      const { field, container } = makeField();
      field.unmount();
      expect(container.children.length).toBe(0);
      expect(() => field.mount()).not.toThrow();
    });
  });
});
