import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildKillSummary,
  calculateShotsToKill,
  calculateTtkSeconds,
  formatTtkSeconds
} from '../calculator/summary.js';

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
