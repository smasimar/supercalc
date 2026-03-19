import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildKillSummary,
  calculateShotsToKill,
  calculateTtkSeconds,
  formatTtkSeconds
} from '../calculator/summary.js';
import {
  getZoneOutcomeKind,
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

test('getZoneOutcomeKind marks non-fatal zones with main transfer as main-relevant', () => {
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
    'main'
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
