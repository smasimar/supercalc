// data.js — loading, parsing, and state
export const PUBLISHED_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTeLqZ5-maEmzrM6SUDMRXpHEhV0tQImiBdgMCil9lSA11IiY_nGdamE54W7DAiSXn1XuJljdF4P537/pub?gid=0&single=true&output=csv';
export const LOCAL_CSV_URL = './weapons/weapondata.csv';

export const state = {
  headers: [],
  rows: [],
  groups: [],
  filteredGroups: [],
  filterActive: false,
  sortKey: null,
  sortDir: 'asc',
  // Pre-indexed data for faster filtering
  typeIndex: new Map(),
  subIndex: new Map(),
  searchIndex: new Map(),
  // Pinned weapons (Set of weapon names)
  pinnedWeapons: new Set(),
  // Patch / sheet metadata (e.g. \"1.005.002\" when the sheet is named with the patch)
  patchVersion: null,
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
    rpmKey: null,
  },
};

// Load pinned weapons from localStorage
function loadPinnedWeapons() {
  try {
    const saved = localStorage.getItem('weaponPins');
    if (saved) {
      const pins = JSON.parse(saved);
      state.pinnedWeapons = new Set(pins);
    }
  } catch (e) {
    console.warn('Failed to load pinned weapons:', e);
  }
}

// Save pinned weapons to localStorage
export function savePinnedWeapons() {
  try {
    localStorage.setItem('weaponPins', JSON.stringify(Array.from(state.pinnedWeapons)));
  } catch (e) {
    console.warn('Failed to save pinned weapons:', e);
  }
}

// Initialize pinned weapons on module load
loadPinnedWeapons();

function normalizeHeaderCell(value) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim() || '';
}

function extractVersionToken(value) {
  const match = String(value || '').match(/\d+\.\d+\.\d+/);
  return match ? match[0] : null;
}

export function inferPatchVersion(contentDisposition, sourceUrl = '') {
  const disposition = String(contentDisposition || '');
  const dispositionMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
  const dispositionFilename = dispositionMatch?.[1]?.trim() || '';

  const dispositionVersion = extractVersionToken(dispositionFilename);
  if (dispositionVersion) {
    return dispositionVersion;
  }

  if (dispositionFilename) {
    const base = dispositionFilename.replace(/\.csv$/i, '').trim();
    const parts = base.split(' - ');
    const sheetName = parts.length > 1 ? parts[parts.length - 1] : base;
    return sheetName || null;
  }

  return extractVersionToken(sourceUrl);
}

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
  const hdrs = matrix[0].map(normalizeHeaderCell);
  const bodyRows = matrix.slice(1)
    .filter(r => r.some(c => String(c).trim() !== ''))
    .map(r => { const obj = {}; hdrs.forEach((h,i)=> obj[h] = r[i] !== undefined ? r[i] : null); return obj; });
  ingestHeadersAndRows(hdrs, bodyRows);
}

function buildCsvRequestUrl(sourceUrl) {
  const separator = sourceUrl.includes('?') ? '&' : '?';
  return `${sourceUrl}${separator}t=${Date.now()}`;
}

function buildIndexes() {
  // Clear existing indexes
  state.typeIndex.clear();
  state.subIndex.clear();
  state.searchIndex.clear();
  
  // Build type and sub indexes
  for (const group of state.groups) {
    if (group.type) {
      const typeKey = group.type.toLowerCase();
      if (!state.typeIndex.has(typeKey)) {
        state.typeIndex.set(typeKey, new Set());
      }
      state.typeIndex.get(typeKey).add(group);
    }
    
    if (group.sub) {
      const subKey = group.sub.toLowerCase();
      if (!state.subIndex.has(subKey)) {
        state.subIndex.set(subKey, new Set());
      }
      state.subIndex.get(subKey).add(group);
    }
    
    // Build search index for fast text search
    const searchText = [
      group.name,
      ...group.rows.flatMap(row => Object.values(row))
    ].map(v => String(v || '').toLowerCase()).join(' ');
    
    state.searchIndex.set(group, searchText);
  }
}

export function ingestHeadersAndRows(newHeaders, newRows) {
  state.headers = newHeaders; state.rows = newRows;
  const lower = (s) => String(s||'').toLowerCase();
  const normalize = (s) => lower(s).replace(/[^a-z0-9]+/g, '');
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
  keys.rpmKey = state.headers.find(h => ['rpm', 'rof', 'firerate', 'rateoffire', 'roundsperminute'].includes(normalize(h))) || null;

  // Build groups by Name
  const map = new Map(); let index = 0;
  for (const row of state.rows) {
    const name = (row[keys.nameKey] ?? '').toString();
    if (!map.has(name)) { map.set(name, { name, rows: [], index: index++, type: null, sub: null, code: null, rpm: null }); }
    map.get(name).rows.push(row);
  }
  for (const g of map.values()) {
    if (keys.typeKey) { for (const r of g.rows) { const v = r[keys.typeKey]; if (v != null && String(v).trim() !== '') { g.type = String(v).trim(); break; } } }
    if (keys.subKey)  { for (const r of g.rows) { const v = r[keys.subKey]; if (v != null && String(v).trim() !== '') { g.sub  = String(v).trim(); break; } } }
    if (keys.codeKey) { for (const r of g.rows) { const v = r[keys.codeKey]; if (v != null && String(v).trim() !== '') { g.code = String(v).trim(); break; } } }
    if (keys.rpmKey)  { for (const r of g.rows) { const v = parseFloat(r[keys.rpmKey]); if (Number.isFinite(v) && v > 0) { g.rpm = v; break; } } }
  }
  state.groups = Array.from(map.values());
  state.filteredGroups = [];
  state.filterActive = false;
  
  // Build indexes for fast filtering
  buildIndexes();
}

export async function loadCSV(sourceUrl = LOCAL_CSV_URL){
  const res = await fetch(buildCsvRequestUrl(sourceUrl), { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  try {
    const disposition = res.headers.get('Content-Disposition') || res.headers.get('content-disposition');
    state.patchVersion = inferPatchVersion(disposition, sourceUrl);
  } catch (e) {
    state.patchVersion = null;
    console.warn('Failed to infer patch version from weapon data source:', e);
  }

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
