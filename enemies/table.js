// enemies/table.js — enemy table rendering and sorting
import { enemyState } from './data.js';

export function setupEnemyTableSorting() {
  const sortableHeaders = document.querySelectorAll('#enemyTable th.sortable');
  
  sortableHeaders.forEach(header => {
    header.style.cursor = 'pointer';
    header.title = `Sort zones by ${header.textContent}`;
    
    header.addEventListener('click', () => {
      const sortKey = header.dataset.sort;
      
      // Toggle sort direction if clicking the same column
      if (enemyState.sortKey === sortKey) {
        enemyState.sortDir = enemyState.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        enemyState.sortKey = sortKey;
        enemyState.sortDir = 'asc';
      }
      
      // Update visual indicators
      sortableHeaders.forEach(h => {
        h.classList.remove('sort-asc', 'sort-desc');
        if (h.dataset.sort === enemyState.sortKey) {
          h.classList.add(enemyState.sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
        }
      });
      
      // Re-render table with new sorting
      renderEnemyTable();
    });
  });
}

export function renderEnemyTable() {
  const tbody = document.getElementById('enemyTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  const source = enemyState.filterActive ? enemyState.filteredUnits : enemyState.units;
  
  for (const unit of source) {
    // Sort zones within the unit if sorting is active
    let zones = [...unit.zones];
    if (enemyState.sortKey) {
      zones.sort((a, b) => {
        const aVal = a[enemyState.sortKey];
        const bVal = b[enemyState.sortKey];
        
        // Handle different data types
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        // Numeric sorting
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return enemyState.sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        // String sorting
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        return enemyState.sortDir === 'asc' ? 
          aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }
    
    for (let zoneIndex = 0; zoneIndex < zones.length; zoneIndex++) {
      const zone = zones[zoneIndex];
      const tr = document.createElement('tr');
      
      // First column: Unit name (only for first zone, spans all rows)
      if (zoneIndex === 0) {
        const unitTd = document.createElement('td');
        unitTd.textContent = `[${unit.health} HP] ${unit.name}`;
        unitTd.rowSpan = zones.length;
        unitTd.style.verticalAlign = 'top';
        unitTd.style.fontWeight = 'bold';
        tr.appendChild(unitTd);
      }
      
      // Zone name
      const zoneTd = document.createElement('td');
      zoneTd.textContent = zone.zone_name || '';
      tr.appendChild(zoneTd);
      
      // Health
      const healthTd = document.createElement('td');
      healthTd.textContent = zone.health === -1 ? '-' : zone.health;
      tr.appendChild(healthTd);
      
      // Con
      const constitutionTd = document.createElement('td');
      if (zone.Con === 0) {
        constitutionTd.textContent = '-';
        constitutionTd.style.color = 'var(--muted)';
        constitutionTd.style.opacity = '0.6';
      } else {
        constitutionTd.textContent = zone.Con;
      }
      tr.appendChild(constitutionTd);
      
      // Dur%
      const durTd = document.createElement('td');
      const durValue = zone['Dur%'] || 0;
      durTd.textContent = durValue === 0 ? '0%' : '100%';
      
      // Color gradient from white (0%) to red (100%)
      if (durValue === 0) {
        durTd.style.color = 'var(--text)'; // white
      } else {
        durTd.style.color = 'var(--red)'; // red
      }
      tr.appendChild(durTd);
      
      // AV (Armor Value) with AP coloring scheme
      const armorTd = document.createElement('td');
      armorTd.textContent = zone.AV || 0;
      // Apply AP color scheme to armor values
      const armorValue = zone.AV || 0;
      if (armorValue <= 0) armorTd.classList.add('ap-white');
      else if (armorValue === 1 || armorValue === 2) armorTd.classList.add('ap-blue');
      else if (armorValue === 3) armorTd.classList.add('ap-green');
      else if (armorValue === 4) armorTd.classList.add('ap-yellow');
      else if (armorValue === 5) armorTd.classList.add('ap-orange');
      else if (armorValue >= 6) armorTd.classList.add('ap-red');
      tr.appendChild(armorTd);
      
      // IsFatal
      const fatalTd = document.createElement('td');
      fatalTd.textContent = zone.IsFatal ? 'Yes' : 'No';
      if (zone.IsFatal) fatalTd.style.color = 'var(--red)';
      tr.appendChild(fatalTd);
      
      // ExTarget
      const exTargetTd = document.createElement('td');
      exTargetTd.textContent = zone.ExTarget || '';
      tr.appendChild(exTargetTd);
      
      // ExMult
      const exMultTd = document.createElement('td');
      if (zone.ExMult === '-') {
        exMultTd.textContent = '-';
        exMultTd.style.color = 'var(--muted)';
        exMultTd.style.opacity = '0.6';
      } else {
        exMultTd.textContent = (zone.ExMult * 100).toFixed(0) + '%';
      }
      tr.appendChild(exMultTd);
      
      // ToMain%
      const toMainTd = document.createElement('td');
      toMainTd.textContent = (zone['ToMain%'] * 100).toFixed(0) + '%';
      tr.appendChild(toMainTd);
      
      // MainCap
      const mainCapTd = document.createElement('td');
      mainCapTd.textContent = zone.MainCap ? 'Yes' : 'No';
      tr.appendChild(mainCapTd);
      
      tbody.appendChild(tr);
    }
  }
}
