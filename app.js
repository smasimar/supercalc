import { loadCSV, loadFromText, ingestMatrix } from './data.js';
import { buildTypeFilters, buildSubFilters, renderTable } from './table.js';
import './filters.js'; // sets up event listeners for search & type/sub chips

// Tabs
const sections = {
  weapons: document.getElementById('tab-weapons'),
  enemies: document.getElementById('tab-enemies'),
  calculator: document.getElementById('tab-calculator')
};

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    for (const k in sections) sections[k].classList.toggle('hidden', k !== tab);
  });
});

// Data source controls
const dataModeSel = document.getElementById('dataMode');
const chooseFileBtn = document.getElementById('chooseFile');
const fileInput = document.getElementById('fileInput');
const reloadOnlineBtn = document.getElementById('reloadOnline');

function setStatus(msg, isError=false){
  const el = document.getElementById('statusMsg');
  if (!el) return; el.textContent = msg || ''; el.style.color = isError ? '#ff8080' : 'var(--muted)';
}
function hideDataControls(){ document.getElementById('dataControls').classList.add('hidden'); }
function showDataControls(){ document.getElementById('dataControls').classList.remove('hidden'); }

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
  try { await loadCSV(); initUI(); }
  catch (err) { console.error(err); setStatus('Online load failed. Try Upload.', true); showDataControls(); dataModeSel.value = 'file'; chooseFileBtn.classList.remove('hidden'); }
});
chooseFileBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const file = fileInput.files && fileInput.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { try { loadFromText(String(reader.result||'')); initUI(); } catch (err) { console.error(err); setStatus('Failed to parse uploaded file.', true); showDataControls(); } };
  reader.readAsText(file);
});

// Boot
const TEST_MODE = new URLSearchParams(location.search).has('test');
async function boot(){
  if (TEST_MODE) {
    document.getElementById('testBadge').textContent = '• Test mode active (using mock data)';
    const headers = ['Code','Name','Atk Name','Type','Sub','AP','DF','DMG','DUR','Atk Type'];
    const rows = [
      { Code:'ARC-01', Name:'Arc Blaster',        'Atk Name':'Arc Blaster',        Type:'Primary',   Sub:'Energy',     AP:'0',  DF:25, DMG:30,  DUR:0.5, 'Atk Type':'Arc' },
      { Code:'ARC-01', Name:'Arc Blaster',        'Atk Name':'Arc Blaster (Mk2)', Type:'Primary',   Sub:'Energy',     AP:'0',  DF:30, DMG:60,  DUR:0.3, 'Atk Type':'Explosion' },
      { Code:'GNP-02', Name:'Grenade Pistol',     'Atk Name':'Grenade Pistol',    Type:'Secondary', Sub:'Sidearm',    AP:'3',  DF:40, DMG:90,  DUR:0.0, 'Atk Type':'Projectile' },
      { Code:'GNP-02', Name:'Grenade Pistol',     'Atk Name':'Grenade Pistol',    Type:'Secondary', Sub:'Sidearm',    AP:'3',  DF:50, DMG:120, DUR:0.0, 'Atk Type':'Explosion' },
      { Code:'GL6-FR', Name:'GL-6 Frag',          'Atk Name':'GL-6 Frag',         Type:'Grenade',   Sub:'Explosive',  AP:'4',  DF:25, DMG:220, DUR:0.0, 'Atk Type':'Explosion' },
      { Code:'OBL-77', Name:'Orbital Laser',      'Atk Name':'Orbital Laser',     Type:'Support',   Sub:'Orbital',    AP:'6+', DF:30, DMG:300, DUR:2.0, 'Atk Type':'Beam' },
      { Code:'SPR-09', Name:'Spear',              'Atk Name':'Spear',             Type:'Stratagem', Sub:'Anti-Armor', AP:'5',  DF:25, DMG:200, DUR:0.0, 'Atk Type':'Impact' },
      { Code:'FLM-10', Name:'Flamethrower',       'Atk Name':'Flamethrower',      Type:'Primary',   Sub:'Spray',      AP:'1/2',DF:25, DMG:25,  DUR:1.8, 'Atk Type':'Spray' }
    ];
    ingestMatrix([headers, ...rows.map(r => headers.map(h => r[h]))]);
    initUI();
  } else {
    try { await loadCSV(); initUI(); }
    catch (err) { console.error('CSV load failed:', err); setStatus('Online load failed. Use Upload.', true); showDataControls(); dataModeSel.value = 'file'; chooseFileBtn.classList.remove('hidden'); }
  }
}

boot();
