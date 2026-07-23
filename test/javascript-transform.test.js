import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { lexJavaScript } from '../lib/transform/javascript/lexer.js';
import { transformJavaScript } from '../lib/transform/javascript/transform.js';

const config = {
  compact: true,
  removeComments: true,
  encodeStrings: true,
  renameLocals: true,
};

async function evaluate(source) {
  const script = `${source}\nconsole.log(JSON.stringify(globalThis.result));`;
  const { stdout } = await promisify(execFile)(process.execPath, [
    '--input-type=module',
    '--eval',
    script,
  ]);
  return JSON.parse(stdout);
}

test('JavaScript lexer recognizes modern literals and operators', () => {
  const tokens = lexJavaScript(
    'class Box { #value = /a+/gi; read = () => this.#value?.source ?? `none`; }',
  );

  assert.equal(tokens.error, null);
  assert.ok(tokens.tokens.some(token => token.type === 'regex'));
  assert.ok(tokens.tokens.some(token => token.type === 'template'));
  assert.ok(tokens.tokens.some(token => token.text === '?.'));
  assert.ok(tokens.tokens.some(token => token.text === '??'));
  assert.ok(tokens.tokens.some(token => token.type === 'privateIdentifier'));
});

test('JavaScript transform minifies and preserves execution behavior', async () => {
  const source = `
    function add(value) {
      // removable
      const resultValue = value + 1;
      return resultValue;
    }
    globalThis.result = add(4);
  `;
  const transformed = transformJavaScript(source, 'app.js', config);

  assert.equal(transformed.transformed, true);
  assert.doesNotMatch(transformed.code, /removable/);
  assert.ok(transformed.code.length < source.length);
  assert.deepEqual(await evaluate(transformed.code), await evaluate(source));
});

test('JavaScript transform encodes safe strings without changing values', async () => {
  const source = 'globalThis.result = "hello world";';
  const transformed = transformJavaScript(source, 'strings.js', config);

  assert.doesNotMatch(transformed.code, /hello world/);
  assert.deepEqual(await evaluate(transformed.code), 'hello world');
});

test('JavaScript transform preserves regex, division, properties, and directives', () => {
  const source = '"use strict"; const object = { value: 8 }; '
    + 'const half = object.value / 2; globalThis.result = /a+/.test("aaa") && half;';
  const transformed = transformJavaScript(source, 'syntax.js', {
    ...config,
    renameLocals: false,
  });

  assert.match(transformed.code, /^"use strict";/);
  assert.match(transformed.code, /object\.value\/2/);
  assert.match(transformed.code, /\/a\+\/\.test/);
  assert.match(transformed.code, /value:8/);
});

test('JavaScript transform preserves ASI-sensitive line breaks', () => {
  const source = 'function value() { return\n{ answer: 42 }; }';
  const transformed = transformJavaScript(source, 'asi.js', {
    ...config,
    renameLocals: false,
  });

  assert.match(transformed.code, /return\n\{/);
});

test('JavaScript transform falls back for eval, with, and unsupported decorators', () => {
  for (const source of [
    'eval("globalThis.result = 1")',
    'with (object) { value }',
    '@sealed class Example {}',
  ]) {
    const transformed = transformJavaScript(source, 'unsafe.js', config);
    assert.equal(transformed.code, source);
    assert.equal(transformed.transformed, false);
    assert.match(transformed.warnings[0], /unsafe\.js: transformation skipped/);
  }
});

test('JavaScript renaming preserves shorthand properties and destructuring', async () => {
  const source = `
    function build(input) {
      const { value } = input;
      const localValue = value + 1;
      return { localValue };
    }
    globalThis.result = build({ value: 4 });
  `;
  const transformed = transformJavaScript(source, 'objects.js', config);

  assert.match(transformed.code, /localValue/);
  assert.deepEqual(await evaluate(transformed.code), await evaluate(source));
});

test('JavaScript transform preserves multiple directive prologues', () => {
  const source = '"use strict"; "use client"; globalThis.result = "value";';
  const transformed = transformJavaScript(source, 'directives.js', config);

  assert.match(transformed.code, /^"use strict";"use client";/);
  assert.doesNotMatch(transformed.code, /"value"/);
});

test('JavaScript can remove comments without compacting surrounding source', () => {
  const source = 'const value = 1; /* remove */\n globalThis.result = value;\n';
  const transformed = transformJavaScript(source, 'comments.js', {
    ...config,
    compact: false,
    encodeStrings: false,
    renameLocals: false,
  });

  assert.doesNotMatch(transformed.code, /remove/);
  assert.equal(transformed.code, 'const value = 1; \n globalThis.result = value;\n');
});
