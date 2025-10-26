// calculator/ui.js — calculator UI components
import { calculatorState, getWeaponOptions, getEnemyOptions } from './data.js';
import { state as weaponsState } from '../weapons/data.js';
import { enemyState } from '../enemies/data.js';
import { renderWeaponDetails, renderEnemyDetails } from './rendering.js';

export function setupCalculator() {
  // Check if enemy data was already loaded and mark it as loaded
  if (enemyState.units && enemyState.units.length > 0) {
    window.enemyDataLoaded = true;
  }
  
  setupWeaponSelector();
  setupEnemySelector();
}

function setupWeaponSelector() {
  const weaponInput = document.getElementById('calculator-weapon-input');
  const weaponDropdown = document.getElementById('calculator-weapon-dropdown');
  
  if (!weaponInput || !weaponDropdown) return;
  
  let isOpen = false;
  let filteredOptions = [];
  
  // Populate options
  function populateDropdown(query = '') {
    const options = getWeaponOptions();
    filteredOptions = options.filter(weapon => {
      // Build the searchable text from all fields
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
    
    filteredOptions.forEach((weapon, index) => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      
      // Format: [$Type][$Subtype]$Code $Name
      const type = weapon.type || '';
      const sub = weapon.sub || '';
      const code = weapon.code || '';
      const name = weapon.name || '';
      const displayText = `[${type}]${sub ? `[${sub}]` : ''}${code} ${name}`;
      
      item.textContent = displayText;
      item.addEventListener('click', () => {
        selectWeapon(weapon, displayText);
        closeDropdown();
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
  
  function selectWeapon(weapon, displayText) {
    calculatorState.selectedWeapon = weapon;
    weaponInput.value = displayText || weapon.name;
    renderWeaponDetails(weapon);
  }
  
  // Input focus/typing
  weaponInput.addEventListener('focus', () => {
    if (!isOpen) {
      openDropdown();
    }
  });
  
  weaponInput.addEventListener('input', (e) => {
    if (!isOpen) openDropdown();
    populateDropdown(e.target.value);
  });
  
  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!weaponInput.contains(e.target) && !weaponDropdown.contains(e.target)) {
      closeDropdown();
    }
  });
  
  // Populate initially
  populateDropdown();
}

function setupEnemySelector() {
  const enemyInput = document.getElementById('calculator-enemy-input');
  const enemyDropdown = document.getElementById('calculator-enemy-dropdown');
  
  if (!enemyInput || !enemyDropdown) return;
  
  let isOpen = false;
  let filteredOptions = [];
  
  // Populate options
  function populateDropdown(query = '') {
    const options = getEnemyOptions();
    
    // Check if enemy data is loaded
    if (!options || options.length === 0) {
      enemyDropdown.innerHTML = '';
      const noResults = document.createElement('div');
      noResults.className = 'dropdown-item';
      noResults.textContent = 'Loading enemy data...';
      enemyDropdown.appendChild(noResults);
      return;
    }
    
    filteredOptions = options.filter(enemy => 
      enemy.name.toLowerCase().includes(query.toLowerCase()) ||
      enemy.faction.toLowerCase().includes(query.toLowerCase())
    );
    
    enemyDropdown.innerHTML = '';
    
    if (filteredOptions.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'dropdown-item';
      noResults.textContent = 'No enemies found';
      enemyDropdown.appendChild(noResults);
      return;
    }
    
    filteredOptions.forEach((enemy, index) => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.innerHTML = `<strong>[${enemy.health} HP]</strong> ${enemy.name} <span style="color:var(--muted); font-size:11px;">(${enemy.faction})</span>`;
      item.addEventListener('click', () => {
        selectEnemy(enemy);
        closeDropdown();
      });
      enemyDropdown.appendChild(item);
    });
  }
  
  function openDropdown() {
    isOpen = true;
    enemyDropdown.classList.remove('hidden');
    populateDropdown(enemyInput.value);
    
    // Check periodically if enemy data becomes available
    if (getEnemyOptions().length === 0) {
      const checkInterval = setInterval(() => {
        if (getEnemyOptions().length > 0) {
          populateDropdown(enemyInput.value);
          clearInterval(checkInterval);
        }
      }, 200);
      
      // Clear interval after 5 seconds
      setTimeout(() => clearInterval(checkInterval), 5000);
    }
  }
  
  function closeDropdown() {
    isOpen = false;
    enemyDropdown.classList.add('hidden');
  }
  
  function selectEnemy(enemy) {
    calculatorState.selectedEnemy = enemy;
    enemyInput.value = `[${enemy.health} HP] ${enemy.name}`;
    renderEnemyDetails(enemy);
  }
  
  // Input focus/typing
  enemyInput.addEventListener('focus', () => {
    if (!isOpen) {
      openDropdown();
    }
  });
  
  enemyInput.addEventListener('input', (e) => {
    if (!isOpen) openDropdown();
    populateDropdown(e.target.value);
  });
  
  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!enemyInput.contains(e.target) && !enemyDropdown.contains(e.target)) {
      closeDropdown();
    }
  });
  
  // Populate initially
  populateDropdown();
}

