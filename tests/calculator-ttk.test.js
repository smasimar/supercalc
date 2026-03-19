import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildKillSummary,
  calculateShotsToKill,
  calculateTtkSeconds,
  formatTtkSeconds
} from '../calculator/summary.js';
import {
  getZoneDisplayedTtkSeconds,
  getZoneOutcomeLabel,
  getZoneOutcomeKind,
  getZoneOutcomeShortLabel,
  summarizeZoneDamage
} from '../calculator/zone-damage.js';

test('calculateShotsToKill rounds up to the next full firing cycle', () => {
  assert.equal(calculateShotsToKill(300, 100), 3);
  assert.equal(calculateShotsToKill(301, 100), 4);
});

test('calculateTtkSeconds treats the first firing cycle as immediate', () => {
  assert.equal(calculateTtkSeconds(3, 60), 2);
  assert.equal(formatTtkSeconds(calculateTtkSeconds(3, 60)), '2.00s');
});

test('buildKillSummary keeps Liberator Carbine sample under one second', () => {
  const summary = buildKillSummary({
    zoneHealth: 15,
    zoneCon: 0,
    enemyMainHealth: 0,
    totalDamagePerCycle: 1,
    totalDamageToMainPerCycle: 0,
    rpm: 920
  });

  assert.equal(summary.zoneShotsToKill, 15);
  assert(summary.zoneTtkSeconds !== null);
  assert(summary.zoneTtkSeconds < 1);
  assert.equal(formatTtkSeconds(summary.zoneTtkSeconds), '0.91s');
});

test('calculateTtkSeconds returns zero for a one-cycle kill', () => {
  assert.equal(calculateTtkSeconds(1, 760), 0);
  assert.equal(formatTtkSeconds(calculateTtkSeconds(1, 760)), '0.00s');
});

test('calculateTtkSeconds returns null when shots-to-kill is unavailable', () => {
  assert.equal(calculateTtkSeconds(null, 760), null);
});

test('buildKillSummary omits TTK when RPM is missing', () => {
  const summary = buildKillSummary({
    zoneHealth: 300,
    zoneCon: 0,
    enemyMainHealth: 0,
    totalDamagePerCycle: 100,
    totalDamageToMainPerCycle: 0,
    rpm: null
  });

  assert.equal(summary.hasRpm, false);
  assert.equal(summary.zoneShotsToKill, 3);
  assert.equal(summary.zoneTtkSeconds, null);
});

test('summarizeZoneDamage computes row-level part shots and ttk from selected attacks', () => {
  const summary = summarizeZoneDamage({
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
    selectedAttacks: [{
      'Atk Name': 'Burst',
      'Atk Type': 'Projectile',
      DMG: 100,
      DUR: 0,
      AP: 2
    }],
    rpm: 60
  });

  assert.equal(summary.totalDamagePerCycle, 100);
  assert.equal(summary.killSummary.zoneShotsToKill, 3);
  assert.equal(summary.killSummary.zoneTtkSeconds, 2);
});

test('summarizeZoneDamage keeps shots but omits ttk without rpm', () => {
  const summary = summarizeZoneDamage({
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
    selectedAttacks: [{
      'Atk Name': 'Burst',
      'Atk Type': 'Projectile',
      DMG: 100,
      DUR: 0,
      AP: 2
    }],
    rpm: null
  });

  assert.equal(summary.killSummary.zoneShotsToKill, 3);
  assert.equal(summary.killSummary.zoneTtkSeconds, null);
});

test('getZoneOutcomeKind marks parts that break before a main kill as limb-relevant', () => {
  const summary = summarizeZoneDamage({
    zone: {
      health: 300,
      Con: 0,
      AV: 1,
      'Dur%': 0,
      'ToMain%': 0.5,
      ExTarget: 'Part',
      ExMult: 1,
      IsFatal: false
    },
    enemyMainHealth: 200,
    selectedAttacks: [{
      'Atk Name': 'Burst',
      'Atk Type': 'Projectile',
      DMG: 100,
      DUR: 0,
      AP: 2
    }],
    rpm: 920
  });

  assert.equal(
    getZoneOutcomeKind({
      zone: { IsFatal: false },
      totalDamagePerCycle: summary.totalDamagePerCycle,
      totalDamageToMainPerCycle: summary.totalDamageToMainPerCycle,
      killSummary: summary.killSummary
    }),
    'limb'
  );
});

test('getZoneDisplayedTtkSeconds hides limb-only paths even when the part breaks quickly', () => {
  const summary = summarizeZoneDamage({
    zone: {
      health: 100,
      Con: 0,
      AV: 1,
      'Dur%': 0,
      'ToMain%': 0.5,
      ExTarget: 'Part',
      ExMult: 1,
      IsFatal: false
    },
    enemyMainHealth: 200,
    selectedAttacks: [{
      'Atk Name': 'Burst',
      'Atk Type': 'Projectile',
      DMG: 100,
      DUR: 0,
      AP: 2
    }],
    rpm: 60
  });

  assert.equal(summary.killSummary.zoneTtkSeconds, 0);
  assert.equal(
    getZoneDisplayedTtkSeconds(
      getZoneOutcomeKind({
        zone: { IsFatal: false },
        totalDamagePerCycle: summary.totalDamagePerCycle,
        totalDamageToMainPerCycle: summary.totalDamageToMainPerCycle,
        killSummary: summary.killSummary
      }),
      summary.killSummary
    ),
    null
  );
});

test('getZoneOutcomeKind keeps main label when the part can kill main before it breaks', () => {
  const summary = summarizeZoneDamage({
    zone: {
      health: 300,
      Con: 0,
      AV: 1,
      'Dur%': 0,
      'ToMain%': 1,
      ExTarget: 'Part',
      ExMult: 1,
      IsFatal: false
    },
    enemyMainHealth: 200,
    selectedAttacks: [{
      'Atk Name': 'Burst',
      'Atk Type': 'Projectile',
      DMG: 100,
      DUR: 0,
      AP: 2
    }],
    rpm: 920
  });

  assert.equal(
    getZoneOutcomeKind({
      zone: { IsFatal: false },
      totalDamagePerCycle: summary.totalDamagePerCycle,
      totalDamageToMainPerCycle: summary.totalDamageToMainPerCycle,
      killSummary: summary.killSummary
    }),
    'main'
  );
  assert.equal(
    getZoneDisplayedTtkSeconds('main', summary.killSummary),
    summary.killSummary.mainTtkSeconds
  );
});

test('getZoneOutcomeKind marks damageable non-fatal zones without main transfer as non-lethal', () => {
  const summary = summarizeZoneDamage({
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
    enemyMainHealth: 200,
    selectedAttacks: [{
      'Atk Name': 'Burst',
      'Atk Type': 'Projectile',
      DMG: 100,
      DUR: 0,
      AP: 2
    }],
    rpm: 920
  });

  assert.equal(
    getZoneOutcomeKind({
      zone: { IsFatal: false },
      totalDamagePerCycle: summary.totalDamagePerCycle,
      totalDamageToMainPerCycle: summary.totalDamageToMainPerCycle,
      killSummary: summary.killSummary
    }),
    'utility'
  );
});

test('summarizeZoneDamage returns no part shots when selected attacks cannot penetrate the zone', () => {
  const summary = summarizeZoneDamage({
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
    enemyMainHealth: 200,
    selectedAttacks: [{
      'Atk Name': 'Burst',
      'Atk Type': 'Projectile',
      DMG: 100,
      DUR: 0,
      AP: 1
    }],
    rpm: 920
  });

  assert.equal(summary.totalDamagePerCycle, 0);
  assert.equal(summary.killSummary.zoneShotsToKill, null);
  assert.equal(summary.killSummary.zoneTtkSeconds, null);
  assert.equal(
    getZoneOutcomeKind({
      zone: { IsFatal: false },
      totalDamagePerCycle: summary.totalDamagePerCycle,
      totalDamageToMainPerCycle: summary.totalDamageToMainPerCycle,
      killSummary: summary.killSummary
    }),
    null
  );
});

test('fatal zones with zero damage still behave as impossible, not instant kills', () => {
  const summary = summarizeZoneDamage({
    zone: {
      health: 425,
      Con: 0,
      AV: 3,
      'Dur%': 0.3,
      'ToMain%': 1,
      ExTarget: 'Main',
      ExMult: 1,
      IsFatal: true
    },
    enemyMainHealth: 750,
    selectedAttacks: [{
      'Atk Name': '5.5x50mm FULL METAL JACKET_P',
      'Atk Type': 'projectile',
      DMG: 90,
      DUR: 22,
      AP: 2
    }],
    rpm: 920
  });

  const outcomeKind = getZoneOutcomeKind({
    zone: { IsFatal: true },
    totalDamagePerCycle: summary.totalDamagePerCycle,
    totalDamageToMainPerCycle: summary.totalDamageToMainPerCycle,
    killSummary: summary.killSummary
  });

  assert.equal(summary.totalDamagePerCycle, 0);
  assert.equal(summary.killSummary.zoneShotsToKill, null);
  assert.equal(summary.killSummary.zoneTtkSeconds, null);
  assert.equal(outcomeKind, null);
  assert.equal(getZoneDisplayedTtkSeconds(outcomeKind, summary.killSummary), null);
});

test('zone outcome labels expose short and expanded badge text', () => {
  assert.equal(getZoneOutcomeLabel('fatal'), 'Fatal');
  assert.equal(getZoneOutcomeLabel('main'), 'Main');
  assert.equal(getZoneOutcomeLabel('limb'), 'Limb');
  assert.equal(getZoneOutcomeLabel('utility'), 'Non-lethal');

  assert.equal(getZoneOutcomeShortLabel('fatal'), 'F');
  assert.equal(getZoneOutcomeShortLabel('main'), 'M');
  assert.equal(getZoneOutcomeShortLabel('limb'), 'L');
  assert.equal(getZoneOutcomeShortLabel('utility'), 'N');

  assert.equal(getZoneDisplayedTtkSeconds('fatal', { zoneTtkSeconds: 0, mainTtkSeconds: 2 }), 0);
  assert.equal(getZoneDisplayedTtkSeconds('main', { zoneTtkSeconds: 2, mainTtkSeconds: 1 }), 1);
  assert.equal(getZoneDisplayedTtkSeconds('limb', { zoneTtkSeconds: 0, mainTtkSeconds: 1 }), null);
  assert.equal(getZoneDisplayedTtkSeconds('utility', { zoneTtkSeconds: 0, mainTtkSeconds: null }), null);
});
