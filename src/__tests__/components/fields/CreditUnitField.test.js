/**
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { CreditUnitField } from '@/components/dashboard/fields/CreditUnitField.js';
import { CREDIT_UNITS } from '@/utils/constants.js';

function makeField(opts = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  const field = new CreditUnitField(container, opts);
  field.mount();
  return { field, container };
}

describe('CreditUnitField', () => {
  describe('initial render', () => {
    it('renders a pill for each available unit', () => {
      const { container } = makeField();
      const pills = container.querySelectorAll('.cf-cu-pill');
      expect(pills.length).toBe(CREDIT_UNITS.length);
    });

    it('marks the initialValue pill as selected', () => {
      const { container } = makeField({ initialValue: 4 });
      const selectedPill = container.querySelector('.cf-cu-pill.is-selected');
      expect(selectedPill?.querySelector('input')?.value).toBe('4');
    });

    it('defaults to 3 when no initialValue is provided', () => {
      const { field } = makeField();
      expect(field.getValue()).toBe(3);
    });
  });

  describe('getValue()', () => {
    it('returns the initialValue immediately', () => {
      const { field } = makeField({ initialValue: 2 });
      expect(field.getValue()).toBe(2);
    });

    it('returns updated value after radio change event', () => {
      const { field, container } = makeField({ initialValue: 3 });
      const radio6 = container.querySelector('input[value="6"]');
      radio6.checked = true;
      radio6.dispatchEvent(new Event('change'));
      expect(field.getValue()).toBe(6);
    });
  });

  describe('reset()', () => {
    it('returns getValue() to 3 after reset regardless of initialValue', () => {
      const { field } = makeField({ initialValue: 6 });
      field.reset();
      expect(field.getValue()).toBe(3);
    });

    it('checks the 3-unit radio after reset', () => {
      const { field, container } = makeField({ initialValue: 6 });
      field.reset();
      const radio3 = container.querySelector('input[value="3"]');
      expect(radio3.checked).toBe(true);
    });

    it('marks only the 3-unit pill as selected after reset', () => {
      const { field, container } = makeField({ initialValue: 6 });
      field.reset();
      const selected = [...container.querySelectorAll('.cf-cu-pill.is-selected')];
      expect(selected).toHaveLength(1);
      expect(selected[0].querySelector('input').value).toBe('3');
    });
  });

  describe('unmount()', () => {
    it('clears the container', () => {
      const { field, container } = makeField();
      field.unmount();
      expect(container.children.length).toBe(0);
    });

    it('allows re-mount', () => {
      const { field } = makeField();
      field.unmount();
      expect(() => field.mount()).not.toThrow();
    });
  });

  describe('with custom availableUnits', () => {
    it('renders only the specified units', () => {
      const { container } = makeField({ availableUnits: [1, 2, 3] });
      expect(container.querySelectorAll('.cf-cu-pill').length).toBe(3);
    });
  });
});
