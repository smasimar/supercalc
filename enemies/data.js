// enemies/data.js — enemy data loading and state
export const enemyState = {
  factions: [],
  units: [],
  filteredUnits: [],
  filterActive: false,
  sortKey: null,
  sortDir: 'asc',
  // Pre-indexed data for faster filtering
  factionIndex: new Map(),
  searchIndex: new Map(),
};

export async function loadEnemyData() {
  try {
    // Add cache-busting timestamp to ensure fresh data
    const response = await fetch(`./enemies/enemydata.json?t=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    processEnemyData(data);
  } catch (error) {
    console.error('Failed to load enemy data:', error);
    throw error;
  }
}

export function processEnemyData(data) {
  enemyState.factions = [];
  enemyState.units = [];
  enemyState.factionIndex.clear();
  enemyState.searchIndex.clear();

  // Process each faction
  for (const [factionName, factionUnits] of Object.entries(data)) {
    enemyState.factions.push(factionName);
    
    // Process each unit in the faction
    for (const [unitName, unitData] of Object.entries(factionUnits)) {
      const unit = {
        faction: factionName,
        name: unitName,
        health: unitData.health,
        zones: unitData.damageable_zones || [],
        zoneCount: (unitData.damageable_zones || []).length
      };
      
      enemyState.units.push(unit);
      
      // Add to faction index
      if (!enemyState.factionIndex.has(factionName)) {
        enemyState.factionIndex.set(factionName, []);
      }
      enemyState.factionIndex.get(factionName).push(unit);
      
      // Build search index
      const searchText = [
        factionName,
        unitName,
        ...unit.zones.map(zone => zone.zone_name || ''),
        ...unit.zones.map(zone => Object.values(zone).map(v => String(v || '')))
      ].flat().map(v => String(v || '').toLowerCase()).join(' ');
      
      enemyState.searchIndex.set(unit, searchText);
    }
  }
  
  enemyState.filteredUnits = [];
  enemyState.filterActive = false;
}
