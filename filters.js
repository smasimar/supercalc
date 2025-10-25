// filters.js — search and reset controls
import { state } from './data.js';
import { applyFilters, sortAndRenderBody } from './table.js';

window._searchQuery = '';

// Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

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
