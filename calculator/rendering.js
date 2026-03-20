// calculator/rendering.js — render selected weapon and enemy details
import {
  armorValueColor,
  atkColorClass,
  apColorClass,
  classifyAtkType,
  dfColorClass,
  durPercentageColor
} from '../colors.js';
import {
  getOverviewScopeOptions,
  getAttackHitCounts,
  calculatorState,
  getEnemyOptions,
  getSelectedAttackKeys,
  getSelectedAttacks,
  getWeaponForSlot,
  setDiffDisplayMode,
  setEnemyGroupMode,
  setOverviewScope,
  setSelectedAttack,
  setSelectedZoneIndex,
  toggleEnemySort
} from './data.js';
import {
  buildOverviewRows,
  buildAttackUnionRows,
  buildZoneComparisonMetrics,
  getDiffDisplayMetric,
  getAttackRowKey,
  getOutcomeGroupingSlot,
  sortEnemyZoneRows
} from './compare-utils.js';
import { renderCalculation } from './calculation.js';
import { formatTtkSeconds } from './summary.js';
import { tokenizeFormattedTtk } from './ttk-formatting.js';
import { getZoneOutcomeDescription, getZoneOutcomeLabel } from './zone-damage.js';

const DEFAULT_WEAPON_HEADERS = ['Name', 'DMG', 'DUR', 'AP', 'DF', 'ST', 'PF'];
const ENEMY_BASE_COLUMNS = [
  { key: 'zone_name', label: 'Zone Name' },
  { key: 'health', label: 'Health' },
  { key: 'Con', label: 'Con' },
  { key: 'Dur%', label: 'Dur%' },
  { key: 'AV', label: 'AV' },
  { key: 'IsFatal', label: 'IsFatal' },
  { key: 'ExTarget', label: 'ExTarget' },
  { key: 'ExMult', label: 'ExMult' },
  { key: 'ToMain%', label: 'ToMain%' },
  { key: 'MainCap', label: 'MainCap' }
];

const OVERVIEW_COLUMNS = [
  { key: 'faction', label: 'Faction' },
  { key: 'enemy', label: 'Enemy' },
  ...ENEMY_BASE_COLUMNS
];

function createPlaceholder(container, text) {
  const noData = document.createElement('div');
  noData.textContent = text;
  noData.style.color = 'var(--muted)';
  container.appendChild(noData);
}

function appendOutcomeBadge(cell, outcomeKind) {
  const outcomeLabel = getZoneOutcomeLabel(outcomeKind);
  const outcomeDescription = getZoneOutcomeDescription(outcomeKind);
  if (!outcomeLabel) {
    return;
  }

  const badge = document.createElement('span');
  badge.className = `calc-zone-context calc-zone-context-${outcomeKind}`;
  badge.title = outcomeDescription || outcomeLabel;
  badge.textContent = outcomeLabel;
  cell.appendChild(badge);
}

function createTtkValueNode(ttkSeconds) {
  const ttkValue = document.createElement('span');
  ttkValue.className = 'calc-derived-value';

  if (ttkSeconds === null) {
    ttkValue.textContent = '-';
    ttkValue.classList.add('muted');
    return ttkValue;
  }

  ttkValue.classList.add('calc-ttk-value');
  const formattedTtk = formatTtkSeconds(ttkSeconds);
  const tokens = tokenizeFormattedTtk(formattedTtk);

  tokens.forEach(({ text, kind }) => {
    const token = document.createElement('span');
    token.className = `calc-ttk-token calc-ttk-token-${kind}`;
    token.textContent = text;
    ttkValue.appendChild(token);
  });

  return ttkValue;
}

function formatPercentDiff(value) {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(1).replace(/\.0$/, '')}%`;
}

function createDiffValueNode(diffMetric, valueType, diffDisplayMode = 'absolute') {
  const diffValue = document.createElement('span');
  diffValue.className = 'calc-derived-value calc-diff-value';
  const displayMetric = getDiffDisplayMetric(diffMetric, diffDisplayMode);

  if (displayMetric.kind === 'unavailable') {
    diffValue.textContent = '-';
    diffValue.classList.add('muted');
    return diffValue;
  }

  if (displayMetric.kind === 'one-sided') {
    diffValue.classList.add('calc-diff-special');
    diffValue.classList.add(displayMetric.winner === 'B' ? 'calc-diff-better' : 'calc-diff-worse');
    diffValue.textContent = `${displayMetric.winner} Only`;
    return diffValue;
  }

  const value = displayMetric.value;
  if (value < 0) {
    diffValue.classList.add('calc-diff-better');
  } else if (value > 0) {
    diffValue.classList.add('calc-diff-worse');
  } else {
    diffValue.classList.add('calc-diff-neutral');
  }

  if (diffDisplayMode === 'percent') {
    diffValue.textContent = formatPercentDiff(value);
    return diffValue;
  }

  if (valueType === 'ttk') {
    const prefix = value > 0 ? '+' : value < 0 ? '-' : '';
    if (prefix) {
      const sign = document.createElement('span');
      sign.className = 'calc-diff-sign';
      sign.textContent = prefix;
      diffValue.appendChild(sign);
    }

    const tokens = tokenizeFormattedTtk(formatTtkSeconds(Math.abs(value)));
    tokens.forEach(({ text, kind }) => {
      const token = document.createElement('span');
      token.className = `calc-ttk-token calc-ttk-token-${kind}`;
      token.textContent = text;
      diffValue.appendChild(token);
    });

    return diffValue;
  }

  diffValue.textContent = value > 0 ? `+${value}` : String(value);
  return diffValue;
}

function getDiffMetricTitle(diffMetric, valueType, diffDisplayMode = 'absolute') {
  const displayMetric = getDiffDisplayMetric(diffMetric, diffDisplayMode);
  if (displayMetric.kind === 'unavailable') {
    if (diffDisplayMode === 'percent') {
      return 'Percent diff unavailable when either side is unavailable or A has no positive baseline';
    }
    return 'Diff unavailable when either side is unavailable';
  }

  if (displayMetric.kind === 'one-sided') {
    const metricLabel = valueType === 'ttk' ? 'TTK' : 'shots';
    const displayValue = valueType === 'ttk'
      ? formatTtkSeconds(displayMetric.displayValue)
      : String(displayMetric.displayValue);
    return `Only weapon ${displayMetric.winner} can damage this part with the current selection (${displayMetric.winner} ${metricLabel}: ${displayValue})`;
  }

  return diffDisplayMode === 'percent'
    ? 'Percent diff = ((B - A) / A) × 100'
    : 'Diff = B - A';
}

function getMetricTitle(slot, slotMetrics, valueType) {
  if (!slotMetrics?.weapon) {
    return calculatorState.mode === 'compare'
      ? `Select weapon ${slot}`
      : 'Select a weapon';
  }

  if (slotMetrics.selectedAttackCount === 0) {
    return calculatorState.mode === 'compare'
      ? `Select one or more attack rows for weapon ${slot}`
      : 'Select one or more attack rows';
  }

  if (!slotMetrics.damagesZone) {
    return calculatorState.mode === 'compare'
      ? `Weapon ${slot}'s selected attacks do not damage this part`
      : 'Selected attacks do not damage this part';
  }

  if (valueType === 'ttk' && !slotMetrics.hasRpm) {
    return calculatorState.mode === 'compare'
      ? `Weapon ${slot} TTK is unavailable without RPM`
      : 'TTK unavailable without RPM';
  }

  if (valueType === 'ttk' && slotMetrics.outcomeKind === 'limb') {
    return 'This part can be removed, but it breaks before it can kill main';
  }

  if (valueType === 'ttk' && slotMetrics.outcomeKind === 'utility') {
    return 'This part can be removed, but destroying it does not kill the enemy';
  }

  const outcomeDescription = getZoneOutcomeDescription(slotMetrics.outcomeKind);
  return outcomeDescription || null;
}

function formatWeaponCellValue(header, row, td, atkClass) {
  const weaponsState = window._weaponsState;
  const headerValue = row?.[header];
  let value = headerValue ?? '';
  const lowerHeader = header.toLowerCase();
  const isDamage = /^(damage|dmg)$/.test(lowerHeader);
  const isDuration = /^(dur|duration)$/.test(lowerHeader);

  if ((isDamage || isDuration) && atkClass) {
    const className = atkColorClass(atkClass);
    if (className) {
      td.classList.add(className);
    }
  }

  if (weaponsState?.keys?.apKey && header === weaponsState.keys.apKey) {
    td.classList.add(apColorClass(value));
  } else if (!weaponsState?.keys?.apKey && (lowerHeader === 'ap' || (lowerHeader.includes('armor') && lowerHeader.includes('pen')))) {
    td.classList.add(apColorClass(value));
  }

  if (weaponsState?.keys?.atkTypeKey && header === weaponsState.keys.atkTypeKey) {
    const className = atkColorClass(atkClass);
    if (className) {
      td.classList.add(className);
    }
  }

  if (lowerHeader === 'df') {
    const dfClassName = dfColorClass(value);
    if (dfClassName) {
      td.classList.add(dfClassName);
    }
  }

  if (weaponsState?.keys?.atkNameKey && header === weaponsState.keys.atkNameKey) {
    const className = atkColorClass(atkClass);
    if (className) {
      td.classList.add(className);
    }
    td.classList.add('trunc');
    if (value != null) {
      td.title = String(value);
    }
  }

  if (typeof value === 'number') {
    const numeric = Number(value);
    value = Number.isInteger(numeric) ? numeric.toString() : numeric.toFixed(3).replace(/\.0+$/, '');
  }

  td.textContent = value === null || value === undefined ? '' : value;
}

function appendWeaponSelectionCell(tr, { slot, attackRow, attackKey }) {
  const td = document.createElement('td');
  td.style.padding = '4px 10px';
  td.style.borderBottom = '1px solid var(--border)';
  td.style.width = '30px';
  td.style.textAlign = 'center';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.disabled = !attackRow;
  checkbox.checked = attackRow ? getSelectedAttackKeys(slot).includes(attackKey) : false;

  if (!attackRow) {
    checkbox.title = `Weapon ${slot} does not have this attack row`;
  }

  checkbox.addEventListener('change', () => {
    setSelectedAttack(slot, attackKey, checkbox.checked);
    renderEnemyDetails();
    renderCalculation();
  });

  td.appendChild(checkbox);
  tr.appendChild(td);

  return checkbox;
}

function getWeaponDisplayRows() {
  const weaponA = getWeaponForSlot('A');
  const weaponB = getWeaponForSlot('B');

  if (calculatorState.mode === 'compare') {
    return buildAttackUnionRows(weaponA, weaponB);
  }

  return (weaponA?.rows || []).map((row) => ({
    key: getAttackRowKey(row),
    displayRow: row,
    rowA: row,
    rowB: null
  }));
}

export function renderWeaponDetails() {
  const container = document.getElementById('calculator-weapon-details');
  if (!container) {
    return;
  }

  container.innerHTML = '';

  const compareMode = calculatorState.mode === 'compare';
  const weaponA = getWeaponForSlot('A');
  const weaponB = getWeaponForSlot('B');
  if ((!compareMode && !weaponA) || (compareMode && !weaponA && !weaponB)) {
    createPlaceholder(
      container,
      compareMode
        ? 'Select weapon A and/or weapon B to view details'
        : 'Select a weapon to view details'
    );
    return;
  }

  const rows = getWeaponDisplayRows();
  if (rows.length === 0) {
    createPlaceholder(container, 'No attack rows available for the selected weapon(s)');
    return;
  }

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.className = 'calculator-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  const selectionHeaders = compareMode ? ['A', 'B'] : [''];
  selectionHeaders.forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    th.style.padding = '4px 10px';
    th.style.textAlign = 'center';
    th.style.borderBottom = '2px solid var(--border)';
    th.style.color = 'var(--muted)';
    th.style.width = '30px';
    headerRow.appendChild(th);
  });

  const weaponsState = window._weaponsState;
  const headers = weaponsState?.headers || DEFAULT_WEAPON_HEADERS;

  headers.forEach((header) => {
    const th = document.createElement('th');
    th.textContent = header;
    th.style.padding = '4px 10px';
    th.style.textAlign = 'left';
    th.style.borderBottom = '2px solid var(--border)';
    th.style.color = 'var(--muted)';
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const atkTypeKey = weaponsState?.keys?.atkTypeKey;

  rows.forEach((entry) => {
    const tr = document.createElement('tr');
    const displayRow = entry.displayRow;
    const attackKey = entry.key;
    const atkClass = atkTypeKey ? classifyAtkType(displayRow, atkTypeKey) : null;

    const checkboxA = appendWeaponSelectionCell(tr, {
      slot: 'A',
      attackRow: entry.rowA,
      attackKey
    });

    let checkboxB = null;
    if (compareMode) {
      checkboxB = appendWeaponSelectionCell(tr, {
        slot: 'B',
        attackRow: entry.rowB,
        attackKey
      });
    }

    if (!compareMode) {
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', (event) => {
        if (event.target !== checkboxA) {
          checkboxA.checked = !checkboxA.checked;
          setSelectedAttack('A', attackKey, checkboxA.checked);
          renderEnemyDetails();
          renderCalculation();
        }
      });
    } else {
      const availableSlots = [entry.rowA ? 'A' : null, entry.rowB ? 'B' : null].filter(Boolean);
      if (availableSlots.length === 1) {
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', (event) => {
          if (event.target === checkboxA || event.target === checkboxB) {
            return;
          }

          const slot = availableSlots[0];
          const targetCheckbox = slot === 'A' ? checkboxA : checkboxB;
          if (!targetCheckbox) {
            return;
          }

          targetCheckbox.checked = !targetCheckbox.checked;
          setSelectedAttack(slot, attackKey, targetCheckbox.checked);
          renderEnemyDetails();
          renderCalculation();
        });
      }
    }

    headers.forEach((header) => {
      const td = document.createElement('td');
      formatWeaponCellValue(header, displayRow, td, atkClass);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

function getEnemyColumns() {
  if (calculatorState.mode === 'compare') {
    return [
      ...ENEMY_BASE_COLUMNS,
      { key: 'shotsA', label: 'A Shots' },
      { key: 'shotsB', label: 'B Shots' },
      { key: 'shotsDiff', label: 'Diff Shots' },
      { key: 'ttkA', label: 'A TTK' },
      { key: 'ttkB', label: 'B TTK' },
      { key: 'ttkDiff', label: 'Diff TTK' }
    ];
  }

  return [
    ...ENEMY_BASE_COLUMNS,
    { key: 'shots', label: 'Shots' },
    { key: 'ttk', label: 'TTK' }
  ];
}

function getOverviewColumns() {
  return [
    ...OVERVIEW_COLUMNS,
    { key: 'shotsA', label: 'A Shots' },
    { key: 'shotsB', label: 'B Shots' },
    { key: 'shotsDiff', label: 'Diff Shots' },
    { key: 'ttkA', label: 'A TTK' },
    { key: 'ttkB', label: 'B TTK' },
    { key: 'ttkDiff', label: 'Diff TTK' }
  ];
}

function appendToolbarButtonGroup(toolbar, labelText, items, isActive, onClick) {
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = labelText;
  toolbar.appendChild(label);

  const group = document.createElement('div');
  group.className = 'calculator-toolbar-group';

  items.forEach(({ value, label: itemLabel }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button calculator-toolbar-button';
    button.textContent = itemLabel;
    button.classList.toggle('is-active', isActive(value));
    button.addEventListener('click', () => onClick(value));
    group.appendChild(button);
  });

  toolbar.appendChild(group);
}

function renderEnemyControls(enemy) {
  const controlsContainer = document.getElementById('calculator-enemy-controls');
  if (!controlsContainer) {
    return;
  }

  controlsContainer.innerHTML = '';

  const overviewActive = calculatorState.mode === 'compare' && calculatorState.compareView === 'overview';
  const hasFocusedEnemy = Boolean(enemy && enemy.zones && enemy.zones.length > 0);
  if (!overviewActive && !hasFocusedEnemy) {
    controlsContainer.classList.add('hidden');
    return;
  }

  controlsContainer.classList.remove('hidden');

  const toolbar = document.createElement('div');
  toolbar.className = 'calculator-toolbar';

  appendToolbarButtonGroup(
    toolbar,
    'Grouping:',
    [
      { value: 'none', label: 'No grouping' },
      { value: 'outcome', label: 'Group by outcome' }
    ],
    (value) => calculatorState.enemySort.groupMode === value,
    (value) => {
      setEnemyGroupMode(value);
      renderEnemyDetails();
    }
  );

  if (overviewActive) {
    appendToolbarButtonGroup(
      toolbar,
      'Scope:',
      getOverviewScopeOptions().map((scope) => ({ value: scope, label: scope })),
      (value) => calculatorState.overviewScope === value,
      (value) => {
        setOverviewScope(value);
        renderEnemyDetails();
        renderCalculation();
      }
    );

    appendToolbarButtonGroup(
      toolbar,
      'Diff:',
      [
        { value: 'absolute', label: 'Absolute' },
        { value: 'percent', label: '%' }
      ],
      (value) => calculatorState.diffDisplayMode === value,
      (value) => {
        setDiffDisplayMode(value);
        renderEnemyDetails();
        renderCalculation();
      }
    );
  }

  const note = document.createElement('span');
  note.className = 'status calculator-toolbar-note';
  if (overviewActive) {
    note.textContent = 'Overview is selected in the enemy dropdown. Pick a specific enemy there to return to the focused view.';
  } else if (calculatorState.mode === 'compare') {
    const groupingSlot = getOutcomeGroupingSlot(calculatorState.mode, calculatorState.enemySort.key);
    note.textContent = groupingSlot === 'B'
      ? 'Diff columns are computed as B - A. One-sided damage wins sort beyond finite deltas, and outcome grouping currently follows B because you are sorting a B column.'
      : 'Diff columns are computed as B - A. One-sided damage wins sort beyond finite deltas, and outcome grouping follows A by default.';
  } else {
    note.textContent = 'Outcome grouping follows the Kill, Main, Limb, Part badge order.';
  }
  toolbar.appendChild(note);

  controlsContainer.appendChild(toolbar);
}

function formatEnemyBaseCell(td, zone, header) {
  const value = zone?.[header];

  if (header === 'zone_name') {
    td.textContent = value || '';
    return;
  }

  if (header === 'health') {
    td.textContent = value === -1 ? '-' : value;
    return;
  }

  if (header === 'Con') {
    if (value === 0) {
      td.textContent = '-';
      td.style.color = 'var(--muted)';
      td.style.opacity = '0.6';
      return;
    }

    td.textContent = value;
    return;
  }

  if (header === 'Dur%') {
    const durability = value || 0;
    td.textContent = `${(durability * 100).toFixed(0)}%`;
    td.style.color = durPercentageColor(durability);
    return;
  }

  if (header === 'AV') {
    td.textContent = value || 0;
    td.style.color = armorValueColor(value);
    return;
  }

  if (header === 'IsFatal') {
    td.textContent = value ? 'Yes' : 'No';
    if (value) {
      td.style.color = 'var(--red)';
    }
    return;
  }

  if (header === 'ExMult') {
    if (value === '-') {
      td.textContent = '-';
      td.style.color = 'var(--muted)';
      td.style.opacity = '0.6';
      return;
    }

    td.textContent = `${(value * 100).toFixed(0)}%`;
    return;
  }

  if (header === 'ToMain%') {
    td.textContent = `${((value || 0) * 100).toFixed(0)}%`;
    return;
  }

  if (header === 'MainCap') {
    td.textContent = value ? 'Yes' : 'No';
    return;
  }

  td.textContent = value || '';
}

function formatOverviewBaseCell(td, row, header) {
  if (header === 'faction') {
    td.textContent = row.faction || '';
    return;
  }

  if (header === 'enemy') {
    td.textContent = row.enemyName || '';
    return;
  }

  formatEnemyBaseCell(td, row.zone, header);
}

function renderOverviewDetails(container) {
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.className = 'calculator-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const columns = getOverviewColumns();

  columns.forEach((column) => {
    const th = document.createElement('th');
    th.textContent = column.label;
    th.classList.add('sortable');
    if (calculatorState.enemySort.key === column.key) {
      th.classList.add(`sort-${calculatorState.enemySort.dir}`);
    }
    th.addEventListener('click', () => {
      toggleEnemySort(column.key);
      renderEnemyDetails();
    });
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const weaponA = getWeaponForSlot('A');
  const weaponB = getWeaponForSlot('B');
  const selectedAttacksA = getSelectedAttacks('A');
  const selectedAttacksB = getSelectedAttacks('B');
  const hitCountsA = getAttackHitCounts('A', selectedAttacksA);
  const hitCountsB = getAttackHitCounts('B', selectedAttacksB);

  const overviewRows = buildOverviewRows({
    units: getEnemyOptions(),
    scope: calculatorState.overviewScope,
    weaponA,
    weaponB,
    selectedAttacksA,
    selectedAttacksB,
    hitCountsA,
    hitCountsB
  });

  if (overviewRows.length === 0) {
    createPlaceholder(container, 'No overview rows are available for the current scope');
    return;
  }

  const sortedRows = sortEnemyZoneRows(overviewRows, {
    mode: 'compare',
    sortKey: calculatorState.enemySort.key,
    sortDir: calculatorState.enemySort.dir,
    groupMode: calculatorState.enemySort.groupMode,
    diffDisplayMode: calculatorState.diffDisplayMode,
    pinMain: false
  });

  const tbody = document.createElement('tbody');

  sortedRows.forEach((row) => {
    const tr = document.createElement('tr');
    if (row.groupStart) {
      tr.classList.add('group-start');
    }

    columns.forEach((column) => {
      if (column.key === 'shotsA') {
        tr.appendChild(buildSingleMetricCell('A', row.metrics.bySlot.A, 'shots'));
        return;
      }

      if (column.key === 'shotsB') {
        tr.appendChild(buildSingleMetricCell('B', row.metrics.bySlot.B, 'shots'));
        return;
      }

      if (column.key === 'shotsDiff') {
        tr.appendChild(buildDiffMetricCell(row.metrics.diffShots, 'shots', calculatorState.diffDisplayMode));
        return;
      }

      if (column.key === 'ttkA') {
        tr.appendChild(buildSingleMetricCell('A', row.metrics.bySlot.A, 'ttk'));
        return;
      }

      if (column.key === 'ttkB') {
        tr.appendChild(buildSingleMetricCell('B', row.metrics.bySlot.B, 'ttk'));
        return;
      }

      if (column.key === 'ttkDiff') {
        tr.appendChild(buildDiffMetricCell(row.metrics.diffTtkSeconds, 'ttk', calculatorState.diffDisplayMode));
        return;
      }

      const td = document.createElement('td');
      formatOverviewBaseCell(td, row, column.key);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

function buildSingleMetricCell(slot, slotMetrics, type) {
  const td = document.createElement('td');
  td.classList.add('calc-derived-cell');

  if (type === 'shots') {
    td.textContent = slotMetrics.shotsToKill === null ? '-' : String(slotMetrics.shotsToKill);
    if (slotMetrics.shotsToKill === null) {
      td.classList.add('muted');
    }
    td.title = getMetricTitle(slot, slotMetrics, 'shots') || '';
    return td;
  }

  const ttkContent = document.createElement('div');
  ttkContent.className = 'calc-derived-inline';
  ttkContent.appendChild(createTtkValueNode(slotMetrics.ttkSeconds));
  appendOutcomeBadge(ttkContent, slotMetrics.outcomeKind);
  td.appendChild(ttkContent);
  td.title = getMetricTitle(slot, slotMetrics, 'ttk') || '';
  return td;
}

function buildDiffMetricCell(value, valueType, diffDisplayMode = 'absolute') {
  const td = document.createElement('td');
  td.classList.add('calc-derived-cell', 'calc-diff-cell');
  td.appendChild(createDiffValueNode(value, valueType, diffDisplayMode));
  td.title = getDiffMetricTitle(value, valueType, diffDisplayMode);
  return td;
}

function appendEnemyRadioCell(tr, enemyName, zoneIndex) {
  const radioTd = document.createElement('td');
  radioTd.style.padding = '4px 10px';
  radioTd.style.borderBottom = '1px solid var(--border)';
  radioTd.style.width = '30px';
  radioTd.style.textAlign = 'center';

  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = `enemy-zone-${enemyName}`;
  radio.value = zoneIndex;
  radio.id = `zone-${enemyName}-${zoneIndex}`;
  radio.checked = calculatorState.selectedZoneIndex === zoneIndex;
  radio.addEventListener('change', () => {
    setSelectedZoneIndex(zoneIndex);
    renderCalculation();
  });

  tr.style.cursor = 'pointer';
  tr.addEventListener('click', (event) => {
    if (event.target !== radio) {
      radio.checked = true;
      setSelectedZoneIndex(zoneIndex);
      renderCalculation();
    }
  });

  radioTd.appendChild(radio);
  tr.appendChild(radioTd);
}

export function renderEnemyDetails(enemy = calculatorState.selectedEnemy) {
  const container = document.getElementById('calculator-enemy-details');
  if (!container) {
    return;
  }

  container.innerHTML = '';
  if (calculatorState.mode === 'compare' && calculatorState.compareView === 'overview') {
    renderEnemyControls(null);
    renderOverviewDetails(container);
    return;
  }

  renderEnemyControls(enemy);

  if (!enemy || !enemy.zones || enemy.zones.length === 0) {
    createPlaceholder(container, 'Select an enemy to view details');
    return;
  }

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.className = 'calculator-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  const radioTh = document.createElement('th');
  radioTh.style.padding = '4px 10px';
  radioTh.style.textAlign = 'center';
  radioTh.style.borderBottom = '2px solid var(--border)';
  radioTh.style.color = 'var(--muted)';
  radioTh.style.width = '30px';
  headerRow.appendChild(radioTh);

  const columns = getEnemyColumns();
  columns.forEach((column) => {
    const th = document.createElement('th');
    th.textContent = column.label;
    th.classList.add('sortable');
    if (calculatorState.enemySort.key === column.key) {
      th.classList.add(`sort-${calculatorState.enemySort.dir}`);
    }
    th.addEventListener('click', () => {
      toggleEnemySort(column.key);
      renderEnemyDetails(enemy);
    });
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const weaponA = getWeaponForSlot('A');
  const weaponB = getWeaponForSlot('B');
  const selectedAttacksA = getSelectedAttacks('A');
  const selectedAttacksB = getSelectedAttacks('B');
  const hitCountsA = getAttackHitCounts('A', selectedAttacksA);
  const hitCountsB = getAttackHitCounts('B', selectedAttacksB);
  const enemyMainHealth = parseInt(enemy.health, 10) || 0;

  const zoneRows = enemy.zones.map((zone, zoneIndex) => ({
    zone,
    zoneIndex,
    metrics: buildZoneComparisonMetrics({
      zone,
      enemyMainHealth,
      weaponA,
      weaponB,
      selectedAttacksA,
      selectedAttacksB,
      hitCountsA,
      hitCountsB
    })
  }));

  const sortedRows = sortEnemyZoneRows(zoneRows, {
    mode: calculatorState.mode,
    sortKey: calculatorState.enemySort.key,
    sortDir: calculatorState.enemySort.dir,
    groupMode: calculatorState.enemySort.groupMode,
    diffDisplayMode: 'absolute',
    pinMain: true
  });

  const tbody = document.createElement('tbody');

  sortedRows.forEach(({ zone, zoneIndex, metrics, groupStart }) => {
    const tr = document.createElement('tr');
    if (groupStart) {
      tr.classList.add('group-start');
    }

    appendEnemyRadioCell(tr, enemy.name, zoneIndex);

    columns.forEach((column) => {
      if (column.key === 'shots') {
        tr.appendChild(buildSingleMetricCell('A', metrics.bySlot.A, 'shots'));
        return;
      }

      if (column.key === 'ttk') {
        tr.appendChild(buildSingleMetricCell('A', metrics.bySlot.A, 'ttk'));
        return;
      }

      if (column.key === 'shotsA') {
        tr.appendChild(buildSingleMetricCell('A', metrics.bySlot.A, 'shots'));
        return;
      }

      if (column.key === 'shotsB') {
        tr.appendChild(buildSingleMetricCell('B', metrics.bySlot.B, 'shots'));
        return;
      }

      if (column.key === 'shotsDiff') {
        tr.appendChild(buildDiffMetricCell(metrics.diffShots, 'shots', 'absolute'));
        return;
      }

      if (column.key === 'ttkA') {
        tr.appendChild(buildSingleMetricCell('A', metrics.bySlot.A, 'ttk'));
        return;
      }

      if (column.key === 'ttkB') {
        tr.appendChild(buildSingleMetricCell('B', metrics.bySlot.B, 'ttk'));
        return;
      }

      if (column.key === 'ttkDiff') {
        tr.appendChild(buildDiffMetricCell(metrics.diffTtkSeconds, 'ttk', 'absolute'));
        return;
      }

      const td = document.createElement('td');
      formatEnemyBaseCell(td, zone, column.key);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}
