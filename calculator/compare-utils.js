import { getZoneDisplayedTtkSeconds, getZoneOutcomeKind, summarizeZoneDamage } from './zone-damage.js';

const ATTACK_KEY_FIELDS = ['Atk Type', 'Atk Name', 'DMG', 'DUR', 'AP', 'DF', 'ST', 'PF'];
const OUTCOME_GROUP_ORDER = {
  fatal: 0,
  main: 1,
  limb: 2,
  utility: 3,
  none: 4
};

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isNullishSortValue(value) {
  return value === null || value === undefined || value === '';
}

function compareNullableValues(a, b, direction = 'asc') {
  const aMissing = isNullishSortValue(a);
  const bMissing = isNullishSortValue(b);

  if (aMissing && bMissing) {
    return 0;
  }

  if (aMissing) {
    return 1;
  }

  if (bMissing) {
    return -1;
  }

  let comparison = 0;
  if (typeof a === 'string' || typeof b === 'string') {
    comparison = String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: 'base'
    });
  } else if (a > b) {
    comparison = 1;
  } else if (a < b) {
    comparison = -1;
  }

  return direction === 'desc' ? -comparison : comparison;
}

function summarizeZoneForSlot({ zone, enemyMainHealth, weapon, selectedAttacks = [], hitCounts = [] }) {
  const zoneSummary = summarizeZoneDamage({
    zone,
    enemyMainHealth,
    selectedAttacks,
    hitCounts,
    rpm: weapon?.rpm
  });
  const outcomeKind = getZoneOutcomeKind({
    zone,
    totalDamagePerCycle: zoneSummary?.totalDamagePerCycle || 0,
    totalDamageToMainPerCycle: zoneSummary?.totalDamageToMainPerCycle || 0,
    killSummary: zoneSummary?.killSummary
  });

  return {
    weapon,
    selectedAttackCount: selectedAttacks.length,
    zoneSummary,
    outcomeKind,
    damagesZone: (zoneSummary?.totalDamagePerCycle || 0) > 0,
    shotsToKill: zoneSummary?.killSummary?.zoneShotsToKill ?? null,
    ttkSeconds: getZoneDisplayedTtkSeconds(outcomeKind, zoneSummary?.killSummary),
    hasRpm: zoneSummary?.killSummary?.hasRpm ?? false
  };
}

function getOutcomeGroupValue(outcomeKind) {
  return OUTCOME_GROUP_ORDER[outcomeKind || 'none'] ?? OUTCOME_GROUP_ORDER.none;
}

export function getAttackRowKey(row) {
  return ATTACK_KEY_FIELDS
    .map((field) => `${field}:${String(row?.[field] ?? '')}`)
    .join('|');
}

export function getDefaultSelectedAttackKeys(weapon) {
  if (!weapon?.rows || weapon.rows.length !== 1) {
    return [];
  }

  return [getAttackRowKey(weapon.rows[0])];
}

export function getPreferredZoneIndex(enemy) {
  if (!enemy?.zones || enemy.zones.length === 0) {
    return null;
  }

  const headIndex = enemy.zones.findIndex((zone) => normalizeText(zone?.zone_name).includes('head'));
  if (headIndex >= 0) {
    return headIndex;
  }

  const fatalIndex = enemy.zones.findIndex((zone) => Boolean(zone?.IsFatal));
  if (fatalIndex >= 0) {
    return fatalIndex;
  }

  const mainIndex = enemy.zones.findIndex((zone) => normalizeText(zone?.zone_name) === 'main');
  if (mainIndex >= 0) {
    return mainIndex;
  }

  return 0;
}

export function buildAttackUnionRows(weaponA, weaponB) {
  const unionMap = new Map();
  const unionRows = [];

  function addWeaponRows(slot, weapon) {
    if (!weapon?.rows) {
      return;
    }

    weapon.rows.forEach((row) => {
      const key = getAttackRowKey(row);
      let entry = unionMap.get(key);

      if (!entry) {
        entry = {
          key,
          displayRow: row,
          rowA: null,
          rowB: null
        };
        unionMap.set(key, entry);
        unionRows.push(entry);
      }

      if (slot === 'A') {
        entry.rowA = row;
      } else {
        entry.rowB = row;
      }
    });
  }

  addWeaponRows('A', weaponA);
  addWeaponRows('B', weaponB);

  return unionRows;
}

export function calculateDiffValue(aValue, bValue) {
  if (aValue === null || aValue === undefined || bValue === null || bValue === undefined) {
    return null;
  }

  return bValue - aValue;
}

export function buildZoneComparisonMetrics({
  zone,
  enemyMainHealth,
  weaponA,
  weaponB,
  selectedAttacksA = [],
  selectedAttacksB = [],
  hitCountsA = [],
  hitCountsB = []
}) {
  const slotA = summarizeZoneForSlot({
    zone,
    enemyMainHealth,
    weapon: weaponA,
    selectedAttacks: selectedAttacksA,
    hitCounts: hitCountsA
  });
  const slotB = summarizeZoneForSlot({
    zone,
    enemyMainHealth,
    weapon: weaponB,
    selectedAttacks: selectedAttacksB,
    hitCounts: hitCountsB
  });

  return {
    bySlot: {
      A: slotA,
      B: slotB
    },
    diffShots: calculateDiffValue(slotA.shotsToKill, slotB.shotsToKill),
    diffTtkSeconds: calculateDiffValue(slotA.ttkSeconds, slotB.ttkSeconds)
  };
}

export function getOutcomeGroupingSlot(mode, sortKey) {
  if (mode !== 'compare') {
    return 'A';
  }

  if (sortKey === 'shotsA' || sortKey === 'ttkA') {
    return 'A';
  }

  if (sortKey === 'shotsB' || sortKey === 'ttkB') {
    return 'B';
  }

  return null;
}

export function getZoneSortValue(row, sortKey) {
  switch (sortKey) {
    case 'zone_name':
      return normalizeText(row.zone?.zone_name);
    case 'health':
      return toFiniteNumber(row.zone?.health);
    case 'Con':
      return toFiniteNumber(row.zone?.Con);
    case 'Dur%':
      return toFiniteNumber(row.zone?.['Dur%']);
    case 'AV':
      return toFiniteNumber(row.zone?.AV);
    case 'IsFatal':
      return row.zone?.IsFatal ? 1 : 0;
    case 'ExTarget':
      return normalizeText(row.zone?.ExTarget);
    case 'ExMult':
      return row.zone?.ExMult === '-' ? null : toFiniteNumber(row.zone?.ExMult);
    case 'ToMain%':
      return toFiniteNumber(row.zone?.['ToMain%']);
    case 'MainCap':
      return row.zone?.MainCap ? 1 : 0;
    case 'shots':
      return row.metrics?.bySlot?.A?.shotsToKill ?? null;
    case 'ttk':
      return row.metrics?.bySlot?.A?.ttkSeconds ?? null;
    case 'shotsA':
      return row.metrics?.bySlot?.A?.shotsToKill ?? null;
    case 'shotsB':
      return row.metrics?.bySlot?.B?.shotsToKill ?? null;
    case 'shotsDiff':
      return row.metrics?.diffShots ?? null;
    case 'ttkA':
      return row.metrics?.bySlot?.A?.ttkSeconds ?? null;
    case 'ttkB':
      return row.metrics?.bySlot?.B?.ttkSeconds ?? null;
    case 'ttkDiff':
      return row.metrics?.diffTtkSeconds ?? null;
    default:
      return normalizeText(row.zone?.[sortKey]);
  }
}

export function sortEnemyZoneRows(rows, {
  mode = 'single',
  sortKey = 'zone_name',
  sortDir = 'asc',
  groupMode = 'none'
} = {}) {
  const groupingSlot = groupMode === 'outcome'
    ? getOutcomeGroupingSlot(mode, sortKey)
    : null;

  const sortedRows = [...rows].sort((left, right) => {
    if (groupingSlot) {
      const leftGroup = getOutcomeGroupValue(left.metrics?.bySlot?.[groupingSlot]?.outcomeKind);
      const rightGroup = getOutcomeGroupValue(right.metrics?.bySlot?.[groupingSlot]?.outcomeKind);

      if (leftGroup !== rightGroup) {
        return leftGroup - rightGroup;
      }
    }

    const valueComparison = compareNullableValues(
      getZoneSortValue(left, sortKey),
      getZoneSortValue(right, sortKey),
      sortDir
    );
    if (valueComparison !== 0) {
      return valueComparison;
    }

    return left.zoneIndex - right.zoneIndex;
  });

  return sortedRows.map((row, index) => {
    if (!groupingSlot || index === 0) {
      return {
        ...row,
        groupStart: false
      };
    }

    const previous = sortedRows[index - 1];
    const previousGroup = getOutcomeGroupValue(previous.metrics?.bySlot?.[groupingSlot]?.outcomeKind);
    const currentGroup = getOutcomeGroupValue(row.metrics?.bySlot?.[groupingSlot]?.outcomeKind);

    return {
      ...row,
      groupStart: previousGroup !== currentGroup
    };
  });
}
