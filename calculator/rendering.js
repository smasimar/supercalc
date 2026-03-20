// calculator/rendering.js — render selected weapon and enemy details
import { classifyAtkType, atkColorClass, apColorClass, dfColorClass, durPercentageColor, armorValueColor } from '../colors.js';
import { calculatorState } from './data.js';
import { getSelectedWeaponAttacks, renderCalculation } from './calculation.js';
import { formatTtkSeconds } from './summary.js';
import { tokenizeFormattedTtk } from './ttk-formatting.js';
import { getZoneDisplayedTtkSeconds, getZoneOutcomeDescription, getZoneOutcomeKind, getZoneOutcomeLabel, summarizeZoneDamage } from './zone-damage.js';

export function renderWeaponDetails(weapon) {
  const container = document.getElementById('calculator-weapon-details');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (!weapon || !weapon.rows || weapon.rows.length === 0) {
    const noData = document.createElement('div');
    noData.textContent = 'Select a weapon to view details';
    noData.style.color = 'var(--muted)';
    container.appendChild(noData);
    return;
  }
  
  // Create a table similar to the weapons page
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.className = 'calculator-table';
  
  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  // Add checkbox selector column first
  const checkboxTh = document.createElement('th');
  checkboxTh.style.padding = '4px 10px';
  checkboxTh.style.textAlign = 'left';
  checkboxTh.style.borderBottom = '2px solid var(--border)';
  checkboxTh.style.color = 'var(--muted)';
  checkboxTh.style.width = '30px';
  checkboxTh.style.textAlign = 'center';
  headerRow.appendChild(checkboxTh);
  
  // Get headers from weapons state
  const weaponsState = window._weaponsState;
  const headers = weaponsState?.headers || ['Name', 'DMG', 'DUR', 'AP', 'DF', 'ST', 'PF'];
  
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    th.style.padding = '4px 10px';
    th.style.textAlign = 'left';
    th.style.borderBottom = '2px solid var(--border)';
    th.style.color = 'var(--muted)';
    headerRow.appendChild(th);
  });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Body
  const tbody = document.createElement('tbody');
  
  const atkTypeKey = weaponsState?.keys?.atkTypeKey;
  
  weapon.rows.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    
    const atkClass = atkTypeKey ? classifyAtkType(row, atkTypeKey) : null;
    
    // Add checkbox as first column
    const checkboxTd = document.createElement('td');
    checkboxTd.style.padding = '4px 10px';
    checkboxTd.style.borderBottom = '1px solid var(--border)';
    checkboxTd.style.width = '30px';
    checkboxTd.style.textAlign = 'center';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `weapon-attack-${rowIndex}`;
    checkbox.dataset.rowIndex = rowIndex;
    checkbox.addEventListener('change', () => {
      if (calculatorState.selectedEnemy) {
        renderEnemyDetails(calculatorState.selectedEnemy);
      }
      renderCalculation();
    });
    
    // Make entire row clickable
    tr.addEventListener('click', (e) => {
      // Don't trigger if clicking on the checkbox itself
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
        if (calculatorState.selectedEnemy) {
          renderEnemyDetails(calculatorState.selectedEnemy);
        }
        renderCalculation();
      }
    });
    
    checkboxTd.appendChild(checkbox);
    tr.appendChild(checkboxTd);
    
    headers.forEach(header => {
      const td = document.createElement('td');
      
      let value = row[header] || '';
      
      // Apply colors using CSS classes (same as weapons table)
      const hl = header.toLowerCase();
      const isDamage = /^(damage|dmg)$/.test(hl);
      const isDuration = /^(dur|duration)$/.test(hl);
      
      if ((isDamage || isDuration) && atkClass) {
        const cls = atkColorClass(atkClass);
        if (cls) td.classList.add(cls);
      }
      
      if (weaponsState?.keys?.apKey && header === weaponsState.keys.apKey) {
        td.classList.add(apColorClass(value));
      } else if (!weaponsState?.keys?.apKey && (hl === 'ap' || (hl.includes('armor') && hl.includes('pen')))) {
        td.classList.add(apColorClass(value));
      }
      
      if (weaponsState?.keys?.atkTypeKey && header === weaponsState.keys.atkTypeKey) {
        const cls = atkColorClass(atkClass);
        if (cls) td.classList.add(cls);
      }
      
      if (hl === 'df') {
        const dfCls = dfColorClass(value);
        if (dfCls) td.classList.add(dfCls);
      }
      
      // Atk Name coloring + truncate
      if (weaponsState?.keys?.atkNameKey && header === weaponsState.keys.atkNameKey) {
        const cls = atkColorClass(atkClass);
        if (cls) td.classList.add(cls);
        td.classList.add('trunc');
        if (value != null) td.title = String(value);
      }
      
      // Format numeric values
      if (typeof value === 'number') {
        const n = Number(value);
        value = Number.isInteger(n) ? n.toString() : n.toFixed(3).replace(/\.0+$/, '');
      }
      
      td.textContent = (value === null || value === undefined) ? '' : value;
      tr.appendChild(td);
    });
    
    tbody.appendChild(tr);
  });
  
  table.appendChild(tbody);
  container.appendChild(table);
}

function appendOutcomeBadge(cell, outcomeKind) {
  const outcomeLabel = getZoneOutcomeLabel(outcomeKind);
  const outcomeDescription = getZoneOutcomeDescription(outcomeKind);
  if (!outcomeLabel) {
    return;
  }

  const badge = document.createElement('span');
  badge.className = `calc-zone-context calc-zone-context-${outcomeKind}`;
  badge.title = outcomeDescription || outcomeLabel;
  badge.textContent = outcomeLabel;
  cell.appendChild(badge);
}

function createTtkValueNode(ttkSeconds) {
  const ttkValue = document.createElement('span');
  ttkValue.className = 'calc-derived-value';

  if (ttkSeconds === null) {
    ttkValue.textContent = '-';
    ttkValue.classList.add('muted');
    return ttkValue;
  }

  ttkValue.classList.add('calc-ttk-value');
  const formattedTtk = formatTtkSeconds(ttkSeconds);
  const tokens = tokenizeFormattedTtk(formattedTtk);

  tokens.forEach(({ text, kind }) => {
    const token = document.createElement('span');
    token.className = `calc-ttk-token calc-ttk-token-${kind}`;
    token.textContent = text;
    ttkValue.appendChild(token);
  });

  return ttkValue;
}

export function renderEnemyDetails(enemy) {
  const container = document.getElementById('calculator-enemy-details');
  if (!container) return;
  
  const previousSelectedRadio = container.querySelector('input[type="radio"]:checked');
  const previousSelectedZoneIndex = previousSelectedRadio ? parseInt(previousSelectedRadio.value, 10) : null;

  container.innerHTML = '';
  
  if (!enemy || !enemy.zones || enemy.zones.length === 0) {
    const noData = document.createElement('div');
    noData.textContent = 'Select an enemy to view details';
    noData.style.color = 'var(--muted)';
    container.appendChild(noData);
    return;
  }
  
  // Create a table similar to the enemies page
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.className = 'calculator-table';
  
  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  // Add radio selector column first
  const radioTh = document.createElement('th');
  radioTh.style.padding = '4px 10px';
  radioTh.style.textAlign = 'left';
  radioTh.style.borderBottom = '2px solid var(--border)';
  radioTh.style.color = 'var(--muted)';
  radioTh.style.width = '30px';
  headerRow.appendChild(radioTh);
  
  const headers = ['zone_name', 'health', 'Con', 'Dur%', 'AV', 'IsFatal', 'ExTarget', 'ExMult', 'ToMain%', 'MainCap', 'Shots', 'TTK'];
  
  headers.forEach(header => {
    const th = document.createElement('th');
    // Format header labels
    let label = header;
    if (header === 'zone_name') label = 'Zone Name';
    else if (header === 'health') label = 'Health';
    else if (header === 'Shots') label = 'Shots';
    th.textContent = label;
    th.style.padding = '4px 10px';
    th.style.textAlign = 'left';
    th.style.borderBottom = '2px solid var(--border)';
    th.style.color = 'var(--muted)';
    headerRow.appendChild(th);
  });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Body
  const tbody = document.createElement('tbody');
  const selectedWeapon = calculatorState.selectedWeapon;
  const selectedAttacks = getSelectedWeaponAttacks(selectedWeapon);
  const enemyMainHealth = parseInt(enemy.health) || 0;
  
  enemy.zones.forEach((zone, zoneIndex) => {
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    const zoneSummary = summarizeZoneDamage({
      zone,
      enemyMainHealth,
      selectedAttacks,
      rpm: selectedWeapon?.rpm
    });
    const outcomeKind = getZoneOutcomeKind({
      zone,
      totalDamagePerCycle: zoneSummary?.totalDamagePerCycle || 0,
      totalDamageToMainPerCycle: zoneSummary?.totalDamageToMainPerCycle || 0,
      killSummary: zoneSummary?.killSummary
    });
    
    // Add radio button as first column
    const radioTd = document.createElement('td');
    radioTd.style.padding = '4px 10px';
    radioTd.style.borderBottom = '1px solid var(--border)';
    radioTd.style.width = '30px';
    radioTd.style.textAlign = 'center';
    
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = `enemy-zone-${enemy.name}`;
    radio.value = zoneIndex;
    radio.id = `zone-${enemy.name}-${zoneIndex}`;
    if (previousSelectedZoneIndex === zoneIndex) {
      radio.checked = true;
    }
    radio.addEventListener('change', () => {
      renderCalculation();
    });
    
    // Make entire row clickable
    tr.addEventListener('click', (e) => {
      // Don't trigger if clicking on the radio button itself
      if (e.target !== radio) {
        radio.checked = true;
        renderCalculation();
      }
    });
    
    radioTd.appendChild(radio);
    tr.appendChild(radioTd);
    
    headers.forEach(header => {
      const td = document.createElement('td');
      td.style.padding = '4px 10px';
      td.style.borderBottom = '1px solid var(--border)';
      
      let value = zone[header];
      
      // Formatting and coloring similar to enemy table
      if (header === 'Shots') {
        const shotsToKill = zoneSummary?.killSummary?.zoneShotsToKill;
        td.classList.add('calc-derived-cell');
        td.textContent = shotsToKill === null ? '-' : String(shotsToKill);
        if (shotsToKill === null) {
          td.classList.add('muted');
          if (selectedAttacks.length > 0 && !(zoneSummary?.totalDamagePerCycle > 0)) {
            td.title = 'Selected attacks do not damage this part';
          }
        }
      } else if (header === 'TTK') {
        const ttkSeconds = getZoneDisplayedTtkSeconds(outcomeKind, zoneSummary?.killSummary);
        const ttkContent = document.createElement('div');
        ttkContent.className = 'calc-derived-inline';

        td.classList.add('calc-derived-cell');
        ttkContent.appendChild(createTtkValueNode(ttkSeconds));
        appendOutcomeBadge(ttkContent, outcomeKind);
        td.appendChild(ttkContent);

        if (selectedAttacks.length > 0 && !(zoneSummary?.totalDamagePerCycle > 0)) {
          td.title = 'Selected attacks do not damage this part';
        } else if (ttkSeconds === null && zoneSummary?.killSummary?.hasRpm === false) {
          td.title = 'TTK unavailable without RPM';
        } else if (outcomeKind === 'limb') {
          td.title = 'This part can be removed, but it breaks before it can kill main';
        } else if (outcomeKind === 'utility') {
          td.title = 'This part can be removed, but destroying it does not kill the enemy';
        }
      } else if (header === 'zone_name') {
        td.textContent = value || '';
      } else if (header === 'health') {
        td.textContent = value === -1 ? '-' : value;
      } else if (header === 'Con') {
        if (value === 0) {
          td.textContent = '-';
          td.style.color = 'var(--muted)';
          td.style.opacity = '0.6';
        } else {
          td.textContent = value;
        }
      } else if (header === 'Dur%') {
        const durValue = value || 0;
        td.textContent = (durValue * 100).toFixed(0) + '%';
        td.style.color = durPercentageColor(durValue);
      } else if (header === 'AV') {
        td.textContent = value || 0;
        td.style.color = armorValueColor(value);
      } else if (header === 'IsFatal') {
        td.textContent = value ? 'Yes' : 'No';
        if (value) td.style.color = 'var(--red)';
      } else if (header === 'ExMult') {
        if (value === '-') {
          td.textContent = '-';
          td.style.color = 'var(--muted)';
          td.style.opacity = '0.6';
        } else {
          td.textContent = (value * 100).toFixed(0) + '%';
        }
      } else if (header === 'ToMain%') {
        td.textContent = (value * 100).toFixed(0) + '%';
      } else if (header === 'MainCap') {
        td.textContent = value ? 'Yes' : 'No';
      } else {
        td.textContent = value || '';
      }
      
      tr.appendChild(td);
    });
    
    tbody.appendChild(tr);
  });
  
  table.appendChild(tbody);
  container.appendChild(table);
}

