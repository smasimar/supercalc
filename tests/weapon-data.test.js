import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = {
  getItem() { return null; },
  setItem() {}
};

const { ingestMatrix, inferPatchVersion, state } = await import('../weapons/data.js');

test('ingestMatrix strips a UTF-8 BOM from the first header cell', () => {
  ingestMatrix([
    ['\uFEFFType', 'Name', 'RPM', 'Atk Type', 'DMG', 'DUR', 'AP'],
    ['Primary', 'Liberator', '920', 'projectile', '90', '22', '2']
  ]);

  assert.equal(state.keys.typeKey, 'Type');
  assert.equal(state.keys.nameKey, 'Name');
  assert.equal(state.keys.rpmKey, 'RPM');
});

test('ingestMatrix keeps grouped weapon code and rpm metadata', () => {
  ingestMatrix([
    ['Type', 'Sub', 'Code', 'Name', 'RPM', 'Atk Type', 'DMG', 'DUR', 'AP'],
    ['Primary', 'AR', 'AR-23A', 'Liberator Carbine', '920', 'projectile', '90', '22', '2']
  ]);

  assert.equal(state.groups.length, 1);
  assert.equal(state.groups[0].code, 'AR-23A');
  assert.equal(state.groups[0].rpm, 920);
});

test('inferPatchVersion extracts a version token from a local filename', () => {
  assert.equal(
    inferPatchVersion(null, './weapons/Helldivers 2 Weapon Data - 1.006.003.csv'),
    '1.006.003'
  );
  assert.equal(inferPatchVersion(null, './weapons/weapondata.csv'), null);
});

test('inferPatchVersion still supports content-disposition filenames', () => {
  assert.equal(
    inferPatchVersion(
      'attachment; filename=\"Helldivers 2 Weapon Data - 1.006.003.csv\"',
      './weapons/weapondata.csv'
    ),
    '1.006.003'
  );
});
