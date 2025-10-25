// enemy-filters.js — enemy search and filter controls
import { applyEnemyFilters } from './enemy-data.js';

window._enemySearchQuery = '';

// Debounce utility function (same as in filters.js)
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

const enemySearchEl = document.getElementById('enemySearch');
if (enemySearchEl) {
  const debouncedApplyEnemyFilters = debounce(() => {
    applyEnemyFilters();
  }, 50); // 50ms debounce (same as weapons search)
  
  enemySearchEl.addEventListener('input', (e) => {
    window._enemySearchQuery = (e.target.value || '').trim().toLowerCase();
    debouncedApplyEnemyFilters();
  });
}
