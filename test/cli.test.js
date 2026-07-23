import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createFixture, runCli } from './helpers/project.js';

test('help exits successfully without reading a source directory', () => {
  const result = runCli(['--help'], { cwd: '/tmp' });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: (?:npx )?obf-minify-build/);
  assert.equal(result.stderr, '');
});

test('missing source exits with an actionable error', () => {
  const result = runCli([
    '--src',
    '/definitely/missing/obf-minify-build-source',
    '--out',
    '/tmp/obf-minify-build-unused',
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source directory does not exist/);
});

test('version prints the package version', () => {
  const result = runCli(['--version'], { cwd: '/tmp' });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /^0\.0\.4-rc\.4\s*$/);
  assert.equal(result.stderr, '');
});

test('unknown options fail before starting a build', () => {
  const result = runCli(['--unknown']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown option: --unknown/);
});

test('options that require values report a concise error', () => {
  const result = runCli(['--src']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--src requires a value/);
});

test('CLI awaits a successful build with paths containing spaces', async t => {
  const { src, out } = await createFixture(t, {
    'index.html': '<h1> CLI works </h1>',
  });

  const result = runCli(['--src', src, '--out', out]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Build complete/);
  assert.equal(await readFile(path.join(out, 'index.html'), 'utf8'), '<h1>CLI works</h1>');
});

test('--no-make remains accepted as a deprecated no-op', async t => {
  const { src, out } = await createFixture(t, {
    'index.html': '<p>compatibility</p>',
  });

  const result = runCli(['--no-make', '--src', src, '--out', out]);

  assert.equal(result.status, 0);
  assert.match(result.stderr, /--no-make is deprecated/);
});

test('TypeScript CLI error explains how to install the optional peer', async t => {
  const { root, src, out } = await createFixture(t, {
    'app.ts': 'const answer: number = 42;',
  });

  const result = runCli(['--src', src, '--out', out], { cwd: root });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /npm install --save-dev typescript/);
});
