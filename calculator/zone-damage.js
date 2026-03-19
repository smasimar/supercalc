import { buildKillSummary } from './summary.js';

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toPositiveInteger(value, fallback = 1) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback;
}

export function calculateAttackAgainstZone(attack, zone, hits = 1) {
  const ap = toNumber(attack?.AP);
  const av = toNumber(zone?.AV);

  let damageMultiplier = 0;
  if (ap < av) {
    damageMultiplier = 0;
  } else if (ap === av) {
    damageMultiplier = 0.65;
  } else {
    damageMultiplier = 1.0;
  }

  const attackType = String(attack?.['Atk Type'] || '');
  const isExplosion = attackType.toLowerCase().includes('explosion');

  let explosionModifier = 1.0;
  if (isExplosion) {
    if (zone?.ExMult === '-' || zone?.ExMult === null || zone?.ExMult === undefined) {
      explosionModifier = 0;
    } else {
      explosionModifier = toNumber(zone.ExMult, 1.0);
    }
  }

  const dmg = toNumber(attack?.DMG);
  const dur = toNumber(attack?.DUR);
  const durPercent = toNumber(zone?.['Dur%']);
  const rawBaseDamage = (dmg * (1 - durPercent)) + (dur * durPercent);
  const damagePerAttack = rawBaseDamage * damageMultiplier * explosionModifier;

  // Current calculator logic applies ToMain% transfer for both projectile and explosion damage.
  const toMainPercent = toNumber(zone?.['ToMain%']);
  const damageToMain = damagePerAttack * toMainPercent;

  return {
    name: attack?.['Atk Name'] || attack?.Name || 'Unknown',
    damage: damagePerAttack,
    damageToMain,
    dmg,
    dur,
    durPercent,
    ap,
    av,
    damageMultiplier,
    explosionModifier,
    isExplosion,
    rawBaseDamage,
    toMainPercent,
    exTarget: zone?.ExTarget || '',
    hits: toPositiveInteger(hits)
  };
}

export function buildZoneAttackDetails(zone, selectedAttacks = [], hitCounts = []) {
  if (!zone || !Array.isArray(selectedAttacks) || selectedAttacks.length === 0) {
    return [];
  }

  return selectedAttacks.map((attack, index) =>
    calculateAttackAgainstZone(attack, zone, hitCounts[index])
  );
}

export function summarizeZoneDamage({
  zone,
  enemyMainHealth,
  selectedAttacks = [],
  hitCounts = [],
  rpm
}) {
  if (!zone) {
    return null;
  }

  const attackDetails = buildZoneAttackDetails(zone, selectedAttacks, hitCounts);
  let totalDamagePerCycle = 0;
  let totalDamageToMainPerCycle = 0;

  attackDetails.forEach((attack) => {
    totalDamagePerCycle += attack.damage * attack.hits;
    totalDamageToMainPerCycle += attack.damageToMain * attack.hits;
  });

  const zoneHealth = toNumber(zone.health, -1);
  const zoneCon = toNumber(zone.Con);
  const normalizedEnemyMainHealth = toNumber(enemyMainHealth);

  return {
    attackDetails,
    totalDamagePerCycle,
    totalDamageToMainPerCycle,
    zoneHealth,
    zoneCon,
    enemyMainHealth: normalizedEnemyMainHealth,
    hasSelectedAttacks: selectedAttacks.length > 0,
    killSummary: buildKillSummary({
      zoneHealth,
      zoneCon,
      enemyMainHealth: normalizedEnemyMainHealth,
      totalDamagePerCycle,
      totalDamageToMainPerCycle,
      rpm
    })
  };
}

export function getZoneOutcomeKind({ zone, totalDamagePerCycle, totalDamageToMainPerCycle, killSummary }) {
  if (zone?.IsFatal) {
    return 'fatal';
  }

  if (!(totalDamagePerCycle > 0)) {
    return null;
  }

  if (totalDamageToMainPerCycle > 0 && killSummary?.mainShotsToKill !== null) {
    return 'main';
  }

  return 'utility';
}

export function getZoneOutcomeLabel(kind) {
  if (kind === 'fatal') {
    return 'Fatal';
  }

  if (kind === 'main') {
    return 'Main';
  }

  if (kind === 'utility') {
    return 'Non-lethal';
  }

  return null;
}
