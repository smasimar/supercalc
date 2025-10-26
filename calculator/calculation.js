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
    
    // Always add to details (even if 0 damage)
    attackDetails.push({
      name: attack['Atk Name'] || attack.Name || 'Unknown',
      damage: damagePerAttack,
      dmg: dmg,
      dur: dur,
      durPercent: durPercent,
      ap: ap,
      av: av,
      damageMultiplier: damageMultiplier,
      explosionModifier: explosionModifier,
      isExplosion: isExplosion,
      rawBaseDamage: rawBaseDamage,
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
  results.attackDetails.forEach((attack, index) => {
    const hits = hitCounts[index] || 1;
    totalDamagePerCycle += attack.damage * hits;
    attack.hits = hits;
  });
  
  let attacksToKill = null;
  let attacksToKillWithCon = null;
  
  if (totalDamagePerCycle > 0) {
    attacksToKill = Math.ceil(zoneHealth / totalDamagePerCycle);
    if (zoneCon > 0) {
      attacksToKillWithCon = Math.ceil((zoneHealth + zoneCon) / totalDamagePerCycle);
    }
  }
  
  // Show each attack's detailed calculation
  results.attackDetails.forEach((attack, index) => {
    const attackCard = document.createElement('div');
    attackCard.dataset.attackIndex = index;
    attackCard.style.padding = '12px';
    attackCard.style.border = '2px solid var(--border)';
    attackCard.style.marginBottom = '8px';
    attackCard.style.background = '#171717';
    attackCard.style.position = 'relative';
    
    const leftContent = document.createElement('div');
    leftContent.style.width = 'calc(100% - 80px)';
    
    // Attack name
    const attackName = document.createElement('div');
    attackName.style.fontWeight = 'bold';
    attackName.style.marginBottom = '6px';
    attackName.textContent = attack.name;
    leftContent.appendChild(attackName);
    
    // Formula line 1: variables
    const formulaLine1 = document.createElement('div');
    formulaLine1.style.fontSize = '12px';
    formulaLine1.style.fontFamily = 'monospace';
    formulaLine1.style.color = 'var(--muted)';
    formulaLine1.textContent = `Damage = ((DMG × (1 - Dur%)) + (DUR × Dur%)) × AP_Multi × ExMult`;
    leftContent.appendChild(formulaLine1);
    
    // Formula line 2: values
    const formulaLine2 = document.createElement('div');
    formulaLine2.style.fontSize = '12px';
    formulaLine2.style.fontFamily = 'monospace';
    formulaLine2.style.color = 'var(--muted)';
    formulaLine2.style.marginTop = '2px';
    
    const apMultiText = attack.ap < attack.av ? '0 (AP < AV)' : 
                       attack.ap === attack.av ? '0.65 (AP = AV)' : 
                       '1.0 (AP > AV)';
    
    const exMultText = attack.isExplosion ? 
      (attack.explosionModifier === 0 ? '0 (immune)' : attack.explosionModifier) : 
      '1.0';
    
    formulaLine2.textContent = `Damage = ((${attack.dmg} × (1 - ${attack.durPercent})) + (${attack.dur} × ${attack.durPercent})) × ${apMultiText} × ${exMultText}`;
    leftContent.appendChild(formulaLine2);
    
    // Calculated damage
    const damageResult = document.createElement('div');
    damageResult.style.marginTop = '6px';
    damageResult.style.fontSize = '13px';
    damageResult.style.fontWeight = 'bold';
    const perHitText = attack.hits !== 1 ? ' per hit' : '';
    damageResult.textContent = `Result: ${attack.damage.toFixed(2)} damage${perHitText}`;
    if (attack.damage > 0) {
      damageResult.style.color = 'var(--accent)';
    } else {
      damageResult.style.color = 'var(--muted)';
    }
    leftContent.appendChild(damageResult);
    
    attackCard.appendChild(leftContent);
    
    // Add hit count controls on the right
    const inputContainer = document.createElement('div');
    inputContainer.style.position = 'absolute';
    inputContainer.style.right = '12px';
    inputContainer.style.top = '12px';
    inputContainer.style.textAlign = 'center';
    
    const hitsLabel = document.createElement('div');
    hitsLabel.textContent = 'Hits';
    hitsLabel.style.fontSize = '11px';
    hitsLabel.style.marginBottom = '4px';
    hitsLabel.style.color = 'var(--muted)';
    inputContainer.appendChild(hitsLabel);
    
    // Number display (not an input field)
    const hitsInput = document.createElement('div');
    hitsInput.textContent = attack.hits;
    hitsInput.dataset.attackIndex = index;
    hitsInput.id = `hits-display-${index}`;
    hitsInput.style.width = '50px';
    hitsInput.style.height = '28px';
    hitsInput.style.lineHeight = '28px';
    hitsInput.style.textAlign = 'center';
    hitsInput.style.background = '#0d1117';
    hitsInput.style.border = '1px solid var(--border)';
    hitsInput.style.color = 'var(--text)';
    hitsInput.style.fontSize = '14px';
    
    // Up arrow
    const upButton = document.createElement('button');
    upButton.textContent = '▲';
    upButton.style.background = 'transparent';
    upButton.style.border = 'none';
    upButton.style.color = 'var(--text)';
    upButton.style.cursor = 'pointer';
    upButton.style.fontSize = '10px';
    upButton.style.width = '50px';
    upButton.style.height = '16px';
    upButton.style.padding = '0';
    upButton.addEventListener('click', () => {
      const currentValue = parseInt(hitsInput.textContent) || 1;
      hitsInput.textContent = currentValue + 1;
      renderCalculation();
    });
    inputContainer.appendChild(upButton);
    inputContainer.appendChild(hitsInput);
    
    // Down arrow
    const downButton = document.createElement('button');
    downButton.textContent = '▼';
    downButton.style.background = 'transparent';
    downButton.style.border = 'none';
    downButton.style.color = 'var(--text)';
    downButton.style.cursor = 'pointer';
    downButton.style.fontSize = '10px';
    downButton.style.width = '50px';
    downButton.style.height = '16px';
    downButton.style.padding = '0';
    downButton.addEventListener('click', () => {
      const currentValue = parseInt(hitsInput.textContent) || 1;
      hitsInput.textContent = Math.max(1, currentValue - 1);
      renderCalculation();
    });
    inputContainer.appendChild(downButton);
    
    attackCard.appendChild(inputContainer);
    
    // Display total damage for this attack (only if hits !== 1)
    if (attack.hits !== 1) {
      const totalDamageForAttack = document.createElement('div');
      totalDamageForAttack.style.marginTop = '4px';
      totalDamageForAttack.style.fontSize = '12px';
      totalDamageForAttack.textContent = `Total: ${(attack.damage * attack.hits).toFixed(2)} damage`;
      if (attack.damage > 0) {
        totalDamageForAttack.style.color = 'var(--accent)';
      } else {
        totalDamageForAttack.style.color = 'var(--muted)';
      }
      leftContent.appendChild(totalDamageForAttack);
    }
    
    container.appendChild(attackCard);
  });
  
  // Show total
  const totalCard = document.createElement('div');
  totalCard.style.padding = '12px';
  totalCard.style.border = '2px solid var(--border)';
  totalCard.style.marginBottom = '8px';
  totalCard.style.background = '#202020';
  
  const totalDamage = document.createElement('div');
  totalDamage.style.fontWeight = 'bold';
  totalDamage.style.marginBottom = '6px';
  totalDamage.textContent = 'Total Combined Damage per Cycle';
  totalDamage.style.fontSize = '14px';
  totalCard.appendChild(totalDamage);
  
  const totalDamageValue = document.createElement('div');
  totalDamageValue.style.fontSize = '16px';
  totalDamageValue.style.fontWeight = 'bold';
  totalDamageValue.textContent = `${totalDamagePerCycle.toFixed(2)}`;
  if (totalDamagePerCycle > 0) {
    totalDamageValue.style.color = 'var(--accent)';
  } else {
    totalDamageValue.style.color = 'var(--muted)';
  }
  totalCard.appendChild(totalDamageValue);
  
  if (attacksToKill !== null) {
    const attacksText = document.createElement('div');
    attacksText.style.marginTop = '8px';
    attacksText.style.fontSize = '13px';
    attacksText.textContent = `Attacks to destroy zone: ${attacksToKill}`;
    attacksText.style.color = 'var(--text)';
    totalCard.appendChild(attacksText);
    
    if (zoneCon > 0 && attacksToKillWithCon !== null) {
      const attacksWithConText = document.createElement('div');
      attacksWithConText.style.marginTop = '4px';
      attacksWithConText.style.fontSize = '13px';
      attacksWithConText.textContent = `Attacks to destroy (with Con): ${attacksToKillWithCon}`;
      attacksWithConText.style.color = 'var(--accent)';
      totalCard.appendChild(attacksWithConText);
    }
  }
  
  container.appendChild(totalCard);
}

