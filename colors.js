// colors.js — helpers for atk/AP/DF and classification
export function classifyAtkType(row, atkTypeKey){
  const raw = (atkTypeKey && row[atkTypeKey]) ? String(row[atkTypeKey]) : (row['Stage'] ? String(row['Stage']) : '');
  const v = raw.toLowerCase();
  if (v.includes('explosion') || v === 'explosion') return 'explosion';
  if (v.includes('beam') || v === 'beam') return 'beam';
  if (v.includes('arc') || v === 'arc') return 'arc';
  if (v.includes('spray') || v === 'spray') return 'spray';
  return '';
}

export function atkColorClass(kind){
  if (!kind) return '';
  if (kind === 'explosion') return 'num-orange';
  if (kind === 'beam') return 'num-yellow';
  if (kind === 'arc') return 'num-cyan';
  if (kind === 'spray') return 'num-red';
  return '';
}

export function apColorClass(val){
  if (val === null || val === undefined || val === '') return 'ap-white';
  const s = String(val).toLowerCase();
  const nums = (s.match(/\d+/g) || []).map(n => parseInt(n,10));
  const n = nums.length ? Math.max(...nums) : (!isNaN(Number(s)) ? Number(s) : NaN);
  if (isNaN(n) || n <= 0) return 'ap-white';
  if (n === 1 || n === 2) return 'ap-blue';
  if (n === 3) return 'ap-green';
  if (n === 4) return 'ap-yellow';
  if (n === 5) return 'ap-orange';
  if (n >= 6) return 'ap-red';
  return 'ap-white';
}

// DF thresholds: 30 yellow, 40 orange, 50+ red
export function dfColorClass(val){
  const n = Number(val);
  if (!isFinite(n)) return '';
  if (n >= 50) return 'num-red';
  if (n === 40) return 'num-orange';
  if (n === 30) return 'num-yellow';
  return '';
}
