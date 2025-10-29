// calculator/calculation.js — damage calculation logic
import { calculatorState } from './data.js';

export function calculateDamage() {
  const weapon = calculatorState.selectedWeapon;
  const enemy = calculatorState.selectedEnemy;
  
  if (!weapon || !enemy || !enemy.zones) {
    return null;
  }
  
  // Get selected zone
  const selectedRadio = document.querySelector(`input[name^="enemy-zone-"]:checked`);
  if (!selectedRadio) {
    return null;
  }
  
  const zoneIndex = parseInt(selectedRadio.value);
  const zone = enemy.zones[zoneIndex];
  
  if (!zone) {
    return null;
  }
  
  // Get selected attacks from weapon table
  const selectedCheckboxes = document.querySelectorAll('#calculator-weapon-details input[type="checkbox"]:checked');
  if (selectedCheckboxes.length === 0) {
    return null;
  }
  
  const selectedAttacks = [];
  selectedCheckboxes.forEach(checkbox => {
    const rowIndex = parseInt(checkbox.dataset.rowIndex || checkbox.id.split('-').pop());
    if (weapon.rows && weapon.rows[rowIndex]) {
      selectedAttacks.push(weapon.rows[rowIndex]);
    }
  });
  
  // Sum damage from all selected attacks
  let totalDamagePerCycle = 0;
  const attackDetails = [];
  
  for (const attack of selectedAttacks) {
    const ap = parseInt(attack.AP) || 0;
    const av = parseInt(zone.AV) || 0;
    
    // Check AP vs AV
    let damageMultiplier = 0;
    if (ap < av) {
      damageMultiplier = 0; // No damage
    } else if (ap === av) {
      damageMultiplier = 0.65; // 65% damage
    } else {
      damageMultiplier = 1.0; // 100% damage
    }
    
    // Get attack type
    const attackType = attack['Atk Type'] || attack['Atk Type'] || '';
    const isExplosion = attackType.toLowerCase().includes('explosion');
    
    // Check explosion modifier
    let explosionModifier = 1.0;
    if (isExplosion) {
      if (zone.ExMult === '-' || zone.ExMult === null || zone.ExMult === undefined) {
        explosionModifier = 0; // Zone takes no explosion damage
      } else {
        explosionModifier = parseFloat(zone.ExMult) || 1.0;
      }
    }
    
    // Calculate damage for this attack
    const dmg = parseFloat(attack.DMG) || 0;
    const dur = parseFloat(attack.DUR) || 0;
    const durPercent = parseFloat(zone['Dur%']) || 0;
    
    // Store raw values for formula display
    const rawBaseDamage = (dmg * (1 - durPercent)) + (dur * durPercent);
    const damagePerAttack = rawBaseDamage * damageMultiplier * explosionModifier;
    
    // Calculate damage to main health
    let damageToMain = 0;
    const toMainPercent = parseFloat(zone['ToMain%']) || 0;
    const mainCap = zone.MainCap || false;
    
    if (isExplosion) {
      // For explosions, check ExTarget
      const exTarget = zone.ExTarget || 'Part';
      if (exTarget === 'Main') {
        // If ExTarget is Main, the explosion deals ToMain% to main health
        damageToMain = damagePerAttack * toMainPercent;
      } else {
        // If ExTarget is Part, the damage to the part is transferred to main (with ToMain%)
        damageToMain = damagePerAttack * toMainPercent;
      }
    } else {
      // For projectiles, always use ToMain%
      damageToMain = damagePerAttack * toMainPercent;
    }
    
    // Always add to details (even if 0 damage)
    attackDetails.push({
      name: attack['Atk Name'] || attack.Name || 'Unknown',
      damage: damagePerAttack,
      damageToMain: damageToMain,
      dmg: dmg,
      dur: dur,
      durPercent: durPercent,
      ap: ap,
      av: av,
      damageMultiplier: damageMultiplier,
      explosionModifier: explosionModifier,
      isExplosion: isExplosion,
      rawBaseDamage: rawBaseDamage,
      toMainPercent: toMainPercent,
      exTarget: zone.ExTarget || '',
      hits: 1 // Will be set by input field
    });
  }
  
  return {
    attackDetails: attackDetails
  };
}

export function renderCalculation() {
  const container = document.getElementById('calculator-result');
  if (!container) return;
  
  const results = calculateDamage();
  
  if (!results) {
    container.innerHTML = '';
    const noResults = document.createElement('div');
    noResults.textContent = 'Select weapon attack(s) and an enemy zone to see calculations';
    noResults.style.color = 'var(--muted)';
    noResults.style.padding = '16px';
    container.appendChild(noResults);
    return;
  }
  
  // Get zone info for calculations
  const enemy = calculatorState.selectedEnemy;
  const selectedRadio = document.querySelector(`input[name^="enemy-zone-"]:checked`);
  const zoneIndex = selectedRadio ? parseInt(selectedRadio.value) : 0;
  const zone = enemy?.zones?.[zoneIndex];
  const zoneHealth = zone ? parseInt(zone.health) || 0 : 0;
  const zoneCon = zone ? parseInt(zone.Con) || 0 : 0;
  const enemyMainHealth = enemy ? parseInt(enemy.health) || 0 : 0;
  
  // Preserve existing hit counts from previous render
  const hitCounts = {};
  for (let i = 0; i < 100; i++) {
    const existingElement = document.getElementById(`hits-display-${i}`);
    if (existingElement) {
      hitCounts[i] = parseInt(existingElement.textContent) || 1;
    }
  }
  
  container.innerHTML = '';
  
  // Calculate total damage per cycle and attacks to kill
  let totalDamagePerCycle = 0;
  let totalDamageToMainPerCycle = 0;
  results.attackDetails.forEach((attack, index) => {
    const hits = hitCounts[index] || 1;
    totalDamagePerCycle += attack.damage * hits;
    totalDamageToMainPerCycle += (attack.damageToMain || 0) * hits;
    attack.hits = hits;
  });
  
  let attacksToKill = null;
  let attacksToKillWithCon = null;
  let attacksToKillMain = null;
  
  if (totalDamagePerCycle > 0) {
    attacksToKill = Math.ceil(zoneHealth / totalDamagePerCycle);
    if (zoneCon > 0) {
      attacksToKillWithCon = Math.ceil((zoneHealth + zoneCon) / totalDamagePerCycle);
    }
  }
  
  if (totalDamageToMainPerCycle > 0 && enemyMainHealth > 0) {
    attacksToKillMain = Math.ceil(enemyMainHealth / totalDamageToMainPerCycle);
  }
  
  // Show each attack's detailed calculation
  results.attackDetails.forEach((attack, index) => {
    const attackCard = document.createElement('div');
    attackCard.className = 'calc-attack-card';
    attackCard.dataset.attackIndex = index;
    
    const leftContent = document.createElement('div');
    leftContent.className = 'calc-attack-content';
    
    // Attack name
    const attackName = document.createElement('div');
    attackName.className = 'calc-attack-name';
    attackName.textContent = attack.name;
    leftContent.appendChild(attackName);
    
    // Helper values for calculation display
    const apMultiText = attack.ap < attack.av ? '0 (AP < AV)' : 
                       attack.ap === attack.av ? '0.65 (AP = AV)' : 
                       '1.0 (AP > AV)';
    
    const exMultText = attack.isExplosion ? 
      (attack.explosionModifier === 0 ? '0 (immune)' : attack.explosionModifier) : 
      '1.0';
    
    // Calculated damage to zone with inline calculation
    const damageResult = document.createElement('div');
    damageResult.className = 'calc-damage-line';
    const perHitText = attack.hits !== 1 ? ' per hit' : '';
    
    const damageValue = document.createElement('span');
    damageValue.className = attack.damage > 0 ? 'calc-damage-value' : 'calc-damage-value muted';
    damageValue.textContent = `Zone damage: ${attack.damage.toFixed(2)}`;
    damageResult.appendChild(damageValue);
    
    const damageCalc = document.createElement('span');
    damageCalc.className = 'calc-formula';
    
    // Calculate premultiplied values
    const dmgMultiplied = attack.dmg * (1 - attack.durPercent);
    const durMultiplied = attack.dur * attack.durPercent;
    const baseDamage = dmgMultiplied + durMultiplied;
    
    // Get AP multiplier value (without description for premult part)
    const apMultiplier = attack.ap < attack.av ? 0 : attack.ap === attack.av ? 0.65 : 1.0;
    const exMultValue = attack.isExplosion ? (attack.explosionModifier === 0 ? 0 : attack.explosionModifier) : 1.0;
    
    // Add ExMult description to the expanded part
    const exMultTextExpanded = attack.isExplosion ? 
      (attack.explosionModifier === 0 ? '0 (immune)' : `${attack.explosionModifier} (ExMult)`) : 
      '1.0';
    
    damageCalc.textContent = `= (${dmgMultiplied.toFixed(2)} + ${durMultiplied.toFixed(2)}) × ${apMultiplier} × ${exMultValue} = ((${attack.dmg} × (1 - ${attack.durPercent})) + (${attack.dur} × ${attack.durPercent})) × ${apMultiText} × ${exMultTextExpanded}`;
    damageResult.appendChild(damageCalc);
    
    leftContent.appendChild(damageResult);
    
    // Calculated damage to main health with inline calculation
    const mainDamageResult = document.createElement('div');
    mainDamageResult.className = 'calc-main-damage-line';
    
    const mainDamageValue = document.createElement('span');
    mainDamageValue.className = attack.damageToMain > 0 ? 'calc-main-damage-value' : 'calc-main-damage-value muted';
    mainDamageValue.textContent = `Main health damage: ${(attack.damageToMain || 0).toFixed(2)}`;
    mainDamageResult.appendChild(mainDamageValue);
    
    // Add calculation formula for main health damage
    if (attack.damageToMain > 0) {
      const mainDamageCalc = document.createElement('span');
      mainDamageCalc.className = 'calc-formula';
      
      // Build the calculation based on attack type
      let mainCalcText = '';
      if (attack.isExplosion && attack.exTarget === 'Main') {
        // For explosions with ExTarget Main: damage × ToMain%
        mainCalcText = `= ${attack.damage.toFixed(2)} × ${attack.toMainPercent.toFixed(2)}`;
      } else if (!attack.isExplosion) {
        // For projectiles: damage × ToMain%
        mainCalcText = `= ${attack.damage.toFixed(2)} × ${attack.toMainPercent.toFixed(2)}`;
      }
      
      mainDamageCalc.textContent = mainCalcText;
      mainDamageResult.appendChild(mainDamageCalc);
    }
    
    leftContent.appendChild(mainDamageResult);
    
    attackCard.appendChild(leftContent);
    
    // Add hit count controls on the right
    const inputContainer = document.createElement('div');
    inputContainer.className = 'calc-hits-control';
    
    const hitsLabel = document.createElement('div');
    hitsLabel.className = 'calc-hits-label';
    hitsLabel.textContent = 'Hits';
    inputContainer.appendChild(hitsLabel);
    
    // Container for arrows and number display
    const hitsContainer = document.createElement('div');
    hitsContainer.className = 'calc-hits-container';
    
    // Down arrow (left side)
    const downButton = document.createElement('button');
    downButton.className = 'calc-hits-btn';
    downButton.textContent = '◀';
    downButton.addEventListener('click', () => {
      const currentValue = parseInt(hitsInput.textContent) || 1;
      hitsInput.textContent = Math.max(1, currentValue - 1);
      renderCalculation();
    });
    hitsContainer.appendChild(downButton);
    
    // Number display (not an input field)
    const hitsInput = document.createElement('div');
    hitsInput.className = 'calc-hits-display';
    hitsInput.textContent = attack.hits;
    hitsInput.dataset.attackIndex = index;
    hitsInput.id = `hits-display-${index}`;
    hitsContainer.appendChild(hitsInput);
    
    // Up arrow (right side)
    const upButton = document.createElement('button');
    upButton.className = 'calc-hits-btn';
    upButton.textContent = '▶';
    upButton.addEventListener('click', () => {
      const currentValue = parseInt(hitsInput.textContent) || 1;
      hitsInput.textContent = currentValue + 1;
      renderCalculation();
    });
    hitsContainer.appendChild(upButton);
    
    inputContainer.appendChild(hitsContainer);
    
    attackCard.appendChild(inputContainer);
    
    // Display total damage for this attack (only if hits !== 1)
    if (attack.hits !== 1) {
      const totalDamageForAttack = document.createElement('div');
      totalDamageForAttack.className = 'calc-main-damage-line';
      totalDamageForAttack.textContent = `Total: ${(attack.damage * attack.hits).toFixed(2)} damage`;
      totalDamageForAttack.classList.add(attack.damage > 0 ? 'calc-damage-value' : 'calc-damage-value', 'muted');
      leftContent.appendChild(totalDamageForAttack);
    }
    
    container.appendChild(attackCard);
  });
  
  // Show total
  const totalCard = document.createElement('div');
  totalCard.className = 'calc-total-card';
  
  const totalDamage = document.createElement('div');
  totalDamage.className = 'calc-total-damage';
  totalDamage.textContent = 'Total Combined Damage per Cycle';
  totalCard.appendChild(totalDamage);
  
  // Combined display with zone and main damage side by side
  const combinedDamage = document.createElement('div');
  combinedDamage.className = 'calc-combined-display';
  
  // Zone damage display
  const zoneDamageContainer = document.createElement('div');
  zoneDamageContainer.className = 'calc-damage-section';
  
  const zoneLabel = document.createElement('div');
  zoneLabel.className = 'calc-section-label';
  zoneLabel.textContent = 'Zone:';
  zoneDamageContainer.appendChild(zoneLabel);
  
  const zoneDamageDisplay = document.createElement('div');
  zoneDamageDisplay.className = 'calc-damage-fraction-wrapper';
  
  if (totalDamagePerCycle > 0) {
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
    resultLine.textContent = `= ${(zoneHealth / totalDamagePerCycle).toFixed(2)} (${attacksToKill}) shots`;
    
    const shotsText = document.createElement('div');
    shotsText.className = 'calc-result-text';
    shotsText.textContent = 'shots to destroy';
    
    result.appendChild(resultLine);
    result.appendChild(shotsText);
    
    zoneDamageDisplay.appendChild(fraction);
    zoneDamageDisplay.appendChild(result);

    // If the zone has Constitution, also show shots required to deplete it
    if (zoneCon > 0 && attacksToKillWithCon !== null) {
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
      conResultLine.textContent = `= ${((zoneHealth + zoneCon) / totalDamagePerCycle).toFixed(2)} (${attacksToKillWithCon}) shots`;

      const conShotsText = document.createElement('div');
      conShotsText.className = 'calc-result-text';
      conShotsText.textContent = 'shots to deplete constitution';

      conResult.appendChild(conResultLine);
      conResult.appendChild(conShotsText);

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
  
  // Main health damage display
  const mainDamageContainer = document.createElement('div');
  mainDamageContainer.className = 'calc-damage-section';
  
  const mainLabel = document.createElement('div');
  mainLabel.className = 'calc-section-label';
  mainLabel.textContent = 'Main:';
  mainDamageContainer.appendChild(mainLabel);
  
  const mainDamageDisplay = document.createElement('div');
  mainDamageDisplay.className = 'calc-damage-fraction-wrapper';
  
  if (totalDamageToMainPerCycle > 0 && enemyMainHealth > 0) {
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
    resultLine.textContent = `= ${(enemyMainHealth / totalDamageToMainPerCycle).toFixed(2)} (${attacksToKillMain}) shots`;
    
    const shotsText = document.createElement('div');
    shotsText.className = 'calc-result-text';
    shotsText.textContent = 'shots to destroy';
    
    result.appendChild(resultLine);
    result.appendChild(shotsText);
    
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

