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

// Get color for durability percentage (0.0 to 1.0)
// Returns RGBA string from white to yellow to orange to red
export function durPercentageColor(durValue){
  if (durValue === 0) return 'var(--text)'; // white
  
  if (durValue < 0.5) {
    // White to yellow transition (0-50%)
    const ratio = durValue * 2; // 0 to 1
    return `rgba(255, 255, ${255 - Math.floor(ratio * 155)}, 1)`;
  } else if (durValue < 0.75) {
    // Yellow to orange transition (50-75%)
    const ratio = (durValue - 0.5) * 4; // 0 to 1
    return `rgba(255, ${255 - Math.floor(ratio * 55)}, 0, 1)`;
  } else {
    // Orange to red transition (75-100%)
    const ratio = (durValue - 0.75) * 4; // 0 to 1
    // End color: #c8442e (rgb(200, 68, 46))
    const r = Math.floor(255 - ratio * 55);
    const g = Math.floor(200 - ratio * 132);
    const b = Math.floor(ratio * 46);
    return `rgba(${r}, ${g}, ${b}, 1)`;
  }
}

// Get color for armor value (AV)
export function armorValueColor(avValue){
  const armorValue = avValue || 0;
  if (armorValue <= 0) return 'var(--text)';
  if (armorValue <= 2) return '#58a6ff';
  if (armorValue === 3) return '#4caf50';
  if (armorValue === 4) return '#f8f833';
  if (armorValue === 5) return '#ff9a3c';
  if (armorValue >= 6) return '#ff4b41';
  return 'var(--text)';
}