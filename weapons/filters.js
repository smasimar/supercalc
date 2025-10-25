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
    // Clear search field
    const searchEl = document.getElementById('search');
    if (searchEl) {
      searchEl.value = '';
      window._searchQuery = '';
    }
    
    // Uncheck all type filters
    const typeChips = document.querySelectorAll('#typeFilters .chip');
    typeChips.forEach(chip => chip.classList.remove('active'));
    
    // Uncheck all sub filters
    const subChips = document.querySelectorAll('#subFilters .chip');
    subChips.forEach(chip => chip.classList.remove('active'));
    
    // Clear sort state
    state.sortKey = null;
    state.sortDir = 'asc';
    
    // Remove sort indicators from headers
    const sortableHeaders = document.querySelectorAll('#weaponsTable th');
    sortableHeaders.forEach(h => {
      h.classList.remove('sort-asc', 'sort-desc');
    });
    
    // Reapply filters to reset state
    applyFilters();
    renderTable();
  });
}
