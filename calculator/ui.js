// calculator/ui.js — calculator UI components
import {
  calculatorState,
  getEnemyOptions,
  getWeaponOptions,
  setCalculatorMode,
  setCompareView,
  setSelectedEnemy,
  setSelectedWeapon
} from './data.js';
import { getEnemyDropdownQueryState } from './selector-utils.js';
import { state as weaponsState } from '../weapons/data.js';
import { enemyState } from '../enemies/data.js';
import { renderWeaponDetails, renderEnemyDetails } from './rendering.js';
import { renderCalculation } from './calculation.js';

let enemySelectorSetup = false;

export function setupCalculator() {
  if (enemyState.units && enemyState.units.length > 0) {
    window.enemyDataLoaded = true;
  }

  setupModeToggle();
  setupWeaponSelector('A');
  setupWeaponSelector('B');

  if (!enemySelectorSetup) {
    setupEnemySelector();
    enemySelectorSetup = true;
  }

  syncCalculatorModeUi();
  renderWeaponDetails();
  renderEnemyDetails();
  renderCalculation();
}

function syncCalculatorModeUi() {
  const calculatorContainer = document.querySelector('#tab-calculator .calculator-container');
  const modeSingleButton = document.getElementById('calculator-mode-single');
  const modeCompareButton = document.getElementById('calculator-mode-compare');
  const weaponRowB = document.getElementById('calculator-weapon-row-b');
  const weaponLabelA = document.getElementById('calculator-weapon-label-a');

  const compareMode = calculatorState.mode === 'compare';

  calculatorContainer?.classList.toggle('calculator-mode-compare', compareMode);
  modeSingleButton?.classList.toggle('is-active', !compareMode);
  modeCompareButton?.classList.toggle('is-active', compareMode);
  weaponRowB?.classList.toggle('hidden', !compareMode);

  if (weaponLabelA) {
    weaponLabelA.textContent = compareMode ? 'Weapon A:' : 'Weapon:';
  }

  syncEnemyInputValue();
}

function getEnemyInputDisplayValue() {
  if (calculatorState.mode === 'compare' && calculatorState.compareView === 'overview') {
    return 'Overview';
  }

  return calculatorState.selectedEnemy?.name || '';
}

function syncEnemyInputValue() {
  const enemyInput = document.getElementById('calculator-enemy-input');
  if (enemyInput) {
    enemyInput.value = getEnemyInputDisplayValue();
  }
}

function setupModeToggle() {
  const modeSingleButton = document.getElementById('calculator-mode-single');
  const modeCompareButton = document.getElementById('calculator-mode-compare');

  if (!modeSingleButton || !modeCompareButton) {
    return;
  }

  modeSingleButton.addEventListener('click', () => {
    if (calculatorState.mode === 'single') {
      return;
    }

    setCalculatorMode('single');
    syncCalculatorModeUi();
    renderWeaponDetails();
    renderEnemyDetails();
    renderCalculation();
  });

  modeCompareButton.addEventListener('click', () => {
    if (calculatorState.mode === 'compare') {
      return;
    }

    setCalculatorMode('compare');
    syncCalculatorModeUi();
    renderWeaponDetails();
    renderEnemyDetails();
    renderCalculation();
  });
}

function setupWeaponSelector(slot) {
  const suffix = slot.toLowerCase();
  const weaponInput = document.getElementById(`calculator-weapon-input-${suffix}`)
    || (slot === 'A' ? document.getElementById('calculator-weapon-input') : null);
  const weaponDropdown = document.getElementById(`calculator-weapon-dropdown-${suffix}`)
    || (slot === 'A' ? document.getElementById('calculator-weapon-dropdown') : null);
  const weaponSelector = weaponInput?.parentElement;

  if (!weaponInput || !weaponDropdown || !weaponSelector) {
    console.warn(`[calculator] Weapon selector DOM missing for slot ${slot}`);
    return;
  }

  const clearButton = document.createElement('button');
  clearButton.className = 'calculator-clear-btn';
  clearButton.textContent = '×';
  clearButton.type = 'button';
  clearButton.addEventListener('click', (event) => {
    event.stopPropagation();
    weaponInput.value = '';
    setSelectedWeapon(slot, null);
    renderWeaponDetails();
    renderEnemyDetails();
    renderCalculation();
    populateDropdown('');
  });
  weaponSelector.appendChild(clearButton);

  let isOpen = false;

  function populateDropdown(query = '') {
    const options = getWeaponOptions();

    if (!options || options.length === 0) {
      weaponDropdown.innerHTML = '';
      const noResults = document.createElement('div');
      noResults.className = 'dropdown-item';
      noResults.textContent = 'Loading weapon data...';
      weaponDropdown.appendChild(noResults);
      return;
    }

    const filteredOptions = options.filter((weapon) => {
      const type = (weapon.type || '').toLowerCase();
      const sub = (weapon.sub || '').toLowerCase();
      const code = (weapon.code || '').toLowerCase();
      const name = (weapon.name || '').toLowerCase();
      const searchable = `${type} ${sub} ${code} ${name}`;
      return searchable.includes(query.toLowerCase());
    });

    weaponDropdown.innerHTML = '';

    if (filteredOptions.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'dropdown-item';
      noResults.textContent = 'No weapons found';
      weaponDropdown.appendChild(noResults);
      return;
    }

    filteredOptions.forEach((weapon) => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';

      const type = weapon.type || '';
      const sub = weapon.sub || '';
      const code = weapon.code || '';
      const name = weapon.name || '';
      const displayText = `[${type}]${sub ? `[${sub}]` : ''}${code} ${name}`;

      item.textContent = displayText;
      item.addEventListener('click', () => {
        setSelectedWeapon(slot, weapon);
        weaponInput.value = displayText || weapon.name;
        closeDropdown();
        renderWeaponDetails();
        renderEnemyDetails();
        renderCalculation();
      });
      weaponDropdown.appendChild(item);
    });
  }

  function openDropdown() {
    isOpen = true;
    weaponDropdown.classList.remove('hidden');
    populateDropdown(weaponInput.value);
  }

  function closeDropdown() {
    isOpen = false;
    weaponDropdown.classList.add('hidden');
  }

  weaponInput.addEventListener('focus', () => {
    if (!isOpen) {
      openDropdown();
    }
  });

  weaponInput.addEventListener('input', (event) => {
    if (!isOpen) {
      openDropdown();
    }

    populateDropdown(event.target.value);
  });

  document.addEventListener('click', (event) => {
    if (!weaponInput.contains(event.target) && !weaponDropdown.contains(event.target)) {
      closeDropdown();
    }
  });

  populateDropdown();

  const checkDataAvailability = setInterval(() => {
    if (weaponsState.groups && weaponsState.groups.length > 0) {
      if (isOpen) {
        populateDropdown(weaponInput.value);
      }
      clearInterval(checkDataAvailability);
    }
  }, 200);

  setTimeout(() => clearInterval(checkDataAvailability), 5000);
}

function setupEnemySelector() {
  const enemyInput = document.getElementById('calculator-enemy-input');
  const enemyDropdown = document.getElementById('calculator-enemy-dropdown');
  const enemySelector = enemyInput?.parentElement;

  if (!enemyInput || !enemyDropdown || !enemySelector) {
    console.warn('[calculator] Enemy selector DOM missing');
    return;
  }

  const clearButton = document.createElement('button');
  clearButton.className = 'calculator-clear-btn';
  clearButton.textContent = '×';
  clearButton.type = 'button';
  clearButton.addEventListener('click', (event) => {
    event.stopPropagation();
    setCompareView('focused');
    setSelectedEnemy(null);
    syncEnemyInputValue();
    renderEnemyDetails();
    renderCalculation();
    populateDropdown('');
  });
  enemySelector.appendChild(clearButton);

  let isOpen = false;

  function populateDropdown(query = '') {
    const options = getEnemyOptions();
    const {
      effectiveQuery,
      showOverviewOption
    } = getEnemyDropdownQueryState(query, {
      mode: calculatorState.mode,
      compareView: calculatorState.compareView
    });

    if (!options || options.length === 0) {
      enemyDropdown.innerHTML = '';
      const noResults = document.createElement('div');
      noResults.className = 'dropdown-item';
      noResults.textContent = 'Loading enemy data...';
      enemyDropdown.appendChild(noResults);
      return;
    }

    const filteredOptions = options.filter((enemy) =>
      enemy.name.toLowerCase().includes(effectiveQuery) ||
      enemy.faction.toLowerCase().includes(effectiveQuery)
    );

    enemyDropdown.innerHTML = '';

    if (showOverviewOption) {
      const overviewItem = document.createElement('div');
      overviewItem.className = 'dropdown-item';
      overviewItem.innerHTML = 'Overview <span style="color:var(--muted); font-size:11px;">(all matching enemies)</span>';
      overviewItem.addEventListener('click', () => {
        setCompareView('overview');
        syncEnemyInputValue();
        closeDropdown();
        renderEnemyDetails();
        renderCalculation();
      });
      enemyDropdown.appendChild(overviewItem);
    }

    if (filteredOptions.length === 0 && enemyDropdown.children.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'dropdown-item';
      noResults.textContent = 'No enemies found';
      enemyDropdown.appendChild(noResults);
      return;
    }

    filteredOptions.forEach((enemy) => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.innerHTML = `${enemy.name} <span style="color:var(--muted); font-size:11px;">(${enemy.faction})</span>`;
      item.addEventListener('click', () => {
        setSelectedEnemy(enemy);
        syncEnemyInputValue();
        closeDropdown();
        renderEnemyDetails();
        renderCalculation();
      });
      enemyDropdown.appendChild(item);
    });
  }

  function openDropdown() {
    isOpen = true;
    enemyDropdown.classList.remove('hidden');
    populateDropdown(enemyInput.value);
  }

  function closeDropdown() {
    isOpen = false;
    enemyDropdown.classList.add('hidden');
  }

  enemyInput.addEventListener('focus', () => {
    if (!isOpen) {
      openDropdown();
    }
  });

  enemyInput.addEventListener('input', (event) => {
    if (!isOpen) {
      openDropdown();
    }

    populateDropdown(event.target.value);
  });

  document.addEventListener('click', (event) => {
    if (!enemyInput.contains(event.target) && !enemyDropdown.contains(event.target)) {
      closeDropdown();
    }
  });

  populateDropdown();

  const checkDataAvailability = setInterval(() => {
    if (enemyState.units && enemyState.units.length > 0) {
      if (isOpen) {
        populateDropdown(enemyInput.value);
      }
      clearInterval(checkDataAvailability);
    }
  }, 200);

  setTimeout(() => clearInterval(checkDataAvailability), 5000);
}
