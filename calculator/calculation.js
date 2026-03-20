// calculator/calculation.js — damage calculation logic
import {
  adjustAttackHitCount,
  calculatorState,
  getAttackHitCounts,
  getEnemyOptions,
  getSelectedAttacks,
  getSelectedZone,
  getWeaponForSlot
} from './data.js';
import { buildHallOfFameEntries, buildOverviewRows, getAttackRowKey } from './compare-utils.js';
import { formatTtkSeconds } from './summary.js';
import { summarizeZoneDamage } from './zone-damage.js';
import { renderEnemyDetails } from './rendering.js';

function appendTtkLine(resultWrapper, ttkSeconds, hasRpm) {
  const ttkLine = document.createElement('div');
  ttkLine.className = 'calc-ttk-line';

  if (ttkSeconds === null) {
    ttkLine.textContent = hasRpm ? 'TTK unavailable' : 'TTK unavailable (no RPM)';
    ttkLine.classList.add('muted');
  } else {
    ttkLine.textContent = `TTK: ${formatTtkSeconds(ttkSeconds)}`;
  }

  resultWrapper.appendChild(ttkLine);
}

function getEmptyCalculationMessage(slot) {
  const weapon = getWeaponForSlot(slot);
  const enemy = calculatorState.selectedEnemy;
  const zone = getSelectedZone();
  const selectedAttacks = getSelectedAttacks(slot);

  if (!weapon) {
    return calculatorState.mode === 'compare'
      ? `Select weapon ${slot}`
      : 'Select a weapon to see calculations';
  }

  if (!enemy) {
    return 'Select an enemy to see calculations';
  }

  if (!zone) {
    return 'Select an enemy zone to see calculations';
  }

  if (selectedAttacks.length === 0) {
    return calculatorState.mode === 'compare'
      ? `Select one or more attack rows for weapon ${slot}`
      : 'Select weapon attack(s) to see calculations';
  }

  return 'Select weapon attack(s) and an enemy zone to see calculations';
}

export function calculateDamage(slot = 'A') {
  const weapon = getWeaponForSlot(slot);
  const enemy = calculatorState.selectedEnemy;
  const zone = getSelectedZone();

  if (!weapon || !enemy || !enemy.zones || !zone) {
    return null;
  }

  const selectedAttacks = getSelectedAttacks(slot);
  if (selectedAttacks.length === 0) {
    return null;
  }

  return {
    slot,
    weapon,
    enemy,
    zone,
    selectedAttacks,
    attackKeys: selectedAttacks.map((attack) => getAttackRowKey(attack)),
    ...summarizeZoneDamage({
      zone,
      enemyMainHealth: parseInt(enemy.health, 10) || 0,
      selectedAttacks,
      hitCounts: getAttackHitCounts(slot, selectedAttacks),
      rpm: weapon?.rpm
    })
  };
}

function appendAttackCard(container, slot, attack, attackKey, index) {
  const attackCard = document.createElement('div');
  attackCard.className = 'calc-attack-card';
  attackCard.dataset.attackIndex = index;

  const leftContent = document.createElement('div');
  leftContent.className = 'calc-attack-content';

  const attackName = document.createElement('div');
  attackName.className = 'calc-attack-name';
  attackName.textContent = attack.name;
  leftContent.appendChild(attackName);

  const apMultiText = attack.ap < attack.av ? '0 (AP < AV)' :
    attack.ap === attack.av ? '0.65 (AP = AV)' :
      '1.0 (AP > AV)';

  const damageResult = document.createElement('div');
  damageResult.className = 'calc-damage-line';

  const damageValue = document.createElement('span');
  damageValue.className = attack.damage > 0 ? 'calc-damage-value' : 'calc-damage-value muted';
  damageValue.textContent = `Zone damage: ${attack.damage.toFixed(2)}`;
  damageResult.appendChild(damageValue);

  const damageCalc = document.createElement('span');
  damageCalc.className = 'calc-formula';

  const dmgMultiplied = attack.dmg * (1 - attack.durPercent);
  const durMultiplied = attack.dur * attack.durPercent;
  const apMultiplier = attack.ap < attack.av ? 0 : attack.ap === attack.av ? 0.65 : 1.0;
  const exMultValue = attack.isExplosion ? (attack.explosionModifier === 0 ? 0 : attack.explosionModifier) : 1.0;
  const exMultTextExpanded = attack.isExplosion
    ? (attack.explosionModifier === 0 ? '0 (immune)' : `${attack.explosionModifier} (ExMult)`)
    : '1.0';

  damageCalc.textContent = `= (${dmgMultiplied.toFixed(2)} + ${durMultiplied.toFixed(2)}) × ${apMultiplier} × ${exMultValue} = ((${attack.dmg} × (1 - ${attack.durPercent})) + (${attack.dur} × ${attack.durPercent})) × ${apMultiText} × ${exMultTextExpanded}`;
  damageResult.appendChild(damageCalc);
  leftContent.appendChild(damageResult);

  const mainDamageResult = document.createElement('div');
  mainDamageResult.className = 'calc-main-damage-line';

  const mainDamageValue = document.createElement('span');
  mainDamageValue.className = attack.damageToMain > 0 ? 'calc-main-damage-value' : 'calc-main-damage-value muted';
  mainDamageValue.textContent = `Main health damage: ${(attack.damageToMain || 0).toFixed(2)}`;
  mainDamageResult.appendChild(mainDamageValue);

  if (attack.damageToMain > 0) {
    const mainDamageCalc = document.createElement('span');
    mainDamageCalc.className = 'calc-formula';

    let mainCalcText = '';
    if (attack.isExplosion && attack.exTarget === 'Main') {
      mainCalcText = `= ${attack.damage.toFixed(2)} × ${attack.toMainPercent.toFixed(2)}`;
    } else if (!attack.isExplosion) {
      mainCalcText = `= ${attack.damage.toFixed(2)} × ${attack.toMainPercent.toFixed(2)}`;
    }

    mainDamageCalc.textContent = mainCalcText;
    mainDamageResult.appendChild(mainDamageCalc);
  }

  leftContent.appendChild(mainDamageResult);
  attackCard.appendChild(leftContent);

  const inputContainer = document.createElement('div');
  inputContainer.className = 'calc-hits-control';

  const hitsLabel = document.createElement('div');
  hitsLabel.className = 'calc-hits-label';
  hitsLabel.textContent = 'Hits';
  inputContainer.appendChild(hitsLabel);

  const hitsContainer = document.createElement('div');
  hitsContainer.className = 'calc-hits-container';

  const hitsDisplay = document.createElement('div');
  hitsDisplay.className = 'calc-hits-display';
  hitsDisplay.textContent = attack.hits;

  const rerenderCalculationViews = () => {
    renderEnemyDetails();
    renderCalculation();
  };

  const downButton = document.createElement('button');
  downButton.className = 'calc-hits-btn';
  downButton.textContent = '◀';
  downButton.addEventListener('click', () => {
    adjustAttackHitCount(slot, attackKey, -1);
    rerenderCalculationViews();
  });
  hitsContainer.appendChild(downButton);

  hitsContainer.appendChild(hitsDisplay);

  const upButton = document.createElement('button');
  upButton.className = 'calc-hits-btn';
  upButton.textContent = '▶';
  upButton.addEventListener('click', () => {
    adjustAttackHitCount(slot, attackKey, 1);
    rerenderCalculationViews();
  });
  hitsContainer.appendChild(upButton);

  inputContainer.appendChild(hitsContainer);
  attackCard.appendChild(inputContainer);

  if (attack.hits !== 1) {
    const totalDamageForAttack = document.createElement('div');
    totalDamageForAttack.className = 'calc-main-damage-line';
    totalDamageForAttack.textContent = `Total: ${(attack.damage * attack.hits).toFixed(2)} damage`;
    totalDamageForAttack.classList.add('calc-damage-value', 'muted');
    leftContent.appendChild(totalDamageForAttack);
  }

  container.appendChild(attackCard);
}

function appendTotalCard(container, results) {
  const {
    totalDamagePerCycle,
    totalDamageToMainPerCycle,
    zoneHealth,
    zoneCon,
    enemyMainHealth,
    killSummary
  } = results;

  const totalCard = document.createElement('div');
  totalCard.className = 'calc-total-card';

  const totalDamage = document.createElement('div');
  totalDamage.className = 'calc-total-damage';
  totalDamage.textContent = 'Total Combined Damage per Cycle';
  totalCard.appendChild(totalDamage);

  const combinedDamage = document.createElement('div');
  combinedDamage.className = 'calc-combined-display';

  const zoneDamageContainer = document.createElement('div');
  zoneDamageContainer.className = 'calc-damage-section';

  const zoneLabel = document.createElement('div');
  zoneLabel.className = 'calc-section-label';
  zoneLabel.textContent = 'Zone:';
  zoneDamageContainer.appendChild(zoneLabel);

  const zoneDamageDisplay = document.createElement('div');
  zoneDamageDisplay.className = 'calc-damage-fraction-wrapper';

  if (totalDamagePerCycle > 0 && killSummary.zoneShotsToKill !== null) {
    const fraction = document.createElement('div');
    fraction.className = 'calc-fraction';

    const numerator = document.createElement('div');
    numerator.className = 'calc-fraction-numerator';
    numerator.textContent = `${zoneHealth}`;

    const denominator = document.createElement('div');
    denominator.className = 'calc-fraction-denominator';
    denominator.textContent = `${totalDamagePerCycle.toFixed(2)}`;

    fraction.appendChild(numerator);
    fraction.appendChild(denominator);

    const result = document.createElement('div');
    result.className = 'calc-result-wrapper';

    const resultLine = document.createElement('div');
    resultLine.className = 'calc-result-line';
    resultLine.textContent = `= ${(zoneHealth / totalDamagePerCycle).toFixed(2)} (${killSummary.zoneShotsToKill}) shots`;

    const shotsText = document.createElement('div');
    shotsText.className = 'calc-result-text';
    shotsText.textContent = 'shots to destroy';

    result.appendChild(resultLine);
    result.appendChild(shotsText);
    appendTtkLine(result, killSummary.zoneTtkSeconds, killSummary.hasRpm);

    zoneDamageDisplay.appendChild(fraction);
    zoneDamageDisplay.appendChild(result);

    if (zoneCon > 0 && killSummary.zoneShotsToKillWithCon !== null) {
      const conFraction = document.createElement('div');
      conFraction.className = 'calc-fraction';

      const conNumerator = document.createElement('div');
      conNumerator.className = 'calc-fraction-numerator';
      conNumerator.textContent = `${zoneHealth + zoneCon}`;

      const conDenominator = document.createElement('div');
      conDenominator.className = 'calc-fraction-denominator';
      conDenominator.textContent = `${totalDamagePerCycle.toFixed(2)}`;

      conFraction.appendChild(conNumerator);
      conFraction.appendChild(conDenominator);

      const conResult = document.createElement('div');
      conResult.className = 'calc-result-wrapper';

      const conResultLine = document.createElement('div');
      conResultLine.className = 'calc-result-line';
      conResultLine.textContent = `= ${((zoneHealth + zoneCon) / totalDamagePerCycle).toFixed(2)} (${killSummary.zoneShotsToKillWithCon}) shots`;

      const conShotsText = document.createElement('div');
      conShotsText.className = 'calc-result-text';
      conShotsText.textContent = 'shots to deplete constitution';

      conResult.appendChild(conResultLine);
      conResult.appendChild(conShotsText);
      appendTtkLine(conResult, killSummary.zoneTtkSecondsWithCon, killSummary.hasRpm);

      zoneDamageDisplay.appendChild(conFraction);
      zoneDamageDisplay.appendChild(conResult);
    }

    zoneDamageDisplay.classList.add('calc-damage-value');
  } else {
    zoneDamageDisplay.textContent = `${totalDamagePerCycle.toFixed(2)}`;
    zoneDamageDisplay.classList.add('calc-damage-value', 'muted');
  }
  zoneDamageContainer.appendChild(zoneDamageDisplay);
  combinedDamage.appendChild(zoneDamageContainer);

  const mainDamageContainer = document.createElement('div');
  mainDamageContainer.className = 'calc-damage-section';

  const mainLabel = document.createElement('div');
  mainLabel.className = 'calc-section-label';
  mainLabel.textContent = 'Main:';
  mainDamageContainer.appendChild(mainLabel);

  const mainDamageDisplay = document.createElement('div');
  mainDamageDisplay.className = 'calc-damage-fraction-wrapper';

  if (totalDamageToMainPerCycle > 0 && enemyMainHealth > 0 && killSummary.mainShotsToKill !== null) {
    const fraction = document.createElement('div');
    fraction.className = 'calc-fraction';

    const numerator = document.createElement('div');
    numerator.className = 'calc-fraction-numerator';
    numerator.textContent = `${enemyMainHealth}`;

    const denominator = document.createElement('div');
    denominator.className = 'calc-fraction-denominator';
    denominator.textContent = `${totalDamageToMainPerCycle.toFixed(2)}`;

    fraction.appendChild(numerator);
    fraction.appendChild(denominator);

    const result = document.createElement('div');
    result.className = 'calc-result-wrapper';

    const resultLine = document.createElement('div');
    resultLine.className = 'calc-result-line';
    resultLine.textContent = `= ${(enemyMainHealth / totalDamageToMainPerCycle).toFixed(2)} (${killSummary.mainShotsToKill}) shots`;

    const shotsText = document.createElement('div');
    shotsText.className = 'calc-result-text';
    shotsText.textContent = 'shots to destroy';

    result.appendChild(resultLine);
    result.appendChild(shotsText);
    appendTtkLine(result, killSummary.mainTtkSeconds, killSummary.hasRpm);

    mainDamageDisplay.appendChild(fraction);
    mainDamageDisplay.appendChild(result);
    mainDamageDisplay.classList.add('calc-main-damage-value');
  } else {
    mainDamageDisplay.textContent = `${totalDamageToMainPerCycle.toFixed(2)}`;
    mainDamageDisplay.classList.add('calc-main-damage-value', 'muted');
  }
  mainDamageContainer.appendChild(mainDamageDisplay);

  combinedDamage.appendChild(mainDamageContainer);
  totalCard.appendChild(combinedDamage);

  container.appendChild(totalCard);
}

function renderCalculationContent(container, slot, results) {
  results.attackDetails.forEach((attack, index) => {
    appendAttackCard(container, slot, attack, results.attackKeys[index], index);
  });

  appendTotalCard(container, results);
}

function appendEmptyCalculationState(container, slot) {
  const emptyState = document.createElement('div');
  emptyState.textContent = getEmptyCalculationMessage(slot);
  emptyState.style.color = 'var(--muted)';
  emptyState.style.padding = '16px';
  container.appendChild(emptyState);
}

function renderComparePanel(container, slot, results) {
  const panel = document.createElement('section');
  panel.className = 'calc-compare-panel';

  const heading = document.createElement('div');
  heading.className = 'calc-compare-heading';

  const badge = document.createElement('span');
  badge.className = `calc-compare-slot-badge calc-compare-slot-badge-${slot.toLowerCase()}`;
  badge.textContent = slot;
  heading.appendChild(badge);

  const title = document.createElement('div');
  title.className = 'calc-compare-title';
  title.textContent = results?.weapon?.name || `Weapon ${slot}`;
  heading.appendChild(title);

  panel.appendChild(heading);

  const body = document.createElement('div');
  body.className = 'calc-compare-body';
  panel.appendChild(body);

  if (!results) {
    appendEmptyCalculationState(body, slot);
  } else {
    renderCalculationContent(body, slot, results);
  }

  container.appendChild(panel);
}

function capitalizeWord(value) {
  if (!value) {
    return '';
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatHallOfFameValue(value, type) {
  if (value === null || value === undefined) {
    return '-';
  }

  return type === 'ttk'
    ? formatTtkSeconds(value)
    : String(value);
}

function getHallOfFameOutcomeLabel(entry) {
  const winnerMetrics = entry.row?.metrics?.bySlot?.[entry.metric.winner];
  const outcomeKind = winnerMetrics?.outcomeKind;
  if (!outcomeKind) {
    return entry.row?.zone?.zone_name === 'Main' ? 'Main' : 'Unavailable';
  }

  return capitalizeWord(outcomeKind === 'fatal' ? 'Kill' : outcomeKind);
}

function buildHallOfFameDiffText(entry) {
  const { metric } = entry;
  if (metric.displayMetric.kind === 'one-sided') {
    return `${metric.winner} Only`;
  }

  const magnitude = Math.abs(metric.displayMetric.value);
  if (metric.displayMode === 'percent') {
    return `${metric.winner} by ${magnitude.toFixed(1).replace(/\.0$/, '')}%`;
  }

  if (metric.metricKey === 'ttk') {
    return `${metric.winner} faster by ${formatTtkSeconds(magnitude)}`;
  }

  return `${metric.winner} by ${magnitude} shot${magnitude === 1 ? '' : 's'}`;
}

function appendHallOfFameEntry(list, entry) {
  const item = document.createElement('div');
  item.className = 'calc-hof-entry';

  const header = document.createElement('div');
  header.className = 'calc-hof-entry-header';
  header.textContent = `${entry.row.enemyName} — ${entry.row.zone?.zone_name || 'Zone'}`;
  item.appendChild(header);

  const meta = document.createElement('div');
  meta.className = 'calc-hof-entry-meta';
  meta.textContent = `${entry.row.faction} • ${getHallOfFameOutcomeLabel(entry)}`;
  item.appendChild(meta);

  const values = document.createElement('div');
  values.className = 'calc-hof-entry-values';

  const aMetrics = entry.row.metrics?.bySlot?.A;
  const bMetrics = entry.row.metrics?.bySlot?.B;
  const type = entry.metric.metricKey;
  const label = type === 'ttk' ? 'TTK' : 'Shots';
  values.textContent = `A ${label}: ${formatHallOfFameValue(type === 'ttk' ? aMetrics?.ttkSeconds : aMetrics?.shotsToKill, type)} • B ${label}: ${formatHallOfFameValue(type === 'ttk' ? bMetrics?.ttkSeconds : bMetrics?.shotsToKill, type)} • ${buildHallOfFameDiffText(entry)}`;
  item.appendChild(values);

  list.appendChild(item);
}

function renderHallOfFamePanel(container, slot, weaponName, entries) {
  const panel = document.createElement('section');
  panel.className = 'calc-compare-panel calc-hof-panel';

  const heading = document.createElement('div');
  heading.className = 'calc-compare-heading';

  const badge = document.createElement('span');
  badge.className = `calc-compare-slot-badge calc-compare-slot-badge-${slot.toLowerCase()}`;
  badge.textContent = slot;
  heading.appendChild(badge);

  const title = document.createElement('div');
  title.className = 'calc-compare-title';
  title.textContent = weaponName ? `${weaponName} hall of fame` : `Weapon ${slot} hall of fame`;
  heading.appendChild(title);

  panel.appendChild(heading);

  const body = document.createElement('div');
  body.className = 'calc-compare-body calc-hof-body';
  panel.appendChild(body);

  if (!weaponName) {
    const emptyState = document.createElement('div');
    emptyState.className = 'muted';
    emptyState.textContent = `Select weapon ${slot} to compare the full roster`;
    body.appendChild(emptyState);
    container.appendChild(panel);
    return;
  }

  if (entries.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'muted';
    emptyState.textContent = 'No overall wins are available for the current attacks and scope';
    body.appendChild(emptyState);
    container.appendChild(panel);
    return;
  }

  entries.forEach((entry) => appendHallOfFameEntry(body, entry));
  container.appendChild(panel);
}

function renderOverviewCalculation(container) {
  const weaponA = getWeaponForSlot('A');
  const weaponB = getWeaponForSlot('B');
  const selectedAttacksA = getSelectedAttacks('A');
  const selectedAttacksB = getSelectedAttacks('B');

  const rows = buildOverviewRows({
    units: getEnemyOptions(),
    scope: calculatorState.overviewScope,
    weaponA,
    weaponB,
    selectedAttacksA,
    selectedAttacksB,
    hitCountsA: getAttackHitCounts('A', selectedAttacksA),
    hitCountsB: getAttackHitCounts('B', selectedAttacksB)
  });

  const hallOfFame = buildHallOfFameEntries(rows, {
    diffDisplayMode: calculatorState.diffDisplayMode,
    limit: 5
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'calc-compare-results calc-overview-results';

  renderHallOfFamePanel(wrapper, 'A', weaponA?.name, hallOfFame.A);
  renderHallOfFamePanel(wrapper, 'B', weaponB?.name, hallOfFame.B);

  container.appendChild(wrapper);
}

export function renderCalculation() {
  const container = document.getElementById('calculator-result');
  if (!container) {
    return;
  }

  container.innerHTML = '';

  if (calculatorState.mode === 'compare') {
    if (calculatorState.compareView === 'overview') {
      renderOverviewCalculation(container);
      return;
    }

    const compareWrapper = document.createElement('div');
    compareWrapper.className = 'calc-compare-results';

    renderComparePanel(compareWrapper, 'A', calculateDamage('A'));
    renderComparePanel(compareWrapper, 'B', calculateDamage('B'));

    container.appendChild(compareWrapper);
    return;
  }

  const results = calculateDamage('A');
  if (!results) {
    appendEmptyCalculationState(container, 'A');
    return;
  }

  renderCalculationContent(container, 'A', results);
}
