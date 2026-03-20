import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAttackUnionRows,
  buildZoneComparisonMetrics,
  getAttackRowKey,
  getDefaultSelectedAttackKeys,
  getPreferredZoneIndex,
  sortEnemyZoneRows
} from '../calculator/compare-utils.js';

function makeAttackRow(name, damage, ap = 2) {
  return {
    'Atk Type': 'Projectile',
    'Atk Name': name,
    DMG: damage,
    DUR: 0,
    AP: ap,
    DF: 10,
    ST: 10,
    PF: 10
  };
}

function makeDiffMetric(value) {
  if (value && typeof value === 'object' && 'sortValue' in value) {
    return value;
  }

  return {
    kind: value === null ? 'unavailable' : 'numeric',
    sortValue: value,
    winner: null,
    displayValue: null
  };
}

function makeSortRow(zoneIndex, zoneName, {
  outcomeKindA = null,
  ttkA = null,
  shotsA = null,
  outcomeKindB = null,
  ttkB = null,
  shotsB = null,
  diffTtk = null,
  diffShots = null
} = {}) {
  return {
    zoneIndex,
    zone: {
      zone_name: zoneName
    },
    metrics: {
      bySlot: {
        A: {
          outcomeKind: outcomeKindA,
          ttkSeconds: ttkA,
          shotsToKill: shotsA
        },
        B: {
          outcomeKind: outcomeKindB,
          ttkSeconds: ttkB,
          shotsToKill: shotsB
      }
      },
      diffTtkSeconds: makeDiffMetric(diffTtk),
      diffShots: makeDiffMetric(diffShots)
    }
  };
}

test('getDefaultSelectedAttackKeys auto-selects a lone attack row only', () => {
  const loneAttack = makeAttackRow('Single', 100);

  assert.deepEqual(
    getDefaultSelectedAttackKeys({ rows: [loneAttack] }),
    [getAttackRowKey(loneAttack)]
  );

  assert.deepEqual(
    getDefaultSelectedAttackKeys({ rows: [loneAttack, makeAttackRow('Extra', 50)] }),
    []
  );
});

test('getPreferredZoneIndex prefers head, then fatal, then main, then first row', () => {
  assert.equal(getPreferredZoneIndex({
    zones: [
      { zone_name: 'torso', IsFatal: false },
      { zone_name: 'left head plate', IsFatal: false },
      { zone_name: 'Main', IsFatal: true }
    ]
  }), 1);

  assert.equal(getPreferredZoneIndex({
    zones: [
      { zone_name: 'torso', IsFatal: false },
      { zone_name: 'weakpoint', IsFatal: true },
      { zone_name: 'Main', IsFatal: false }
    ]
  }), 1);

  assert.equal(getPreferredZoneIndex({
    zones: [
      { zone_name: 'torso', IsFatal: false },
      { zone_name: 'Main', IsFatal: false }
    ]
  }), 1);

  assert.equal(getPreferredZoneIndex({
    zones: [
      { zone_name: 'torso', IsFatal: false },
      { zone_name: 'arm', IsFatal: false }
    ]
  }), 0);
});

test('buildAttackUnionRows keeps A ordering and appends B-only rows', () => {
  const sharedA = makeAttackRow('Shared', 100);
  const sharedB = makeAttackRow('Shared', 100);
  const rowAOnly = makeAttackRow('A only', 80);
  const rowBOnly = makeAttackRow('B only', 140);

  const unionRows = buildAttackUnionRows(
    { rows: [rowAOnly, sharedA] },
    { rows: [sharedB, rowBOnly] }
  );

  assert.deepEqual(
    unionRows.map((row) => row.key),
    [
      getAttackRowKey(rowAOnly),
      getAttackRowKey(sharedA),
      getAttackRowKey(rowBOnly)
    ]
  );
  assert.equal(unionRows[0].rowA, rowAOnly);
  assert.equal(unionRows[0].rowB, null);
  assert.equal(unionRows[1].rowA, sharedA);
  assert.equal(unionRows[1].rowB, sharedB);
  assert.equal(unionRows[2].rowA, null);
  assert.equal(unionRows[2].rowB, rowBOnly);
});

test('buildZoneComparisonMetrics computes A, B, and Diff as B minus A', () => {
  const metrics = buildZoneComparisonMetrics({
    zone: {
      health: 300,
      Con: 0,
      AV: 1,
      'Dur%': 0,
      'ToMain%': 0,
      ExTarget: 'Part',
      ExMult: 1,
      IsFatal: false
    },
    enemyMainHealth: 1000,
    weaponA: { rpm: 60 },
    weaponB: { rpm: 60 },
    selectedAttacksA: [makeAttackRow('A', 100)],
    selectedAttacksB: [makeAttackRow('B', 150)]
  });

  assert.equal(metrics.bySlot.A.shotsToKill, 3);
  assert.equal(metrics.bySlot.B.shotsToKill, 2);
  assert.equal(metrics.diffShots.kind, 'numeric');
  assert.equal(metrics.diffShots.sortValue, -1);

  assert.equal(metrics.bySlot.A.ttkSeconds, 2);
  assert.equal(metrics.bySlot.B.ttkSeconds, 1);
  assert.equal(metrics.diffTtkSeconds.kind, 'numeric');
  assert.equal(metrics.diffTtkSeconds.sortValue, -1);
});

test('buildZoneComparisonMetrics honors hit counts for each slot', () => {
  const metrics = buildZoneComparisonMetrics({
    zone: {
      health: 300,
      Con: 0,
      AV: 1,
      'Dur%': 0,
      'ToMain%': 0,
      ExTarget: 'Part',
      ExMult: 1,
      IsFatal: false
    },
    enemyMainHealth: 1000,
    weaponA: { rpm: 60 },
    weaponB: { rpm: 60 },
    selectedAttacksA: [makeAttackRow('A', 100)],
    selectedAttacksB: [makeAttackRow('B', 100)],
    hitCountsA: [2],
    hitCountsB: [1]
  });

  assert.equal(metrics.bySlot.A.zoneSummary.totalDamagePerCycle, 200);
  assert.equal(metrics.bySlot.A.shotsToKill, 2);
  assert.equal(metrics.bySlot.B.zoneSummary.totalDamagePerCycle, 100);
  assert.equal(metrics.bySlot.B.shotsToKill, 3);
  assert.equal(metrics.diffShots.sortValue, 1);
});

test('buildZoneComparisonMetrics marks one-sided damage wins as infinite diff severity', () => {
  const metrics = buildZoneComparisonMetrics({
    zone: {
      health: 300,
      Con: 0,
      AV: 3,
      'Dur%': 0,
      'ToMain%': 0,
      ExTarget: 'Part',
      ExMult: 1,
      IsFatal: false
    },
    enemyMainHealth: 1000,
    weaponA: { rpm: 60 },
    weaponB: { rpm: 60 },
    selectedAttacksA: [makeAttackRow('A', 100, 2)],
    selectedAttacksB: [makeAttackRow('B', 100, 4)]
  });

  assert.equal(metrics.bySlot.A.shotsToKill, null);
  assert.equal(metrics.bySlot.B.shotsToKill, 3);
  assert.equal(metrics.diffShots.kind, 'one-sided');
  assert.equal(metrics.diffShots.winner, 'B');
  assert.equal(metrics.diffShots.sortValue, Number.NEGATIVE_INFINITY);
  assert.equal(metrics.diffTtkSeconds.kind, 'one-sided');
  assert.equal(metrics.diffTtkSeconds.winner, 'B');
  assert.equal(metrics.diffTtkSeconds.displayValue, 2);
});

test('sortEnemyZoneRows sorts diff columns numerically and keeps unavailable rows last', () => {
  const rows = [
    makeSortRow(0, 'slower', { diffTtk: 1.25 }),
    makeSortRow(1, 'faster', { diffTtk: -0.5 }),
    makeSortRow(2, 'unavailable', { diffTtk: null })
  ];

  const ascending = sortEnemyZoneRows(rows, {
    mode: 'compare',
    sortKey: 'ttkDiff',
    sortDir: 'asc',
    groupMode: 'outcome'
  });
  assert.deepEqual(
    ascending.map((row) => row.zone.zone_name),
    ['faster', 'slower', 'unavailable']
  );

  const descending = sortEnemyZoneRows(rows, {
    mode: 'compare',
    sortKey: 'ttkDiff',
    sortDir: 'desc',
    groupMode: 'outcome'
  });
  assert.deepEqual(
    descending.map((row) => row.zone.zone_name),
    ['slower', 'faster', 'unavailable']
  );
});

test('sortEnemyZoneRows ranks one-sided diff wins beyond finite numeric deltas', () => {
  const rows = [
    makeSortRow(0, 'numeric-better', { diffTtk: -0.78 }),
    makeSortRow(1, 'b-only', {
      diffTtk: {
        kind: 'one-sided',
        sortValue: Number.NEGATIVE_INFINITY,
        winner: 'B',
        displayValue: 0
      }
    }),
    makeSortRow(2, 'numeric-worse', { diffTtk: 0.5 }),
    makeSortRow(3, 'a-only', {
      diffTtk: {
        kind: 'one-sided',
        sortValue: Number.POSITIVE_INFINITY,
        winner: 'A',
        displayValue: 1.2
      }
    })
  ];

  const ascending = sortEnemyZoneRows(rows, {
    mode: 'compare',
    sortKey: 'ttkDiff',
    sortDir: 'asc',
    groupMode: 'none'
  });
  assert.deepEqual(
    ascending.map((row) => row.zone.zone_name),
    ['b-only', 'numeric-better', 'numeric-worse', 'a-only']
  );

  const descending = sortEnemyZoneRows(rows, {
    mode: 'compare',
    sortKey: 'ttkDiff',
    sortDir: 'desc',
    groupMode: 'none'
  });
  assert.deepEqual(
    descending.map((row) => row.zone.zone_name),
    ['a-only', 'numeric-worse', 'numeric-better', 'b-only']
  );
});

test('sortEnemyZoneRows can group by outcome before sorting a side-specific ttk column', () => {
  const rows = [
    makeSortRow(0, 'utility', { outcomeKindA: 'utility', ttkA: 0.5 }),
    makeSortRow(1, 'fatal-slow', { outcomeKindA: 'fatal', ttkA: 2 }),
    makeSortRow(2, 'main', { outcomeKindA: 'main', ttkA: 0.25 }),
    makeSortRow(3, 'fatal-fast', { outcomeKindA: 'fatal', ttkA: 1 })
  ];

  const sorted = sortEnemyZoneRows(rows, {
    mode: 'single',
    sortKey: 'ttk',
    sortDir: 'asc',
    groupMode: 'outcome'
  });

  assert.deepEqual(
    sorted.map((row) => row.zone.zone_name),
    ['main', 'fatal-fast', 'fatal-slow', 'utility']
  );
  assert.equal(sorted[0].groupStart, false);
  assert.equal(sorted[1].groupStart, true);
  assert.equal(sorted[2].groupStart, false);
  assert.equal(sorted[3].groupStart, true);
});

test('sortEnemyZoneRows keeps the literal Main zone first regardless of sort direction', () => {
  const rows = [
    makeSortRow(0, 'arm', { shotsA: 2 }),
    makeSortRow(1, 'Main', { shotsA: 9 }),
    makeSortRow(2, 'head', { shotsA: 6 })
  ];

  const sorted = sortEnemyZoneRows(rows, {
    mode: 'single',
    sortKey: 'shots',
    sortDir: 'desc',
    groupMode: 'none'
  });

  assert.deepEqual(
    sorted.map((row) => row.zone.zone_name),
    ['Main', 'head', 'arm']
  );
});

test('sortEnemyZoneRows groups compare rows by A outcome when no B column is active', () => {
  const rows = [
    makeSortRow(0, 'utility', { outcomeKindA: 'utility', diffShots: -1 }),
    makeSortRow(1, 'main', { outcomeKindA: 'main', diffShots: 0 }),
    makeSortRow(2, 'fatal', { outcomeKindA: 'fatal', diffShots: 1 })
  ];

  const sorted = sortEnemyZoneRows(rows, {
    mode: 'compare',
    sortKey: 'shotsDiff',
    sortDir: 'asc',
    groupMode: 'outcome'
  });

  assert.deepEqual(
    sorted.map((row) => row.zone.zone_name),
    ['main', 'fatal', 'utility']
  );
  assert.equal(sorted[1].groupStart, true);
  assert.equal(sorted[2].groupStart, true);
});
