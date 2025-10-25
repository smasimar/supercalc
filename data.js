// data.js — loading, parsing, and state
export const PUBLISHED_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTeLqZ5-maEmzrM6SUDMRXpHEhV0tQImiBdgMCil9lSA11IiY_nGdamE54W7DAiSXn1XuJljdF4P537/pub?gid=0&single=true&output=csv';

export const state = {
  headers: [],
  rows: [],
  groups: [],
  filteredGroups: [],
  filterActive: false,
  sortKey: null,
  sortDir: 'asc',
  keys: {
    typeKey: null,
    subKey: null,
    nameKey: null,
    codeKey: null,
    atkTypeKey: null,
    atkNameKey: null,
    dmgKey: null,
    durKey: null,
    apKey: null,
  },
};

export function parseDelimited(text, delimiter=',') {
  const rows = []; let cur = [], cell = ''; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') { if (text[i+1] === '"') { cell += '"'; i++; } else { inQuotes = false; } }
      else { cell += ch; }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delimiter) { cur.push(cell); cell = ''; }
      else if (ch === '\n') { cur.push(cell); rows.push(cur); cur = []; cell=''; }
      else if (ch === '\r') { /* ignore */ }
      else { cell += ch; }
    }
  }
  cur.push(cell); rows.push(cur); return rows;
}

export function ingestMatrix(matrix) {
  if (!matrix.length) throw new Error('Empty data');
  const hdrs = matrix[0].map(h => String(h||'').trim() || '');
  const bodyRows = matrix.slice(1)
    .filter(r => r.some(c => String(c).trim() !== ''))
    .map(r => { const obj = {}; hdrs.forEach((h,i)=> obj[h] = r[i] !== undefined ? r[i] : null); return obj; });
  ingestHeadersAndRows(hdrs, bodyRows);
}

export function ingestHeadersAndRows(newHeaders, newRows) {
  state.headers = newHeaders; state.rows = newRows;
  const lower = (s) => String(s||'').toLowerCase();
  const { keys } = state;
  keys.typeKey = state.headers.find(h => lower(h) === 'type') || state.headers.find(h => lower(h).includes('weapon') && lower(h).includes('type')) || null;
  keys.subKey  = state.headers.find(h => ['sub','subtype'].includes(lower(h)) || lower(h).includes('sub ')) || null;
  keys.codeKey = state.headers.find(h => lower(h) === 'code') || null;
  keys.nameKey = state.headers.find(h => lower(h) === 'name') || state.headers.find(h => lower(h) === 'atkname') || state.headers[0];
  keys.atkTypeKey = state.headers.find(h => ['atktype','atk type'].includes(lower(h)) || lower(h).includes('attack type')) || (state.headers.includes('Stage') ? 'Stage' : null);
  keys.atkNameKey = state.headers.find(h => lower(h).replace(/\s+/g,'') === 'atkname') || null; // matches "Atk Name" and "AtkName"
  keys.dmgKey = state.headers.find(h => ['damage','dmg','dmG'].includes(lower(h))) || null;
  keys.durKey = state.headers.find(h => ['dur','duration'].includes(lower(h))) || null;
  keys.apKey  = state.headers.find(h => lower(h) === 'ap' || (lower(h).includes('armor') && lower(h).includes('pen'))) || null;

  // Build groups by Name
  const map = new Map(); let index = 0;
  for (const row of state.rows) {
    const name = (row[keys.nameKey] ?? '').toString();
    if (!map.has(name)) { map.set(name, { name, rows: [], index: index++, type: null, sub: null }); }
    map.get(name).rows.push(row);
  }
  for (const g of map.values()) {
    if (keys.typeKey) { for (const r of g.rows) { const v = r[keys.typeKey]; if (v != null && String(v).trim() !== '') { g.type = String(v).trim(); break; } } }
    if (keys.subKey)  { for (const r of g.rows) { const v = r[keys.subKey]; if (v != null && String(v).trim() !== '') { g.sub  = String(v).trim(); break; } } }
  }
  state.groups = Array.from(map.values());
  state.filteredGroups = [];
  state.filterActive = false;
}

export async function loadCSV(){
  const res = await fetch(PUBLISHED_CSV_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const firstLine = text.split(/\r?\n/)[0] || '';
  const delimiter = (firstLine.split('\t').length - 1) > (firstLine.split(',').length - 1) ? '\t' : ',';
  const matrix = parseDelimited(text, delimiter === '\t' ? '\t' : ',');
  ingestMatrix(matrix);
}

export function loadFromText(text){
  const firstLine = text.split(/\r?\n/)[0] || '';
  const delimiter = (firstLine.split('\t').length - 1) > (firstLine.split(',').length - 1) ? '\t' : ',';
  const matrix = parseDelimited(text, delimiter === '\t' ? '\t' : ',');
  ingestMatrix(matrix);
}
