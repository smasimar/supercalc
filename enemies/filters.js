// enemies/filters.js — enemy search and filter controls
import { enemyState } from './data.js';
import { renderEnemyTable } from './table.js';
import { debounce } from '../utils.js';

window._enemySearchQuery = '';

export function applyEnemyFilters() {
  const factionContainer = document.getElementById('enemyFactionFilters');
  const activeFactions = factionContainer ? 
    Array.from(factionContainer.querySelectorAll('.chip.active')).map(b => b.dataset.val) : [];
  
  const factionFilterActive = !!(factionContainer && activeFactions.length);
  const hasSearch = (window._enemySearchQuery || '').length > 0;
  
  if (!factionFilterActive && !hasSearch) {
    enemyState.filterActive = false;
    enemyState.filteredUnits = [];
    renderEnemyTable();
    return;
  }
  
  const q = window._enemySearchQuery || '';
  let filteredUnits = enemyState.units;
  
  // Apply faction filter using index
  if (factionFilterActive) {
    const factionUnits = new Set();
    for (const faction of activeFactions) {
      const units = enemyState.factionIndex.get(faction);
      if (units) {
        for (const unit of units) {
          factionUnits.add(unit);
        }
      }
    }
    filteredUnits = filteredUnits.filter(u => factionUnits.has(u));
  }
  
  // Apply search filter using pre-built search index
  if (hasSearch) {
    filteredUnits = filteredUnits.filter(u => {
      const searchText = enemyState.searchIndex.get(u);
      if (!searchText) return false;
      
      // Split query into individual words and check if ALL words are found
      const queryWords = q.trim().split(/\s+/).filter(word => word.length > 0);
      return queryWords.every(word => searchText.includes(word));
    });
  }
  
  enemyState.filteredUnits = filteredUnits;
  enemyState.filterActive = true;
  renderEnemyTable();
}

export function buildEnemyFactionFilters() {
  const el = document.getElementById('enemyFactionFilters');
  if (!el) return;
  
  el.innerHTML = '';
  
  for (const faction of enemyState.factions) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = faction;
    chip.dataset.val = faction;
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
      applyEnemyFilters();
    });
    el.appendChild(chip);
  }
  
  applyEnemyFilters();
}

// Setup search input
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
