import test from 'node:test';
import assert from 'node:assert/strict';

import { getEnemyDropdownQueryState } from '../calculator/selector-utils.js';

test('enemy dropdown keeps real enemies visible when overview is the current compare selection', () => {
  const state = getEnemyDropdownQueryState('Overview', {
    mode: 'compare',
    compareView: 'overview'
  });

  assert.equal(state.effectiveQuery, '');
  assert.equal(state.showOverviewOption, true);
});

test('enemy dropdown still filters normally for typed overview searches outside the selected overview label', () => {
  const state = getEnemyDropdownQueryState('over', {
    mode: 'compare',
    compareView: 'focused'
  });

  assert.equal(state.effectiveQuery, 'over');
  assert.equal(state.showOverviewOption, true);
});

test('enemy dropdown does not offer overview in single mode', () => {
  const state = getEnemyDropdownQueryState('', {
    mode: 'single',
    compareView: 'focused'
  });

  assert.equal(state.effectiveQuery, '');
  assert.equal(state.showOverviewOption, false);
});
