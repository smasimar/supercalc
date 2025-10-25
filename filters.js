// filters.js — search and reset controls
import { state } from './data.js';
import { applyFilters, sortAndRenderBody } from './table.js';

window._searchQuery = '';

const searchEl = document.getElementById('search');
if (searchEl) {
  searchEl.addEventListener('input', (e) => {
    window._searchQuery = (e.target.value || '').trim().toLowerCase();
    applyFilters();
  });
}

const resetEl = document.getElementById('resetSort');
if (resetEl) {
  resetEl.addEventListener('click', () => {
    state.sortKey = null; state.sortDir = 'asc';
    sortAndRenderBody();
  });
}
