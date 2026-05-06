export function _setCssVars(el, vars) {
  Object.entries(vars).forEach(([name, value]) => {
    el.style.setProperty(name, value);
  });
  return el;
}

export function _gpaRgba(gpa, alpha = 1) {
  if (gpa >= 4.5) return `rgba(246,211,101,${alpha})`;
  if (gpa >= 3.5) return `rgba(168,230,207,${alpha})`;
  if (gpa >= 2.4) return `rgba(116,185,224,${alpha})`;
  if (gpa >= 1.5) return `rgba(246,173,85,${alpha})`;
  return `rgba(255,139,148,${alpha})`;
}

export function _badgeStyle(gpa) {
  return {
    color: _gpaRgba(gpa, 0.9),
    border: _gpaRgba(gpa, 0.35),
    bg: _gpaRgba(gpa, 0.1),
  };
}

export function _gradeBarColor(letter) {
  const map = {
    A: 'rgba(246,211,101,0.75)',
    'A+': 'rgba(246,211,101,0.85)',
    'A−': 'rgba(246,211,101,0.65)',
    B: 'rgba(168,230,207,0.75)',
    'B+': 'rgba(168,230,207,0.85)',
    'B−': 'rgba(168,230,207,0.65)',
    C: 'rgba(116,185,224,0.75)',
    'C+': 'rgba(116,185,224,0.85)',
    'C−': 'rgba(116,185,224,0.65)',
    D: 'rgba(246,173,85,0.75)',
    'D+': 'rgba(246,173,85,0.85)',
    'D−': 'rgba(246,173,85,0.65)',
    E: 'rgba(160,174,192,0.6)',
    F: 'rgba(255,139,148,0.7)',
  };
  return map[letter] ?? 'rgba(160,174,192,0.5)';
}

export function _pseudoHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).toUpperCase().padStart(8, '0');
}

export function _computeRunningCGPAs(semesters, prev) {
  let cumCU = prev?.creditUnits ?? 0;
  let cumQP = prev?.qualityPoints ?? 0;

  return semesters.map((sem) => {
    cumCU += sem.totalCreditUnits;
    cumQP += sem.totalQualityPoints;
    return cumCU > 0 ? cumQP / cumCU : 0;
  });
}
