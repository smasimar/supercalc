import { loadCSV, loadFromText, ingestMatrix } from './weapons/data.js';
import { buildTypeFilters, buildSubFilters, renderTable } from './weapons/table.js';
import { loadEnemyData } from './enemies/data.js';
import { renderEnemyTable, setupEnemyTableSorting } from './enemies/table.js';
import { buildEnemyFactionFilters } from './enemies/filters.js';
import './weapons/filters.js'; // sets up event listeners for search & type/sub chips
import './enemies/filters.js'; // sets up event listeners for enemy search

// Track if enemy data has been loaded
let enemyDataLoaded = false;

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
    
    // Load enemy data when enemies tab is activated (only once)
    if (tab === 'enemies' && !enemyDataLoaded) {
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
    } else if (tab === 'enemies' && enemyDataLoaded) {
      // Just re-render if data is already loaded
      renderEnemyTable();
    }
  });
});

// Data source controls
const dataModeSel = document.getElementById('dataMode');
const chooseFileBtn = document.getElementById('chooseFile');
const fileInput = document.getElementById('fileInput');
const reloadOnlineBtn = document.getElementById('reloadOnline');

function setStatus(msg, isError=false, showRetry=false){
  const el = document.getElementById('statusMsg');
  if (!el) return; 
  
  el.textContent = msg || ''; 
  el.style.color = isError ? '#ff8080' : 'var(--muted)';
  
  // Add retry button for errors
  if (isError && showRetry) {
    const retryBtn = document.createElement('button');
    retryBtn.textContent = 'Retry';
    retryBtn.className = 'retry-btn';
    retryBtn.style.marginLeft = '8px';
    retryBtn.style.padding = '2px 8px';
    retryBtn.style.fontSize = '12px';
    retryBtn.style.border = '1px solid #ff8080';
    retryBtn.style.background = 'transparent';
    retryBtn.style.color = '#ff8080';
    retryBtn.style.borderRadius = '3px';
    retryBtn.style.cursor = 'pointer';
    
    retryBtn.addEventListener('click', async () => {
      retryBtn.remove();
      setStatus('Retrying...', false);
      try {
        await loadCSV(); 
        initUI(); 
        showSourceLink();
        setStatus('Data loaded successfully', false);
      } catch (err) {
        console.error('Retry failed:', err);
        setStatus('Retry failed. Try uploading a file.', true, true);
        showDataControls();
        dataModeSel.value = 'file';
        chooseFileBtn.classList.remove('hidden');
      }
    });
    
    el.appendChild(retryBtn);
  }
}
function hideDataControls(){ document.getElementById('dataControls').classList.add('hidden'); }
function showDataControls(){ document.getElementById('dataControls').classList.remove('hidden'); }
function hideSourceLink(){ sections.weapons.querySelector('.source-links')?.classList.add('hidden'); }
function showSourceLink(){ sections.weapons.querySelector('.source-links')?.classList.remove('hidden'); }

function showLoading() {
  const loadingEl = document.getElementById('loadingIndicator');
  if (loadingEl) loadingEl.classList.remove('hidden');
}

function hideLoading() {
  const loadingEl = document.getElementById('loadingIndicator');
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
  // Hide controls after successful data load
  hideDataControls();
  // Debug marker
  console.debug('[initUI] UI initialized');
}

// keep native input hidden, only show our button in file mode
dataModeSel.addEventListener('change', () => {
  chooseFileBtn.classList.toggle('hidden', dataModeSel.value !== 'file');
});
reloadOnlineBtn.addEventListener('click', async () => {
  try { 
    setStatus('Loading data...', false);
    showLoading();
    await loadCSV(); 
    initUI(); 
    showSourceLink();
    setStatus('Data loaded successfully', false);
    hideLoading();
  }
  catch (err) { 
    console.error(err); 
    hideLoading();
    setStatus('Online load failed. Try Upload.', true, true); 
    showDataControls(); 
    dataModeSel.value = 'file'; 
    chooseFileBtn.classList.remove('hidden'); 
  }
});
chooseFileBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const file = fileInput.files && fileInput.files[0]; 
  if (!file) return;
  
  setStatus('Reading file...', false);
  showLoading();
  const reader = new FileReader();
  reader.onload = () => { 
    try { 
      loadFromText(String(reader.result||'')); 
      initUI(); 
      hideSourceLink();
      setStatus('File loaded successfully', false);
      hideLoading();
    } catch (err) { 
      console.error(err); 
      hideLoading();
      setStatus('Failed to parse uploaded file.', true); 
      showDataControls(); 
    } 
  };
  reader.readAsText(file);
});

// Boot
const TEST_MODE = new URLSearchParams(location.search).has('test');
async function boot(){
  if (TEST_MODE) {
    document.getElementById('testBadge').textContent = '• Test mode active (using mock data)';
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
  } else {
    try { 
      setStatus('Loading data...', false);
      showLoading();
      await loadCSV(); 
      initUI(); 
      showSourceLink();
      setStatus('Data loaded successfully', false);
      hideLoading();
    }
    catch (err) { 
      console.error('CSV load failed:', err); 
      hideLoading();
      setStatus('Online load failed. Use Upload.', true, true); 
      showDataControls(); 
      dataModeSel.value = 'file'; 
      chooseFileBtn.classList.remove('hidden'); 
    }
  }
}

boot();
