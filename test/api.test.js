import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { build } from '../lib/index.js';
import { createFixture } from './helpers/project.js';

test('missing source rejects with an actionable error', async () => {
  await assert.rejects(
    build({
      src: '/definitely/missing/obf-minify-build-source',
      out: '/tmp/obf-minify-build-unused',
    }),
    /Source directory does not exist/,
  );
});

test('build returns an asynchronous structured result', async t => {
  const { src, out } = await createFixture(t, {
    'index.html': '<!doctype html><html><body>Hello</body></html>',
  });

  const pending = build({ src, out });

  assert.equal(typeof pending?.then, 'function');

  const result = await pending;
  assert.equal(result.sourceDir, src);
  assert.equal(result.outputDir, out);
  assert.equal(result.files.html, 1);
  assert.deepEqual(result.manifest, {});
});

test('build minifies, obfuscates, hashes, and rewrites local references', async t => {
  const { src, out } = await createFixture(t, {
    'pages/index.html': `<!doctype html>
      <html>
        <head><link rel="stylesheet" href="../styles/app.css"></head>
        <body>
          <img src="../assets/logo.svg">
          <script src="../scripts/app.js"></script>
        </body>
      </html>`,
    'styles/app.css': 'body { color: red; margin: 0 0 0 0; }',
    'scripts/app.js': 'function greet(name) { return `Hello ${name}`; } window.greet = greet;',
    'assets/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    'notes/read me.txt': 'keep me',
  });

  const result = await build({ src, out });
  const html = await readFile(path.join(out, 'pages', 'index.html'), 'utf8');

  assert.doesNotMatch(html, /\n\s+/);
  assert.match(html, /\.\.\/styles\/app\.[a-f0-9]{8}\.css/);
  assert.match(html, /\.\.\/scripts\/app\.[a-f0-9]{8}\.js/);
  assert.match(html, /\.\.\/assets\/logo\.[a-f0-9]{8}\.svg/);
  assert.equal(await readFile(path.join(out, 'notes', 'read me.txt'), 'utf8'), 'keep me');
  assert.equal(result.files.html, 1);
  assert.equal(result.files.css, 1);
  assert.equal(result.files.js, 1);
  assert.equal(result.files.assets, 1);
  assert.equal(Object.keys(result.manifest).length, 3);

  const jsRelativePath = result.manifest['scripts/app.js'];
  const js = await readFile(path.join(out, jsRelativePath), 'utf8');
  assert.notEqual(js, 'function greet(name) { return `Hello ${name}`; } window.greet = greet;');
});

test('skipObfuscationFor preserves matching JavaScript', async t => {
  const source = 'window.vendorLibrary = { ready: true };';
  const { src, out } = await createFixture(t, {
    'index.html': '<script src="vendor.js"></script>',
    'vendor.js': source,
  });

  const result = await build({
    src,
    out,
    skipObfuscationFor: ['vendor.js'],
  });

  const output = await readFile(
    path.join(out, result.manifest['vendor.js']),
    'utf8',
  );
  assert.equal(output, source);
});

test('build refuses overlapping source and output paths', async t => {
  const { src } = await createFixture(t, {});

  await assert.rejects(build({ src, out: src }), /must be different/);
  await assert.rejects(
    build({ src, out: path.dirname(src) }),
    /must not contain the source directory/,
  );
  await assert.rejects(
    build({ src, out: path.join(src, 'output') }),
    /must not be inside the source directory/,
  );
});

test('generateIndex creates a basic English page when no HTML exists', async t => {
  const { src, out } = await createFixture(t, {
    'styles/app.css': 'body { color: navy; }',
  });

  const result = await build({ src, out, generateIndex: true });
  const html = await readFile(path.join(out, 'index.html'), 'utf8');

  assert.match(html, /Built with obf-minify-build/);
  assert.equal(result.files.html, 1);
});

test('inlineAll embeds local CSS and JavaScript but leaves remote URLs alone', async t => {
  const { src, out } = await createFixture(t, {
    'nested/index.html': `
      <link rel="stylesheet" href="../styles/app.css">
      <link rel="stylesheet" href="https://example.com/remote.css">
      <script src="../scripts/app.js"></script>
      <script src="//example.com/remote.js"></script>`,
    'styles/app.css': 'body { color: green; }',
    'scripts/app.js': 'window.answer = 42;',
  });

  const result = await build({ src, out, inlineAll: true });
  const html = await readFile(path.join(out, 'nested', 'index.html'), 'utf8');

  assert.match(html, /<style>body\{color:green\}<\/style>/);
  assert.match(html, /<script>.+<\/script>/);
  assert.match(html, /https:\/\/example\.com\/remote\.css/);
  assert.match(html, /\/\/example\.com\/remote\.js/);
  assert.equal(result.warnings.length, 0);
});

test('inline mode reports missing local references', async t => {
  const { src, out } = await createFixture(t, {
    'index.html': '<link rel="stylesheet" href="missing.css">',
  });

  const result = await build({ src, out, inlineCss: true });

  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /missing\.css/);
  await access(path.join(out, 'index.html'));
});

test('root-relative references resolve from source root and preserve suffixes', async t => {
  const { src, out } = await createFixture(t, {
    'pages/index.html': `
      <link rel="stylesheet" href="/styles/app.css?theme=dark#main">
      <script src="/scripts/app.js"></script>`,
    'styles/app.css': 'body { color: black; }',
    'scripts/app.js': 'window.rootReference = true;',
  });

  const result = await build({ src, out });
  const html = await readFile(path.join(out, 'pages', 'index.html'), 'utf8');

  assert.match(html, /\/styles\/app\.[a-f0-9]{8}\.css\?theme=dark#main/);
  assert.match(html, /\/scripts\/app\.[a-f0-9]{8}\.js/);
  assert.equal(result.warnings.length, 0);
});
