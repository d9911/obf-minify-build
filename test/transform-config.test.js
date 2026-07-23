import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { loadTransformConfig } from '../lib/transform/config.js';
import { createFixture } from './helpers/project.js';

const defaults = {
  compact: true,
  removeComments: true,
  encodeStrings: true,
  renameLocals: true,
};

test('transform config uses safe defaults when the file is absent', async t => {
  const { root } = await createFixture(t);
  assert.deepEqual(await loadTransformConfig(root), defaults);
});

test('transform config accepts supported boolean overrides', async t => {
  const { root } = await createFixture(t);
  await writeFile(
    path.join(root, 'obfuscator.json'),
    JSON.stringify({ compact: false, encodeStrings: false }),
  );

  assert.deepEqual(await loadTransformConfig(root), {
    ...defaults,
    compact: false,
    encodeStrings: false,
  });
});

test('transform config rejects unknown and non-boolean values', async t => {
  const { root } = await createFixture(t);
  const configPath = path.join(root, 'obfuscator.json');

  await writeFile(configPath, JSON.stringify({ selfDefending: true }));
  await assert.rejects(loadTransformConfig(root), /Unsupported obfuscator option: selfDefending/);

  await writeFile(configPath, JSON.stringify({ compact: 'yes' }));
  await assert.rejects(loadTransformConfig(root), /compact must be a boolean/);
});

test('transform config preserves invalid JSON as the error cause', async t => {
  const { root } = await createFixture(t);
  await writeFile(path.join(root, 'obfuscator.json'), '{invalid');

  await assert.rejects(
    loadTransformConfig(root),
    error => {
      assert.match(error.message, /Invalid obfuscator\.json/);
      assert.ok(error.cause instanceof SyntaxError);
      return true;
    },
  );
});
