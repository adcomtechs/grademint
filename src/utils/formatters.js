/**
 * @module formatters
 * @description Pure formatting utilities.
 *
 * safeHTML is a Tagged Template Literal — a function used as a template tag.
 * It escapes all interpolated values, preventing XSS injection attacks.
 * This is the same technique used by lit-html and styled-components.
 *
 * Usage:  safeHTML`<p>Hello, ${userInput}!</p>`
 */

export const formatGPA = (gpa) =>
  Number.isFinite(gpa) ? Number(gpa).toFixed(2) : '0.00';

export const formatScore = (score) => `${Number(score).toFixed(1)}`;

export const formatDate = (date) =>
  new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(date));

export const formatShortDate = (date) =>
  new Intl.DateTimeFormat('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })
    .format(new Date(date));

export const toOrdinal = (n) => {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
};

export const pluralise = (count, singular, plural = `${singular}s`) =>
  count === 1 ? singular : plural;

/**
 * Tagged Template Literal — escapes HTML entities in all dynamic values.
 * @param {TemplateStringsArray} strings
 * @param {...*} values
 */
export function safeHTML(strings, ...values) {
  const escape = (v) =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  return strings.reduce((out, str, i) => out + str + (values[i] !== undefined ? escape(values[i]) : ''), '');
}
