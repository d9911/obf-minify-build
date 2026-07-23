import assert from 'node:assert/strict';
import test from 'node:test';
import { transformHtml } from '../lib/transform/html.js';

const config = { compact: true, removeComments: true };

test('HTML scanner removes ordinary comments and safe whitespace', () => {
  const result = transformHtml(
    '<!-- remove --><main>  Hello   world  </main>\n <p title="a  b"> Test </p>',
    'index.html',
    config,
  );

  assert.equal(result, '<main>Hello world</main><p title="a  b">Test</p>');
});

test('HTML scanner preserves conditional and raw text content', () => {
  const source = '<!--[if IE]>keep<![endif]--><pre>  a\n b </pre>'
    + '<textarea> x  y </textarea><script>const x = "a  b";</script>';

  assert.equal(transformHtml(source, 'index.html', config), source);
});

test('HTML scanner honors disabled compaction and comment removal', () => {
  const source = '<!-- keep --><p>  keep  </p>';
  assert.equal(
    transformHtml(source, 'index.html', { compact: false, removeComments: false }),
    source,
  );
});

test('HTML scanner rejects unterminated comments and tags', () => {
  assert.throws(
    () => transformHtml('<!-- broken', 'broken.html', config),
    /broken\.html: unterminated HTML comment/,
  );
  assert.throws(
    () => transformHtml('<p title="broken>', 'broken.html', config),
    /broken\.html: unterminated HTML tag/,
  );
});
