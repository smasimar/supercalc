// calculator/data.js — calculator state management
import { state as weaponsState } from '../weapons/data.js';
import { enemyState } from '../enemies/data.js';

export const calculatorState = {
  selectedWeapon: null,
  selectedEnemy: null,
};

export function getWeaponOptions() {
  if (!weaponsState.groups) return [];
  
  // Define type order
  const typeOrder = ['primary', 'secondary', 'grenade', 'support', 'stratagem'];
  
  // Get all unique weapon groups and sort by Type then Code
  const weapons = weaponsState.groups
    .map(group => ({
      id: group.name,
      name: group.name,
      type: group.type,
      sub: group.sub,
      code: group.code,
      rows: group.rows // Keep all attack rows
    }))
    .sort((a, b) => {
      // Sort by Type first (using specific order)
      const aTypeIndex = typeOrder.indexOf(a.type?.toLowerCase() || '');
      const bTypeIndex = typeOrder.indexOf(b.type?.toLowerCase() || '');
      
      if (aTypeIndex !== bTypeIndex) {
        // If one is in the order list, prioritize it
        if (aTypeIndex === -1 && bTypeIndex >= 0) return 1;
        if (aTypeIndex >= 0 && bTypeIndex === -1) return -1;
        return aTypeIndex - bTypeIndex;
      }
      
      // Then by Code
      return (a.code || '').localeCompare(b.code || '');
    });
  
  return weapons;
}

export function getEnemyOptions() {
  return enemyState.units || [];
}

