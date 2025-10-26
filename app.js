import { loadCSV, loadFromText, ingestMatrix, state as weaponsState } from './weapons/data.js';
import { buildTypeFilters, buildSubFilters, renderTable } from './weapons/table.js';
import { loadEnemyData } from './enemies/data.js';
import { renderEnemyTable, setupEnemyTableSorting } from './enemies/table.js';
import { buildEnemyFactionFilters } from './enemies/filters.js';
import { setupCalculator } from './calculator/ui.js';
import './weapons/filters.js'; // sets up event listeners for search & type/sub chips
import './enemies/filters.js'; // sets up event listeners for enemy search

// Expose weapons state globally for calculator rendering
window._weaponsState = weaponsState;

// Track if enemy data has been loaded
let enemyDataLoaded = false;
// Track if calculator has been initialized
let calculatorInitialized = false;

// Tabs
const sections = {
  weapons: document.getElementById('tab-weapons'),
  enemies: document.getElementById('tab-enemies'),
  calculator: document.getElementById('tab-calculator')
};

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    for (const k in sections) sections[k].classList.toggle('hidden', k !== tab);
    
    // Initialize weapons UI when weapons tab is activated (if data is loaded)
    if (tab === 'weapons') {
      // Check if UI hasn't been initialized yet
      const typeFilters = document.getElementById('typeFilters');
      if (typeFilters && typeFilters.children.length === 0) {
        buildTypeFilters();
        buildSubFilters();
        renderTable();
        showSourceLink();
      }
    }
    
    // Load enemy data when enemies tab is activated (only once)
    if (tab === 'enemies' && !enemyDataLoaded && !window.enemyDataLoaded) {
      const enemyStatusEl = document.getElementById('enemyStatusMsg');
      const enemySourceEl = sections.enemies.querySelector('.source-links');
      try {
        if (enemyStatusEl) enemyStatusEl.textContent = 'Loading enemy data...';
        await loadEnemyData();
        buildEnemyFactionFilters();
        renderEnemyTable();
        setupEnemyTableSorting();
        if (enemyStatusEl) enemyStatusEl.textContent = '';
        if (enemySourceEl) enemySourceEl.classList.remove('hidden');
        enemyDataLoaded = true;
      } catch (err) {
        console.error('Failed to load enemy data:', err);
        if (enemyStatusEl) {
          enemyStatusEl.textContent = 'Failed to load enemy data';
          enemyStatusEl.style.color = '#ff8080';
        }
      }
    } else if (tab === 'enemies' && (enemyDataLoaded || window.enemyDataLoaded)) {
      // Just re-render if data is already loaded
      buildEnemyFactionFilters();
      renderEnemyTable();
      const enemySourceEl = sections.enemies.querySelector('.source-links');
      if (enemySourceEl) enemySourceEl.classList.remove('hidden');
    }
    
    // Initialize calculator when calculator tab is first activated
    if (tab === 'calculator' && !calculatorInitialized) {
      setupCalculator();
      calculatorInitialized = true;
    }
  });
});

function showSourceLink(){ sections.weapons.querySelector('.source-links')?.classList.remove('hidden'); }
function hideSourceLink(){ sections.weapons.querySelector('.source-links')?.classList.add('hidden'); }

function showLoading(indicatorId = 'loadingIndicator') {
  const loadingEl = document.getElementById(indicatorId);
  if (loadingEl) loadingEl.classList.remove('hidden');
}

function hideLoading(indicatorId = 'loadingIndicator') {
  const loadingEl = document.getElementById(indicatorId);
  if (loadingEl) loadingEl.classList.add('hidden');
}

// Build filters + render once data is available
function initUI(){
  // Avoid double-building if already built
  const typeFilters = document.getElementById('typeFilters');
  if (typeFilters && typeFilters.children.length === 0) {
    buildTypeFilters();
  }
  const subFilters = document.getElementById('subFilters');
  if (subFilters && subFilters.children.length === 0) {
    buildSubFilters();
  }
  // Always render (will also render when filters already exist)
  renderTable();
  console.debug('[initUI] UI initialized');
}

// Boot
const TEST_MODE = new URLSearchParams(location.search).has('test');
async function boot(){
  if (TEST_MODE) {
    const testBadge = document.getElementById('testBadge');
    if (testBadge) testBadge.textContent = '• Test mode active (using mock data)';
    const headers = ['Type','Sub','Code','Name','Atk Type','Atk Name','DMG','DUR','AP','DF','ST','PF'];
    const rows = [
      { Type:'Primary', Sub:'AR', Code:'AR-23', Name:'Liberator', 'Atk Type':'projectile', 'Atk Name':'5.5x50mm FULL METAL JACKET_P', DMG:90, DUR:22, AP:2, DF:10, ST:15, PF:10 },
      { Type:'Primary', Sub:'AR', Code:'AR-23P', Name:'Liberator Penetrator', 'Atk Type':'projectile', 'Atk Name':'5.5x50mm PENETRATOR_P', DMG:65, DUR:15, AP:3, DF:10, ST:10, PF:10 },
      { Type:'Secondary', Sub:'PDW', Code:'P-2', Name:'Peacemaker', 'Atk Type':'projectile', 'Atk Name':'9x20mm HOLLOW POINT_P', DMG:95, DUR:30, AP:2, DF:10, ST:15, PF:4 },
      { Type:'Grenade', Sub:'GR', Code:'G-6', Name:'Frag', 'Atk Type':'explosion', 'Atk Name':'G-6 FRAG_E', DMG:500, DUR:50, AP:3, DF:20, ST:25, PF:40 },
      { Type:'Grenade', Sub:'GR', Code:'G-6', Name:'Frag', 'Atk Type':'projectile', 'Atk Name':'SHRAPNEL_P x35', DMG:110, DUR:35, AP:3, DF:10, ST:10, PF:20 },
      { Type:'Support', Sub:'MG', Code:'MG-43', Name:'Machine Gun', 'Atk Type':'projectile', 'Atk Name':'8x60mm FULL METAL JACKET_P1', DMG:90, DUR:23, AP:3, DF:10, ST:20, PF:12 },
      { Type:'Stratagem', Sub:'ORB', Code:'-', Name:'ORBITAL PRECISION STRIKE', 'Atk Type':'projectile', 'Atk Name':'380mm HE CANNON ROUND_P', DMG:3500, DUR:3500, AP:8, DF:50, ST:50, PF:20 },
      { Type:'Stratagem', Sub:'ORB', Code:'-', Name:'ORBITAL PRECISION STRIKE', 'Atk Type':'explosion', 'Atk Name':'380mm HE CANNON ROUND_P_IE', DMG:1000, DUR:1000, AP:6, DF:50, ST:70, PF:60 }
    ];
    ingestMatrix([headers, ...rows.map(r => headers.map(h => r[h]))]);
    initUI(); 
    hideSourceLink();
    hideLoading('calculator-weapon-loading');
    
    // Also load enemy data in test mode
    loadEnemyData().then(() => {
      window.enemyDataLoaded = true;
      hideLoading('calculator-enemy-loading');
    }).catch(err => {
      console.error('Failed to load enemy data in test mode:', err);
      hideLoading('calculator-enemy-loading');
    });
  } else {
    // Show loading indicators on calculator (which opens first)
    showLoading('calculator-weapon-loading');
    showLoading('calculator-enemy-loading');
    
    try { 
      await loadCSV();
      hideLoading('calculator-weapon-loading');
      
      // Load enemy data
      try {
        await loadEnemyData();
        window.enemyDataLoaded = true;
        hideLoading('calculator-enemy-loading');
      } catch (err) {
        console.error('Failed to load enemy data on boot:', err);
        hideLoading('calculator-enemy-loading');
      }
      
      // Only initialize weapons UI if weapons tab is visible (calculator tab is default now)
      if (!sections.weapons.classList.contains('hidden')) {
        initUI(); 
        showSourceLink();
      }
    }
    catch (err) { 
      console.error('CSV load failed:', err); 
      hideLoading('calculator-weapon-loading');
    }
  }
  
  // Initialize calculator since it's the default tab
  if (!calculatorInitialized) {
    setupCalculator();
    calculatorInitialized = true;
  }
}

boot();
