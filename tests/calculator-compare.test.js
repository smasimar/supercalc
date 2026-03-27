import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAttackUnionRows,
  buildHallOfFameEntries,
  buildOverviewRows,
  buildZoneComparisonMetrics,
  getDiffDisplayMetric,
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
  if (value && typeof value === 'object' && ('sortValue' in value || 'absoluteSortValue' in value)) {
    return value;
  }

  return {
    kind: value === null ? 'unavailable' : 'numeric',
    valueA: null,
    valueB: null,
    winner: value < 0 ? 'B' : value > 0 ? 'A' : null,
    displayValue: null,
    sortValue: value,
    absoluteValue: value,
    absoluteSortValue: value,
    percentValue: null,
    percentSortValue: null
  };
}

function makeSortRow(zoneIndex, zoneName, {
  faction = 'Terminids',
  enemyName = 'Sample Enemy',
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
    faction,
    enemyName,
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

function makeZone(zoneName, {
  health = 300,
  isFatal = false,
  av = 1,
  toMainPercent = 0
} = {}) {
  return {
    zone_name: zoneName,
    health,
    Con: 0,
    AV: av,
    'Dur%': 0,
    'ToMain%': toMainPercent,
    ExTarget: 'Part',
    ExMult: 1,
    IsFatal: isFatal
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
  assert.equal(metrics.diffShots.percentValue, (-1 / 3) * 100);

  assert.equal(metrics.bySlot.A.ttkSeconds, 2);
  assert.equal(metrics.bySlot.B.ttkSeconds, 1);
  assert.equal(metrics.diffTtkSeconds.kind, 'numeric');
  assert.equal(metrics.diffTtkSeconds.sortValue, -1);
  assert.equal(metrics.diffTtkSeconds.percentValue, -50);
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
  assert.equal(metrics.diffTtkSeconds.percentSortValue, Number.NEGATIVE_INFINITY);
});

test('getDiffDisplayMetric returns percent values when available', () => {
  const metrics = buildZoneComparisonMetrics({
    zone: makeZone('head', { health: 300, isFatal: true }),
    enemyMainHealth: 1000,
    weaponA: { rpm: 60 },
    weaponB: { rpm: 120 },
    selectedAttacksA: [makeAttackRow('A', 100)],
    selectedAttacksB: [makeAttackRow('B', 100)]
  });

  const displayMetric = getDiffDisplayMetric(metrics.diffTtkSeconds, 'percent');
  assert.equal(displayMetric.kind, 'numeric');
  assert.equal(displayMetric.winner, 'B');
  assert.equal(displayMetric.value, -50);
});

test('buildOverviewRows flattens units and filters by faction scope', () => {
  const units = [
    {
      faction: 'Terminids',
      name: 'Stalker',
      health: 800,
      zones: [makeZone('Main'), makeZone('head', { isFatal: true })]
    },
    {
      faction: 'Automatons',
      name: 'Devastator',
      health: 900,
      zones: [makeZone('Main')]
    }
  ];

  const allRows = buildOverviewRows({
    units,
    scope: 'All',
    weaponA: { rpm: 60 },
    weaponB: { rpm: 60 },
    selectedAttacksA: [makeAttackRow('A', 100)],
    selectedAttacksB: [makeAttackRow('B', 100)]
  });
  assert.equal(allRows.length, 3);
  assert.equal(allRows[0].faction, 'Terminids');
  assert.equal(allRows[0].enemyName, 'Stalker');

  const automatonRows = buildOverviewRows({
    units,
    scope: 'Automatons',
    weaponA: { rpm: 60 },
    weaponB: { rpm: 60 },
    selectedAttacksA: [makeAttackRow('A', 100)],
    selectedAttacksB: [makeAttackRow('B', 100)]
  });
  assert.deepEqual(
    automatonRows.map((row) => `${row.faction}:${row.enemyName}:${row.zone.zone_name}`),
    ['Automatons:Devastator:Main']
  );
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

test('sortEnemyZoneRows places one-sided compare rows below main outcomes and above kill and limb groups', () => {
  const rows = [
    makeSortRow(0, 'limb', { outcomeKindA: 'limb', diffTtk: 0.2 }),
    makeSortRow(1, 'kill', { outcomeKindA: 'fatal', diffTtk: -0.2 }),
    makeSortRow(2, 'main-transfer', { outcomeKindA: 'main', diffTtk: 0 }),
    makeSortRow(3, 'b-only', {
      outcomeKindA: null,
      diffTtk: {
        kind: 'one-sided',
        sortValue: Number.NEGATIVE_INFINITY,
        winner: 'B',
        displayValue: 0.78
      }
    })
  ];

  const sorted = sortEnemyZoneRows(rows, {
    mode: 'compare',
    sortKey: 'ttkDiff',
    sortDir: 'asc',
    groupMode: 'outcome'
  });

  assert.deepEqual(
    sorted.map((row) => row.zone.zone_name),
    ['main-transfer', 'b-only', 'kill', 'limb']
  );
  assert.equal(sorted[1].groupStart, true);
  assert.equal(sorted[2].groupStart, true);
  assert.equal(sorted[3].groupStart, true);
});

test('sortEnemyZoneRows subgroups one-sided diff rows by winning outcome and real ttk', () => {
  const rows = [
    makeSortRow(0, 'main-transfer', { outcomeKindA: 'main', diffTtk: 0 }),
    makeSortRow(1, 'one-sided-main-fast', {
      outcomeKindB: 'main',
      ttkB: 0.6,
      diffTtk: {
        kind: 'one-sided',
        sortValue: Number.NEGATIVE_INFINITY,
        winner: 'B',
        displayValue: 0.6
      }
    }),
    makeSortRow(2, 'one-sided-main-slow', {
      outcomeKindA: 'main',
      ttkA: 1.4,
      diffTtk: {
        kind: 'one-sided',
        sortValue: Number.POSITIVE_INFINITY,
        winner: 'A',
        displayValue: 1.4
      }
    }),
    makeSortRow(3, 'one-sided-kill', {
      outcomeKindB: 'fatal',
      ttkB: 0.8,
      diffTtk: {
        kind: 'one-sided',
        sortValue: Number.NEGATIVE_INFINITY,
        winner: 'B',
        displayValue: 0.8
      }
    }),
    makeSortRow(4, 'one-sided-limb', {
      outcomeKindA: 'limb',
      ttkA: 0.25,
      diffTtk: {
        kind: 'one-sided',
        sortValue: Number.POSITIVE_INFINITY,
        winner: 'A',
        displayValue: 0.25
      }
    }),
    makeSortRow(5, 'one-sided-part', {
      outcomeKindB: 'utility',
      ttkB: 0.15,
      diffTtk: {
        kind: 'one-sided',
        sortValue: Number.NEGATIVE_INFINITY,
        winner: 'B',
        displayValue: 0.15
      }
    }),
    makeSortRow(6, 'kill', { outcomeKindA: 'fatal', diffTtk: -0.2 })
  ];

  const sorted = sortEnemyZoneRows(rows, {
    mode: 'compare',
    sortKey: 'ttkDiff',
    sortDir: 'asc',
    groupMode: 'outcome'
  });

  assert.deepEqual(
    sorted.map((row) => row.zone.zone_name),
    [
      'main-transfer',
      'one-sided-main-fast',
      'one-sided-main-slow',
      'one-sided-kill',
      'one-sided-limb',
      'one-sided-part',
      'kill'
    ]
  );
  assert.equal(sorted[1].groupStart, true);
  assert.equal(sorted[2].groupStart, false);
  assert.equal(sorted[3].groupStart, true);
  assert.equal(sorted[4].groupStart, true);
  assert.equal(sorted[5].groupStart, true);
  assert.equal(sorted[6].groupStart, true);
});

test('sortEnemyZoneRows does not pin Main in overview-style sorting when disabled', () => {
  const rows = [
    makeSortRow(0, 'arm', { enemyName: 'A', ttkA: 1 }),
    makeSortRow(1, 'Main', { enemyName: 'B', ttkA: 5 }),
    makeSortRow(2, 'head', { enemyName: 'C', ttkA: 3 })
  ];

  const sorted = sortEnemyZoneRows(rows, {
    mode: 'compare',
    sortKey: 'ttkA',
    sortDir: 'desc',
    groupMode: 'none',
    pinMain: false
  });

  assert.deepEqual(
    sorted.map((row) => row.zone.zone_name),
    ['Main', 'head', 'arm']
  );

  const alphabetic = sortEnemyZoneRows(rows, {
    mode: 'compare',
    sortKey: 'zone_name',
    sortDir: 'asc',
    groupMode: 'none',
    pinMain: false
  });

  assert.deepEqual(
    alphabetic.map((row) => row.zone.zone_name),
    ['arm', 'head', 'Main']
  );
});

test('sortEnemyZoneRows uses percent diff values in overview mode when requested', () => {
  const rows = [
    makeSortRow(0, 'modest-win', {
      diffTtk: makeDiffMetric({
        kind: 'numeric',
        winner: 'B',
        sortValue: -1,
        absoluteValue: -1,
        absoluteSortValue: -1,
        percentValue: -25,
        percentSortValue: -25,
        displayValue: null
      })
    }),
    makeSortRow(1, 'major-win', {
      diffTtk: makeDiffMetric({
        kind: 'numeric',
        winner: 'B',
        sortValue: -0.5,
        absoluteValue: -0.5,
        absoluteSortValue: -0.5,
        percentValue: -80,
        percentSortValue: -80,
        displayValue: null
      })
    })
  ];

  const sorted = sortEnemyZoneRows(rows, {
    mode: 'compare',
    sortKey: 'ttkDiff',
    sortDir: 'asc',
    groupMode: 'none',
    diffDisplayMode: 'percent',
    pinMain: false
  });

  assert.deepEqual(
    sorted.map((row) => row.zone.zone_name),
    ['major-win', 'modest-win']
  );
});

test('buildHallOfFameEntries prefers lethal rows before non-lethal rows', () => {
  const rows = [
    makeSortRow(0, 'arm', {
      enemyName: 'Arm Target',
      outcomeKindA: 'limb',
      outcomeKindB: 'limb',
      diffTtk: makeDiffMetric({
        kind: 'numeric',
        winner: 'B',
        sortValue: -0.5,
        absoluteValue: -0.5,
        absoluteSortValue: -0.5,
        percentValue: -90,
        percentSortValue: -90,
        displayValue: null
      })
    }),
    makeSortRow(1, 'head', {
      enemyName: 'Fatal Target',
      outcomeKindA: 'fatal',
      outcomeKindB: 'fatal',
      diffTtk: makeDiffMetric({
        kind: 'numeric',
        winner: 'B',
        sortValue: -0.25,
        absoluteValue: -0.25,
        absoluteSortValue: -0.25,
        percentValue: -50,
        percentSortValue: -50,
        displayValue: null
      })
    })
  ];
  rows[1].zone.IsFatal = true;

  const hallOfFame = buildHallOfFameEntries(rows, {
    diffDisplayMode: 'percent',
    limit: 2
  });

  assert.equal(hallOfFame.B.length, 2);
  assert.equal(hallOfFame.B[0].row.enemyName, 'Fatal Target');
  assert.equal(hallOfFame.B[1].row.enemyName, 'Arm Target');
});

test('buildHallOfFameEntries filters duplicate same-outcome entries from one enemy before filling repeats', () => {
  const rows = [
    makeSortRow(0, 'Left Hip', {
      enemyName: 'Gatekeeper',
      outcomeKindB: 'limb',
      diffTtk: makeDiffMetric({
        kind: 'numeric',
        winner: 'B',
        sortValue: -1.2,
        absoluteValue: -1.2,
        absoluteSortValue: -1.2,
        percentValue: -80,
        percentSortValue: -80,
        displayValue: null
      })
    }),
    makeSortRow(1, 'Right Leg', {
      enemyName: 'Gatekeeper',
      outcomeKindB: 'limb',
      diffTtk: makeDiffMetric({
        kind: 'numeric',
        winner: 'B',
        sortValue: -0.9,
        absoluteValue: -0.9,
        absoluteSortValue: -0.9,
        percentValue: -60,
        percentSortValue: -60,
        displayValue: null
      })
    }),
    makeSortRow(2, 'Main', {
      enemyName: 'Gatekeeper',
      outcomeKindB: 'main',
      diffTtk: makeDiffMetric({
        kind: 'numeric',
        winner: 'B',
        sortValue: -0.4,
        absoluteValue: -0.4,
        absoluteSortValue: -0.4,
        percentValue: -40,
        percentSortValue: -40,
        displayValue: null
      })
    }),
    makeSortRow(3, 'Arm', {
      enemyName: 'Raider',
      outcomeKindB: 'limb',
      diffTtk: makeDiffMetric({
        kind: 'numeric',
        winner: 'B',
        sortValue: -0.3,
        absoluteValue: -0.3,
        absoluteSortValue: -0.3,
        percentValue: -30,
        percentSortValue: -30,
        displayValue: null
      })
    })
  ];

  const hallOfFame = buildHallOfFameEntries(rows, {
    diffDisplayMode: 'absolute',
    limit: 3
  });

  assert.deepEqual(
    hallOfFame.B.map((entry) => `${entry.row.enemyName}:${entry.outcomeKind}:${entry.row.zone.zone_name}`),
    [
      'Gatekeeper:main:Main',
      'Gatekeeper:limb:Left Hip',
      'Raider:limb:Arm'
    ]
  );
});
