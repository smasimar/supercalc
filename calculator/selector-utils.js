export function getEnemyDropdownQueryState(query, {
  mode = 'single',
  compareView = 'focused'
} = {}) {
  const normalizedQuery = String(query ?? '').trim().toLowerCase();
  const overviewActive = mode === 'compare' && compareView === 'overview';

  return {
    normalizedQuery,
    effectiveQuery: overviewActive && normalizedQuery === 'overview'
      ? ''
      : normalizedQuery,
    showOverviewOption: mode === 'compare' && 'overview'.includes(normalizedQuery)
  };
}
