import assert from 'node:assert/strict';
import test from 'node:test';
import { transformCss } from '../lib/transform/css.js';

const config = { compact: true, removeComments: true };

test('CSS scanner removes safe whitespace and ordinary comments', () => {
  assert.equal(
    transformCss('/* remove */ body { color: red; margin: 0  1px; }', 'app.css', config),
    'body{color:red;margin:0 1px}',
  );
});

test('CSS scanner preserves license comments, strings, URLs, and calc spacing', () => {
  const source = '/*! license */ .x { content: "a  b"; '
    + 'background: url("a b.png"); width: calc(100% - 1px); }';
  const result = transformCss(source, 'app.css', config);

  assert.match(result, /^\/\*! license \*\//);
  assert.match(result, /content:"a {2}b"/);
  assert.match(result, /url\("a b\.png"\)/);
  assert.match(result, /calc\(100% - 1px\)/);
});

test('CSS scanner keeps source when compaction is disabled', () => {
  const source = '/* keep */ a { color: red; }';
  assert.equal(
    transformCss(source, 'app.css', { compact: false, removeComments: false }),
    source,
  );
});

test('CSS scanner rejects unterminated comments and strings', () => {
  assert.throws(
    () => transformCss('a{/* broken', 'broken.css', config),
    /broken\.css: unterminated CSS comment/,
  );
  assert.throws(
    () => transformCss('a{content:"broken}', 'broken.css', config),
    /broken\.css: unterminated CSS string/,
  );
});
