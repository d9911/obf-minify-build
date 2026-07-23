import assert from 'node:assert/strict';
import test from 'node:test';
import { runCli } from './helpers/project.js';

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
