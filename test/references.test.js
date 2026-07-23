import assert from 'node:assert/strict';
import test from 'node:test';
import {
  rewriteCssReferences,
  rewriteJavaScriptReferences,
} from '../lib/build/references.js';

const manifest = {
  'js/store.js': 'js/store.11111111.js',
  'js/feature.js': 'js/feature.22222222.js',
  'css/theme.css': 'css/theme.33333333.css',
  'assets/grid.svg': 'assets/grid.44444444.svg',
};

test('rewrites quoted ES module specifiers and preserves suffixes', () => {
  const warnings = [];
  const source = [
    "import { state } from './store.js?mode=test#ready';",
    "export { reset } from './store.js';",
    "import './store.js';",
    "const feature = import('./feature.js');",
  ].join('\n');

  const output = rewriteJavaScriptReferences(
    source,
    'js/app.js',
    manifest,
    warnings,
  );

  assert.match(output, /from '.\/store\.11111111\.js\?mode=test#ready'/);
  assert.match(output, /from '.\/store\.11111111\.js'/);
  assert.match(output, /import '.\/store\.11111111\.js'/);
  assert.match(output, /import\('\.\/feature\.22222222\.js'\)/);
  assert.deepEqual(warnings, []);
});

test('preserves root-relative, remote, data, node, and fragment references', () => {
  const warnings = [];
  const source = [
    "import root from '/js/store.js#root';",
    "import remote from 'https://example.test/value.js';",
    "import protocol from '//example.test/value.js';",
    "import data from 'data:text/javascript,export default 1';",
    "import fs from 'node:fs';",
    "import fragment from '#internal';",
  ].join('\n');

  const output = rewriteJavaScriptReferences(
    source,
    'js/app.js',
    manifest,
    warnings,
  );

  assert.match(output, /from '\/js\/store\.11111111\.js#root'/);
  assert.match(output, /https:\/\/example\.test\/value\.js/);
  assert.match(output, /\/\/example\.test\/value\.js/);
  assert.match(output, /data:text\/javascript/);
  assert.match(output, /node:fs/);
  assert.match(output, /#internal/);
  assert.deepEqual(warnings, []);
});

test('leaves computed dynamic imports unchanged with an actionable warning', () => {
  const warnings = [];
  const source = [
    'const target = "./feature.js";',
    'const feature = import(target);',
  ].join('\n');

  const output = rewriteJavaScriptReferences(
    source,
    'js/app.js',
    manifest,
    warnings,
  );

  assert.equal(output, source);
  assert.deepEqual(warnings, [
    'Cannot rewrite computed dynamic import in js/app.js',
  ]);
});

test('rewrites CSS url and quoted imports without touching remote data', () => {
  const source = [
    '@import "./theme.css";',
    '.card { background: url("../assets/grid.svg#tile"); }',
    '.icon { mask: url(data:image/svg+xml;base64,AAAA); }',
    '.remote { background: url("https://example.test/a.png"); }',
  ].join('\n');

  const output = rewriteCssReferences(source, 'css/app.css', manifest);

  assert.match(output, /@import "\.\/theme\.33333333\.css"/);
  assert.match(output, /url\("\.\.\/assets\/grid\.44444444\.svg#tile"\)/);
  assert.match(output, /url\(data:image\/svg\+xml;base64,AAAA\)/);
  assert.match(output, /https:\/\/example\.test\/a\.png/);
});

test('does not rewrite CSS-like text inside comments or ordinary strings', () => {
  const source = [
    '/* url("../assets/grid.svg") */',
    '.plain::before { content: "url(../assets/grid.svg)"; }',
  ].join('\n');

  assert.equal(rewriteCssReferences(source, 'css/app.css', manifest), source);
});
