// weapons/filters.js — search and reset controls
import { state } from './data.js';
import { applyFilters, sortAndRenderBody } from './table.js';
import { debounce } from '../utils.js';

window._searchQuery = '';

const searchEl = document.getElementById('search');
if (searchEl) {
  const debouncedApplyFilters = debounce(() => {
    applyFilters();
  }, 50); // 50ms debounce
  
  searchEl.addEventListener('input', (e) => {
    window._searchQuery = (e.target.value || '').trim().toLowerCase();
    debouncedApplyFilters();
  });
}

const resetEl = document.getElementById('resetSort');
if (resetEl) {
  resetEl.addEventListener('click', () => {
    state.sortKey = null; state.sortDir = 'asc';
    sortAndRenderBody();
  });
}
