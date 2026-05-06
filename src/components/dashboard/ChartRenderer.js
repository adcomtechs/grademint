/**
 * @module ChartRenderer
 * @description Canvas 2D chart renderers styled to the Dark Academic theme.
 *
 * All methods are static — ChartRenderer is a pure rendering namespace.
 * Zero state, zero side effects, zero DOM dependencies beyond the canvas element.
 *
 * USAGE:
 *   ChartRenderer.renderTrendChart(canvas, trendData, maxGPA);
 *   ChartRenderer.renderDistributionChart(canvas, distribution, gradeOrder);
 *
 * The canvas element must already be in the DOM and have a non-zero
 * offsetWidth before calling either method. Both methods handle DPR scaling
 * for crisp rendering on Retina/HiDPI displays.
 *
 * CONSOLIDATION NOTE:
 * This file previously contained a separate visual implementation from the
 * inline Chart object inside AnalyticsPanel. The AnalyticsPanel inline version
 * was the authoritative rendered implementation — this file now matches it
 * exactly so that AnalyticsPanel can delegate chart rendering here without
 * any visual change.
 */

import { gpaColor, gradeLetterColor } from '../../utils/gpaColors.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('ChartRenderer');

export class ChartRenderer {
  constructor() {
    throw new Error('ChartRenderer is a static utility class — do not instantiate it.');
  }

  // ── GPA Trend Line Chart ───────────────────────────────────────────────────

  /**
   * Renders a smooth dual-line GPA trend chart.
   *
   * Lines:
   *   Gold  (solid)  — per-semester GPA
   *   Green (solid)  — running CGPA
   *
   * Both lines use cubic bezier interpolation for smooth curves.
   * Data points are drawn as coloured dots scaled by their classification tier.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {{ label: string, gpa: number, cgpa: number }[]} data
   * @param {number} [maxGPA=5]  Scale maximum — drives the Y-axis ceiling
   */
  static renderTrendChart(canvas, data, maxGPA = 5) {
    if (!canvas) {
      log.warn('renderTrendChart called with null canvas');
      return;
    }
    if (!data || data.length === 0) {
      log.debug('renderTrendChart called with empty data — skipping');
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 560;
    const H = canvas.offsetHeight || 200;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const PAD = { top: 16, right: 20, bottom: 40, left: 44 };
    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top - PAD.bottom;
    const step = data.length < 2 ? 1 : cW / (data.length - 1);

    const xOf = (i) => PAD.left + i * step;
    const yOf = (v) => PAD.top + cH * (1 - Math.min(v, maxGPA) / maxGPA);

    // ── Background grid ──────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    [1, 2, 3, 4, 5]
      .filter((g) => g <= maxGPA)
      .forEach((g) => {
        const y = yOf(g);
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(PAD.left + cW, y);
        ctx.stroke();

        ctx.fillStyle = 'rgba(232,226,213,0.3)';
        ctx.font = '500 9px "DM Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(g.toFixed(1), PAD.left - 6, y + 3);
      });

    // ── CGPA area fill + line ────────────────────────────────────────────────
    const cgpaGrad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + cH);
    cgpaGrad.addColorStop(0, 'rgba(168,230,207,0.18)');
    cgpaGrad.addColorStop(1, 'rgba(168,230,207,0.0)');

    const drawCurve = (getter) => {
      ctx.beginPath();
      ctx.moveTo(xOf(0), yOf(getter(data[0])));
      data.forEach((d, i) => {
        if (i === 0) return;
        const px = xOf(i - 1),
          py = yOf(getter(data[i - 1]));
        ctx.bezierCurveTo(
          px + step / 3,
          py,
          xOf(i) - step / 3,
          yOf(getter(d)),
          xOf(i),
          yOf(getter(d))
        );
      });
    };

    // CGPA fill
    drawCurve((d) => d.cgpa);
    ctx.lineTo(xOf(data.length - 1), PAD.top + cH);
    ctx.lineTo(xOf(0), PAD.top + cH);
    ctx.closePath();
    ctx.fillStyle = cgpaGrad;
    ctx.fill();

    // CGPA line
    drawCurve((d) => d.cgpa);
    ctx.strokeStyle = 'rgba(168,230,207,0.8)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.stroke();

    // ── GPA area fill + line ─────────────────────────────────────────────────
    const gpaGrad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + cH);
    gpaGrad.addColorStop(0, 'rgba(246,211,101,0.22)');
    gpaGrad.addColorStop(1, 'rgba(246,211,101,0.0)');

    drawCurve((d) => d.gpa);
    ctx.lineTo(xOf(data.length - 1), PAD.top + cH);
    ctx.lineTo(xOf(0), PAD.top + cH);
    ctx.closePath();
    ctx.fillStyle = gpaGrad;
    ctx.fill();

    drawCurve((d) => d.gpa);
    ctx.strokeStyle = 'rgba(246,211,101,0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ── Data point dots ──────────────────────────────────────────────────────
    data.forEach((d, i) => {
      const gx = xOf(i),
        gy = yOf(d.gpa);
      ctx.beginPath();
      ctx.arc(gx, gy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = ChartRenderer._gpaColor(d.gpa, 1);
      ctx.fill();
      ctx.strokeStyle = 'rgba(12,15,26,0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // ── X-axis labels ────────────────────────────────────────────────────────
    data.forEach((d, i) => {
      ctx.save();
      ctx.translate(xOf(i), PAD.top + cH + 14);
      ctx.rotate(-Math.PI / 6);
      ctx.fillStyle = 'rgba(232,226,213,0.4)';
      ctx.font = '400 8px "DM Mono", monospace';
      ctx.textAlign = 'right';
      const label = d.label.length > 14 ? d.label.slice(0, 13) + '…' : d.label;
      ctx.fillText(label, 0, 0);
      ctx.restore();
    });

    // ── Legend ───────────────────────────────────────────────────────────────
    const lx = PAD.left + 4,
      ly = PAD.top + 10;
    [
      ['rgba(246,211,101,0.85)', 'Sem GPA'],
      ['rgba(168,230,207,0.8)', 'CGPA'],
    ].forEach(([c, t], i) => {
      const ox = i * 85;
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx + ox, ly);
      ctx.lineTo(lx + ox + 18, ly);
      ctx.stroke();
      ctx.fillStyle = 'rgba(232,226,213,0.55)';
      ctx.font = '400 9px "DM Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(t, lx + ox + 22, ly + 3);
    });
  }

  // ── Grade Distribution Bar Chart ───────────────────────────────────────────

  /**
   * Renders a horizontal bar chart of grade distribution.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {Record<string, number>} distribution  e.g. { A: 5, B: 3, F: 1 }
   * @param {string[]} gradeOrder  Grade letters in display order (from scale)
   */
  static renderDistributionChart(canvas, distribution, gradeOrder) {
    if (!canvas) {
      log.warn('renderDistributionChart called with null canvas');
      return;
    }

    const entries = gradeOrder
      .filter((g) => distribution[g] !== undefined)
      .map((g) => ({ letter: g, count: distribution[g] }));

    if (!entries.length) {
      log.debug('renderDistributionChart called with empty distribution — skipping');
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 280;
    const BAR = 28;
    const GAP = 10;
    const H = entries.length * (BAR + GAP) + 32;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const PAD = { top: 12, left: 38, right: 50 };
    const maxC = Math.max(...entries.map((e) => e.count));

    entries.forEach(({ letter, count }, i) => {
      const y = PAD.top + i * (BAR + GAP);
      const bW = ((W - PAD.left - PAD.right) * count) / (maxC || 1);
      const color = ChartRenderer._gradeColor(letter);

      // Bar background track
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.beginPath();
      ctx.roundRect(PAD.left, y, W - PAD.left - PAD.right, BAR, 4);
      ctx.fill();

      // Filled portion
      if (bW > 0) {
        // Convert hex to rgba for alpha support
        const fillColor = color.startsWith('#')
          ? color + 'a6'
          : color.replace(')', ', 0.65)').replace('rgb', 'rgba');
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.roundRect(PAD.left, y, Math.max(bW, 6), BAR, 4);
        ctx.fill();
      }

      // Grade letter label
      ctx.fillStyle = color;
      ctx.font = '600 11px "DM Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, PAD.left - 6, y + BAR / 2);

      // Count label
      ctx.fillStyle = 'rgba(232,226,213,0.55)';
      ctx.font = '400 9px "DM Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`×${count}`, PAD.left + bW + 6, y + BAR / 2);
    });
  }

  /**
   * Renders the CGPA projection chart for the Semester Simulator panel.
   *
   * Draws two line segments:
   *   Gold  (solid)  — actual CGPA from real semesters
   *   Green (dashed) — projected CGPA from hypothetical semesters
   *
   * @param {HTMLCanvasElement} canvas
   * @param {{ label: string, cgpa: number, isHypo: boolean }[]} points
   * @param {number} maxGPA
   */
  static renderProjectionChart(canvas, points, maxGPA = 5) {
    if (!canvas || points.length < 2) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 400;
    const H = canvas.offsetHeight || 160;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const PAD = { top: 14, right: 16, bottom: 36, left: 42 };
    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top - PAD.bottom;
    const step = points.length < 2 ? cW : cW / (points.length - 1);

    const xOf = (i) => PAD.left + i * step;
    const yOf = (v) => PAD.top + cH * (1 - Math.min(v, maxGPA) / maxGPA);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    [1, 2, 3, 4, 5]
      .filter((g) => g <= maxGPA)
      .forEach((g) => {
        const y = yOf(g);
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(PAD.left + cW, y);
        ctx.stroke();
        ctx.fillStyle = 'rgba(232,226,213,0.28)';
        ctx.font = '400 8px "DM Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(g.toFixed(1), PAD.left - 5, y + 3);
      });

    // Split into real and hypothetical segments
    const splitIdx = points.findIndex((p) => p.isHypo);
    const realPts = splitIdx === -1 ? points : points.slice(0, splitIdx + 1);
    const hypoPts = splitIdx === -1 ? [] : points.slice(splitIdx);

    const drawCurve = (pts, offset, color, dash = []) => {
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.setLineDash(dash);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.moveTo(xOf(offset), yOf(pts[0].cgpa));
      pts.forEach((p, i) => {
        if (!i) return;
        const ox = offset + i,
          px = offset + i - 1;
        ctx.bezierCurveTo(
          xOf(px) + step / 3,
          yOf(pts[i - 1].cgpa),
          xOf(ox) - step / 3,
          yOf(p.cgpa),
          xOf(ox),
          yOf(p.cgpa)
        );
      });
      ctx.stroke();
      ctx.setLineDash([]);
    };

    drawCurve(realPts, 0, 'rgba(246,211,101,0.85)');
    if (hypoPts.length > 1) {
      drawCurve(hypoPts, splitIdx, 'rgba(168,230,207,0.8)', [5, 4]);
    }

    // Dots
    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(xOf(i), yOf(p.cgpa), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = p.isHypo ? 'rgba(168,230,207,0.9)' : 'rgba(246,211,101,0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(12,15,26,0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // X-axis labels
    points.forEach((p, i) => {
      ctx.save();
      ctx.translate(xOf(i), PAD.top + cH + 12);
      ctx.rotate(-Math.PI / 7);
      ctx.fillStyle = p.isHypo ? 'rgba(168,230,207,0.5)' : 'rgba(232,226,213,0.4)';
      ctx.font = '400 8px "DM Mono", monospace';
      ctx.textAlign = 'right';
      const lbl = p.label.length > 12 ? p.label.slice(0, 11) + '…' : p.label;
      ctx.fillText(lbl, 0, 0);
      ctx.restore();
    });

    // Legend
    const L = PAD.left + 4,
      LY = PAD.top + 8;
    [
      ['rgba(246,211,101,0.85)', 'Actual', []],
      ['rgba(168,230,207,0.8)', 'Projected', [5, 4]],
    ].forEach(([c, t, d], i) => {
      const ox = i * 80;
      ctx.setLineDash(d);
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(L + ox, LY);
      ctx.lineTo(L + ox + 16, LY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(232,226,213,0.5)';
      ctx.font = '400 8px "DM Mono",monospace';
      ctx.textAlign = 'left';
      ctx.fillText(t, L + ox + 20, LY + 3);
    });
  }

  // ── Static colour helpers ──────────────────────────────────────────────────

  /**
   * Returns an rgba colour string for a GPA value based on classification tier.
   * @param {number} gpa
   * @param {number} [alpha=1]
   * @returns {string}
   */
  static _gpaColor(gpa, alpha = 1) {
    return gpaColor(gpa, alpha);
  }

  /**
   * Returns a hex or rgba colour string for a grade letter.
   * @param {string} letter
   * @returns {string}
   */
  static _gradeColor(letter) {
    return gradeLetterColor(letter);
  }
}