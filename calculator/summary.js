function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toPositiveNumber(value) {
  const numeric = toFiniteNumber(value);
  return numeric !== null && numeric > 0 ? numeric : null;
}

export function calculateShotsToKill(totalHealth, damagePerCycle) {
  const health = toFiniteNumber(totalHealth);
  const damage = toPositiveNumber(damagePerCycle);

  if (health === null || health < 0 || damage === null) {
    return null;
  }

  return Math.ceil(health / damage);
}

export function calculateTtkSeconds(shotsToKill, rpm) {
  const shots = toFiniteNumber(shotsToKill);
  const fireRate = toPositiveNumber(rpm);

  if (shots === null || shots < 0 || fireRate === null) {
    return null;
  }

  return Math.max(0, shots - 1) * 60 / fireRate;
}

export function formatTtkSeconds(ttkSeconds) {
  const seconds = toFiniteNumber(ttkSeconds);
  if (seconds === null || seconds < 0) {
    return null;
  }
  return `${seconds.toFixed(2)}s`;
}

export function buildKillSummary({
  zoneHealth,
  zoneCon,
  enemyMainHealth,
  totalDamagePerCycle,
  totalDamageToMainPerCycle,
  rpm
}) {
  const normalizedZoneHealth = toFiniteNumber(zoneHealth);
  const normalizedZoneCon = toFiniteNumber(zoneCon) ?? 0;
  const normalizedEnemyMainHealth = toFiniteNumber(enemyMainHealth);
  const normalizedRpm = toPositiveNumber(rpm);

  const zoneShotsToKill = calculateShotsToKill(normalizedZoneHealth, totalDamagePerCycle);
  const zoneShotsToKillWithCon = normalizedZoneCon > 0
    ? calculateShotsToKill((normalizedZoneHealth ?? 0) + normalizedZoneCon, totalDamagePerCycle)
    : null;
  const mainShotsToKill = calculateShotsToKill(normalizedEnemyMainHealth, totalDamageToMainPerCycle);

  return {
    hasRpm: normalizedRpm !== null,
    rpm: normalizedRpm,
    zoneShotsToKill,
    zoneTtkSeconds: calculateTtkSeconds(zoneShotsToKill, normalizedRpm),
    zoneShotsToKillWithCon,
    zoneTtkSecondsWithCon: calculateTtkSeconds(zoneShotsToKillWithCon, normalizedRpm),
    mainShotsToKill,
    mainTtkSeconds: calculateTtkSeconds(mainShotsToKill, normalizedRpm),
  };
}
