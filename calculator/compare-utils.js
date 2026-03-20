import { getZoneDisplayedTtkSeconds, getZoneOutcomeKind, summarizeZoneDamage } from './zone-damage.js';

const ATTACK_KEY_FIELDS = ['Atk Type', 'Atk Name', 'DMG', 'DUR', 'AP', 'DF', 'ST', 'PF'];
const SINGLE_OUTCOME_GROUP_ORDER = {
  fatal: 0,
  main: 1,
  limb: 2,
  utility: 3,
  none: 4
};

const COMPARE_OUTCOME_GROUP_ORDER = {
  main: 0,
  oneSided: 1,
  fatal: 2,
  limb: 3,
  utility: 4,
  none: 5
};

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function getPinnedZoneOrderValue(row) {
  return normalizeText(row?.zone?.zone_name) === 'main' ? 0 : 1;
}

function isFiniteMetricValue(value) {
  return Number.isFinite(value);
}

function buildDiffMetric({ slotA, slotB, valueA, valueB }) {
  if (isFiniteMetricValue(valueA) && isFiniteMetricValue(valueB)) {
    const absoluteValue = valueB - valueA;
    const percentValue = valueA > 0 ? (absoluteValue / valueA) * 100 : null;
    return {
      kind: 'numeric',
      winner: absoluteValue < 0 ? 'B' : absoluteValue > 0 ? 'A' : null,
      valueA,
      valueB,
      displayValue: null,
      sortValue: absoluteValue,
      absoluteValue,
      absoluteSortValue: absoluteValue,
      percentValue,
      percentSortValue: percentValue
    };
  }

  const slotABlocked = slotA?.selectedAttackCount > 0 && !slotA?.damagesZone;
  const slotBBlocked = slotB?.selectedAttackCount > 0 && !slotB?.damagesZone;

  if (!isFiniteMetricValue(valueA) && isFiniteMetricValue(valueB) && slotABlocked) {
    return {
      kind: 'one-sided',
      winner: 'B',
      valueA,
      valueB,
      displayValue: valueB,
      sortValue: Number.NEGATIVE_INFINITY,
      absoluteValue: null,
      absoluteSortValue: Number.NEGATIVE_INFINITY,
      percentValue: null,
      percentSortValue: Number.NEGATIVE_INFINITY
    };
  }

  if (isFiniteMetricValue(valueA) && !isFiniteMetricValue(valueB) && slotBBlocked) {
    return {
      kind: 'one-sided',
      winner: 'A',
      valueA,
      valueB,
      displayValue: valueA,
      sortValue: Number.POSITIVE_INFINITY,
      absoluteValue: null,
      absoluteSortValue: Number.POSITIVE_INFINITY,
      percentValue: null,
      percentSortValue: Number.POSITIVE_INFINITY
    };
  }

    return {
      kind: 'unavailable',
      winner: null,
      valueA,
      valueB,
      displayValue: null,
      sortValue: null,
      absoluteValue: null,
      absoluteSortValue: null,
      percentValue: null,
      percentSortValue: null
  };
}

export function getDiffSortValue(diffMetric, diffDisplayMode = 'absolute') {
  if (!diffMetric) {
    return null;
  }

  if (diffDisplayMode === 'percent') {
    return diffMetric.percentSortValue ?? null;
  }

  return diffMetric.absoluteSortValue ?? diffMetric.sortValue ?? null;
}

export function getDiffDisplayMetric(diffMetric, diffDisplayMode = 'absolute') {
  if (!diffMetric) {
    return {
      kind: 'unavailable',
      winner: null,
      value: null,
      displayValue: null
    };
  }

  if (diffMetric.kind === 'one-sided') {
    return {
      kind: 'one-sided',
      winner: diffMetric.winner,
      value: null,
      displayValue: diffMetric.displayValue
    };
  }

  const value = diffDisplayMode === 'percent'
    ? diffMetric.percentValue
    : (diffMetric.absoluteValue ?? diffMetric.sortValue);

  if (value === null || value === undefined) {
    return {
      kind: 'unavailable',
      winner: null,
      value: null,
      displayValue: null
    };
  }

  return {
    kind: 'numeric',
    winner: diffMetric.winner,
    value,
    displayValue: null
  };
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

function hasOneSidedDiff(metrics) {
  return metrics?.diffShots?.kind === 'one-sided' || metrics?.diffTtkSeconds?.kind === 'one-sided';
}

function getOutcomeGroupValue(row, groupingSlot, mode) {
  if (mode === 'compare' && hasOneSidedDiff(row?.metrics)) {
    return COMPARE_OUTCOME_GROUP_ORDER.oneSided;
  }

  const outcomeKind = row?.metrics?.bySlot?.[groupingSlot]?.outcomeKind || 'none';
  const orderMap = mode === 'compare' ? COMPARE_OUTCOME_GROUP_ORDER : SINGLE_OUTCOME_GROUP_ORDER;
  return orderMap[outcomeKind] ?? orderMap.none;
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
    diffShots: buildDiffMetric({
      slotA,
      slotB,
      valueA: slotA.shotsToKill,
      valueB: slotB.shotsToKill
    }),
    diffTtkSeconds: buildDiffMetric({
      slotA,
      slotB,
      valueA: slotA.ttkSeconds,
      valueB: slotB.ttkSeconds
    })
  };
}

export function buildOverviewRows({
  units = [],
  scope = 'All',
  weaponA,
  weaponB,
  selectedAttacksA = [],
  selectedAttacksB = [],
  hitCountsA = [],
  hitCountsB = []
}) {
  return units
    .filter((unit) => scope === 'All' || unit?.faction === scope)
    .flatMap((unit) => {
      const enemyMainHealth = toFiniteNumber(unit?.health) ?? 0;
      return (unit?.zones || []).map((zone, zoneIndex) => ({
        id: `${unit.faction}::${unit.name}::${zone?.zone_name || ''}::${zoneIndex}`,
        faction: unit.faction,
        enemyName: unit.name,
        zone,
        zoneIndex,
        metrics: buildZoneComparisonMetrics({
          zone,
          enemyMainHealth,
          weaponA,
          weaponB,
          selectedAttacksA,
          selectedAttacksB,
          hitCountsA,
          hitCountsB
        })
      }));
    });
}

function isLethalHallOfFameRow(row) {
  const zoneName = normalizeText(row?.zone?.zone_name);
  return zoneName === 'main'
    || Boolean(row?.zone?.IsFatal)
    || row?.metrics?.bySlot?.A?.outcomeKind === 'fatal'
    || row?.metrics?.bySlot?.A?.outcomeKind === 'main'
    || row?.metrics?.bySlot?.B?.outcomeKind === 'fatal'
    || row?.metrics?.bySlot?.B?.outcomeKind === 'main';
}

function buildHallOfFameMetricCandidate(metricKey, diffMetric, diffDisplayMode) {
  const displayMetric = getDiffDisplayMetric(diffMetric, diffDisplayMode);
  if (displayMetric.kind === 'one-sided') {
    return {
      metricKey,
      winner: displayMetric.winner,
      displayMode: 'special',
      severity: Number.POSITIVE_INFINITY,
      diffMetric,
      displayMetric
    };
  }

  if (displayMetric.kind !== 'numeric' || !displayMetric.winner || displayMetric.value === 0) {
    return null;
  }

  return {
    metricKey,
    winner: displayMetric.winner,
    displayMode: diffDisplayMode,
    severity: Math.abs(displayMetric.value),
    diffMetric,
    displayMetric
  };
}

function getPreferredHallOfFameMetric(row, diffDisplayMode) {
  return buildHallOfFameMetricCandidate('ttk', row?.metrics?.diffTtkSeconds, diffDisplayMode)
    || buildHallOfFameMetricCandidate('shots', row?.metrics?.diffShots, diffDisplayMode)
    || (diffDisplayMode === 'percent'
      ? buildHallOfFameMetricCandidate('ttk', row?.metrics?.diffTtkSeconds, 'absolute')
        || buildHallOfFameMetricCandidate('shots', row?.metrics?.diffShots, 'absolute')
      : null);
}

export function buildHallOfFameEntries(rows, {
  diffDisplayMode = 'absolute',
  limit = 5
} = {}) {
  const entries = rows
    .map((row) => {
      const metric = getPreferredHallOfFameMetric(row, diffDisplayMode);
      if (!metric) {
        return null;
      }

      return {
        row,
        metric,
        isLethal: isLethalHallOfFameRow(row)
      };
    })
    .filter(Boolean);

  function sortEntriesForWinner(winner) {
    return entries
      .filter((entry) => entry.metric.winner === winner)
      .sort((left, right) => {
        if (left.isLethal !== right.isLethal) {
          return left.isLethal ? -1 : 1;
        }

        if (left.metric.severity !== right.metric.severity) {
          return right.metric.severity - left.metric.severity;
        }

        if (left.metric.metricKey !== right.metric.metricKey) {
          return left.metric.metricKey === 'ttk' ? -1 : 1;
        }

        return left.row.enemyName.localeCompare(right.row.enemyName)
          || left.row.zoneIndex - right.row.zoneIndex;
      })
      .slice(0, limit);
  }

  return {
    A: sortEntriesForWinner('A'),
    B: sortEntriesForWinner('B')
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

  return 'A';
}

export function getZoneSortValue(row, sortKey, diffDisplayMode = 'absolute') {
  switch (sortKey) {
    case 'faction':
      return normalizeText(row.faction);
    case 'enemy':
      return normalizeText(row.enemyName);
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
      return getDiffSortValue(row.metrics?.diffShots, diffDisplayMode);
    case 'ttkA':
      return row.metrics?.bySlot?.A?.ttkSeconds ?? null;
    case 'ttkB':
      return row.metrics?.bySlot?.B?.ttkSeconds ?? null;
    case 'ttkDiff':
      return getDiffSortValue(row.metrics?.diffTtkSeconds, diffDisplayMode);
    default:
      return normalizeText(row.zone?.[sortKey]);
  }
}

export function sortEnemyZoneRows(rows, {
  mode = 'single',
  sortKey = 'zone_name',
  sortDir = 'asc',
  groupMode = 'none',
  diffDisplayMode = 'absolute',
  pinMain = true
} = {}) {
  const groupingSlot = groupMode === 'outcome'
    ? getOutcomeGroupingSlot(mode, sortKey)
    : null;

  const sortedRows = [...rows].sort((left, right) => {
    if (pinMain) {
      const pinnedComparison = getPinnedZoneOrderValue(left) - getPinnedZoneOrderValue(right);
      if (pinnedComparison !== 0) {
        return pinnedComparison;
      }
    }

    if (groupingSlot) {
      const leftGroup = getOutcomeGroupValue(left, groupingSlot, mode);
      const rightGroup = getOutcomeGroupValue(right, groupingSlot, mode);

      if (leftGroup !== rightGroup) {
        return leftGroup - rightGroup;
      }
    }

    const valueComparison = compareNullableValues(
      getZoneSortValue(left, sortKey, diffDisplayMode),
      getZoneSortValue(right, sortKey, diffDisplayMode),
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
    const previousGroup = getOutcomeGroupValue(previous, groupingSlot, mode);
    const currentGroup = getOutcomeGroupValue(row, groupingSlot, mode);

    return {
      ...row,
      groupStart: previousGroup !== currentGroup
    };
  });
}
