/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScoreField } from '@/components/dashboard/fields/ScoreField.js';

function makeContainer() {
  return document.createElement('div');
}

describe('ScoreField', () => {
  describe('construction', () => {
    it('throws when container is not an Element', () => {
      expect(() => new ScoreField(null, {})).toThrow(TypeError);
    });

    it('constructs without options', () => {
      expect(() => new ScoreField(makeContainer())).not.toThrow();
    });
  });

  describe('getValue()', () => {
    it('returns null when input is empty', () => {
      const field = new ScoreField(makeContainer());
      field.mount();
      expect(field.getValue()).toBeNull();
    });

    it('returns the numeric value of the input', () => {
      const field = new ScoreField(makeContainer());
      field.mount();
      field._scoreInput.value = '72';
      expect(field.getValue()).toBe(72);
    });

    it('returns the initialScore when provided', () => {
      const field = new ScoreField(makeContainer(), { initialScore: 85 });
      field.mount();
      expect(field.getValue()).toBe(85);
    });

    it('returns null for non-numeric input', () => {
      const field = new ScoreField(makeContainer());
      field.mount();
      field._scoreInput.value = 'abc';
      expect(field.getValue()).toBeNull();
    });
  });

  describe('reset()', () => {
    it('clears the input value', () => {
      const field = new ScoreField(makeContainer(), { initialScore: 75 });
      field.mount();
      field.reset();
      expect(field._scoreInput.value).toBe('');
    });

    it('clears the grade preview letter', () => {
      const field = new ScoreField(makeContainer(), { initialScore: 75 });
      field.mount();
      field.reset();
      expect(field._gradeLetter.textContent).toBe('—');
    });

    it('resets getValue() to null after reset', () => {
      const field = new ScoreField(makeContainer(), { initialScore: 75 });
      field.mount();
      field.reset();
      expect(field.getValue()).toBeNull();
    });
  });

  describe('setError()', () => {
    it('adds input--error class when hasError is true', () => {
      const field = new ScoreField(makeContainer());
      field.mount();
      field.setError(true);
      expect(field._scoreInput.classList.contains('input--error')).toBe(true);
    });

    it('removes input--error class when hasError is false', () => {
      const field = new ScoreField(makeContainer());
      field.mount();
      field.setError(true);
      field.setError(false);
      expect(field._scoreInput.classList.contains('input--error')).toBe(false);
    });
  });

  describe('onScoreChange callback', () => {
    it('fires with the numeric score on input event', () => {
      const onScoreChange = vi.fn();
      const field = new ScoreField(makeContainer(), { onScoreChange });
      field.mount();

      field._scoreInput.value = '68';
      field._scoreInput.dispatchEvent(new Event('input'));

      expect(onScoreChange).toHaveBeenCalledWith(68);
    });

    it('fires with null when the input is cleared', () => {
      const onScoreChange = vi.fn();
      const field = new ScoreField(makeContainer(), { initialScore: 68, onScoreChange });
      field.mount();

      field._scoreInput.value = '';
      field._scoreInput.dispatchEvent(new Event('input'));

      expect(onScoreChange).toHaveBeenCalledWith(null);
    });
  });

  describe('live preview', () => {
    it('shows grade letter after mount with initialScore', () => {
      const field = new ScoreField(makeContainer(), { initialScore: 75 });
      field.mount();
      // Score 75 is grade A on 5.0 scale
      expect(field._gradeLetter.textContent).toBe('A');
    });

    it('updates grade card class when score changes', () => {
      const field = new ScoreField(makeContainer());
      field.mount();
      field._scoreInput.value = '65';
      field._scoreInput.dispatchEvent(new Event('input'));
      // Score 65 → grade B
      expect(field._gradeCard.className).toContain('cf-grade-card--B');
    });
  });

  describe('unmount()', () => {
    it('clears the container DOM', () => {
      const container = makeContainer();
      const field = new ScoreField(container);
      field.mount();
      expect(container.children.length).toBeGreaterThan(0);
      field.unmount();
      expect(container.children.length).toBe(0);
    });

    it('allows re-mount after unmount', () => {
      const field = new ScoreField(makeContainer());
      field.mount();
      field.unmount();
      expect(() => field.mount()).not.toThrow();
    });
  });
});
