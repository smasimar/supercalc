// table.js — render, grouping, sorting, filters
import { state } from './data.js';
import { classifyAtkType, atkColorClass, apColorClass, dfColorClass } from './colors.js';

export function isNumber(v){ return v !== null && v !== '' && !isNaN(Number(v)); }

export function guessNumericColumn(key){
  let cnt = 0, ok = 0;
  for (const g of state.groups) {
    for (const r of g.rows) { cnt++; if (isNumber(r[key])) ok++; if (cnt >= 40) break; }
    if (cnt >= 40) break;
  }
  return ok >= Math.max(3, Math.floor(cnt * 0.6));
}

export function groupSortValue(group, key, numeric){
  if (key === state.keys.nameKey) return (group.name || '').toString();
  if (numeric) {
    const vals = group.rows.map(r => Number(r[key])).filter(n => !isNaN(n));
    return vals.length ? Math.max(...vals) : Number.NEGATIVE_INFINITY;
  } else {
    for (const r of group.rows) { const v = r[key]; if (v !== null && v !== undefined && v !== '') return String(v); }
    return '';
  }
}

export function renderTable(){
  const thead = document.getElementById('thead');
  thead.innerHTML = '';
  const trh = document.createElement('tr');
  state.headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h; th.title = `Sort by ${h}`;
    if (state.sortKey === h) { const span = document.createElement('span'); span.className = 'sort-indicator'; span.textContent = state.sortDir === 'asc' ? '▲' : '▼'; th.appendChild(span); }
    th.addEventListener('click', () => { if (state.sortKey === h) { state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc'; } else { state.sortKey = h; state.sortDir = 'asc'; } sortAndRenderBody(); });
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  sortAndRenderBody();
}

export function sortAndRenderBody(){
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '';
  const source = state.filterActive ? state.filteredGroups : state.groups;
  let ordered = [...source];

  if (state.sortKey) {
    const numeric = guessNumericColumn(state.sortKey);
    ordered.sort((a, b) => {
      const va = groupSortValue(a, state.sortKey, numeric);
      const vb = groupSortValue(b, state.sortKey, numeric);
      if (numeric) return state.sortDir === 'asc' ? (va - vb) : (vb - va);
      return state.sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }

  const wikiUrlForName = (name) => {
    if (!name) return null;
    const clean = String(name).replace(/\s*\(.*?\)\s*/g, ' ').trim().replace(/\s+/g,' ');
    return `https://helldivers.wiki.gg/wiki/Special:Search/${encodeURIComponent(clean)}`;
  };

  ordered.forEach((g) => {
    g.rows.forEach((r, idx) => {
      const tr = document.createElement('tr');
      if (idx === 0) tr.classList.add('group-start');
      const atkClass = classifyAtkType(r, state.keys.atkTypeKey);
      state.headers.forEach(h => {
        const td = document.createElement('td');
        let v = r[h];
        if (idx > 0 && (h === state.keys.nameKey || h === state.keys.typeKey || h === state.keys.codeKey)) v = '';

        const hl = h.toLowerCase();
        const isDamage = /^(damage|dmg)$/.test(hl);
        const isDuration = /^(dur|duration)$/.test(hl);
        if ((isDamage || isDuration) && atkClass) {
          const cls = atkColorClass(atkClass);
          if (cls) td.classList.add(cls);
        }

        if (state.keys.apKey && h === state.keys.apKey) td.classList.add(apColorClass(v));
        else if (!state.keys.apKey && (hl === 'ap' || (hl.includes('armor') && hl.includes('pen')))) td.classList.add(apColorClass(v));

        if (state.keys.atkTypeKey && h === state.keys.atkTypeKey) {
          const cls = atkColorClass(atkClass);
          if (cls) td.classList.add(cls);
        }

        if (hl === 'df') {
          const dfCls = dfColorClass(v);
          if (dfCls) td.classList.add(dfCls);
        }

        // Atk Name coloring + truncate (same color scheme as Atk Type/DMG/DUR)
        if (state.keys.atkNameKey && h === state.keys.atkNameKey) {
          const cls = atkColorClass(atkClass);
          if (cls) td.classList.add(cls);
          td.classList.add('trunc');          // <-- enables ellipsis
          if (v != null) td.title = String(v); // tooltip shows full value
        }

        // Name is a link but not colored
        if (h === state.keys.nameKey && idx === 0 && v) {
          const a = document.createElement('a'); a.href = wikiUrlForName(v); a.target = '_blank'; a.rel = 'noreferrer noopener'; a.className = 'name-link'; a.textContent = String(v); td.appendChild(a);
        } else {
          if (isNumber(v)) { const n = Number(v); v = Number.isInteger(n) ? n.toString() : n.toFixed(3).replace(/\.0+$/, ''); }
          td.textContent = (v === null || v === undefined) ? '' : v;
        }

        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  });
}

export function applyFilters(){
  const typeContainer = document.getElementById('typeFilters');
  const subContainer  = document.getElementById('subFilters');
  const activeTypes = typeContainer ? Array.from(typeContainer.querySelectorAll('.chip.active')).map(b => b.dataset.val) : [];
  const activeSubs  = subContainer  ? Array.from(subContainer.querySelectorAll('.chip.active')).map(b => b.dataset.val)  : [];

  const typeFilterActive = !!(typeContainer && activeTypes.length);
  const subFilterActive  = !!(subContainer  && activeSubs.length);
  const hasSearch = (window._searchQuery || '').length > 0;

  if (!typeFilterActive && !subFilterActive && !hasSearch) {
    state.filterActive = false; state.filteredGroups = []; sortAndRenderBody(); return;
  }

  const q = window._searchQuery || '';
  state.filteredGroups = state.groups.filter(g => {
    if (typeFilterActive) { const t = (g.type || '').toString().toLowerCase(); if (!activeTypes.includes(t)) return false; }
    if (subFilterActive)  { const s = (g.sub || '').toString().toLowerCase(); if (!activeSubs.includes(s)) return false; }
    if (!hasSearch) return true;
    if ((g.name || '').toLowerCase().includes(q)) return true;
    for (const r of g.rows) { for (const h of state.headers) { const v = r[h]; if (v !== null && v !== undefined && String(v).toLowerCase().includes(q)) return true; } }
    return false;
  });

  state.filterActive = true; sortAndRenderBody();
}

export function buildTypeFilters(){
  const el = document.getElementById('typeFilters'); if (!el) return;
  const present = new Set();
  for (const g of state.groups) { const t = (g.type || '').toString().trim(); if (t) present.add(t.toLowerCase()); }
  const orderedDesired = ['primary','secondary','grenade','support','stratagem'];
  const defaults = new Set(['primary']);
  el.innerHTML = '';
  orderedDesired.forEach(t => {
    if (!present.has(t)) return;
    const chip = document.createElement('button'); chip.type = 'button';
    chip.className = 'chip' + (defaults.has(t) ? ' active' : '');
    chip.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    chip.dataset.val = t;
    chip.addEventListener('click', () => { chip.classList.toggle('active'); applyFilters(); });
    el.appendChild(chip);
  });
  applyFilters();
}

export function buildSubFilters(){
  const el = document.getElementById('subFilters'); if (!el) return;
  const subs = new Set();
  for (const g of state.groups) { const s = (g.sub || '').toString().trim(); if (s) subs.add(s.toLowerCase()); }
  const ordered = Array.from(subs).sort((a,b)=>a.localeCompare(b));
  el.innerHTML = '';
  ordered.forEach(s => {
    const chip = document.createElement('button'); chip.type = 'button';
    chip.className = 'chip'; // inactive by default
    chip.textContent = s.toUpperCase();
    chip.dataset.val = s;
    chip.addEventListener('click', () => { chip.classList.toggle('active'); applyFilters(); });
    el.appendChild(chip);
  });
  applyFilters();
}
