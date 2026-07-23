import assert from 'node:assert/strict';
import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { build } from '../lib/index.js';
import { createFixture, projectRoot } from './helpers/project.js';

test('missing source rejects with an actionable error', async () => {
  await assert.rejects(
    build({
      src: '/definitely/missing/obf-minify-build-source',
      out: '/tmp/obf-minify-build-unused',
    }),
    error => {
      assert.match(error.message, /Source directory does not exist/);
      assert.equal(error.cause?.code, 'ENOENT');
      return true;
    },
  );
});

test('invalid obfuscator config stops the build with its parsing cause', async t => {
  const { root, src, out } = await createFixture(t, {
    'app.js': 'window.answer = 42;',
  });
  await writeFile(path.join(root, 'obfuscator.json'), '{invalid json');

  await assert.rejects(
    build({ cwd: root, src, out }),
    error => {
      assert.match(error.message, /Invalid obfuscator\.json/);
      assert.ok(error.cause instanceof SyntaxError);
      return true;
    },
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

test('build minifies, hashes, and rewrites local references', async t => {
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
  assert.match(js, /function greet\(name\)/);
  assert.ok(js.length < 'function greet(name) { return `Hello ${name}`; } window.greet = greet;'.length);
});

test('conservative transforms preserve sensitive content', async t => {
  const javascript = 'const text = "a  b"; // preserved\nwindow.text = text;';
  const { src, out } = await createFixture(t, {
    'index.html': '<!-- remove --><pre>  keep\n  spacing </pre><script src="app.js"></script>',
    'app.js': javascript,
    'app.css': 'p::before { content: "a  b"; color: red; }',
  });

  const result = await build({ src, out });
  const html = await readFile(path.join(out, 'index.html'), 'utf8');
  const css = await readFile(path.join(out, result.manifest['app.css']), 'utf8');
  const js = await readFile(path.join(out, result.manifest['app.js']), 'utf8');

  assert.doesNotMatch(html, /remove/);
  assert.match(html, /<pre> {2}keep\n {2}spacing <\/pre>/);
  assert.match(css, /content:"a {2}b"/);
  assert.doesNotMatch(js, /preserved/);
  assert.doesNotMatch(js, /"a {2}b"/);
  const browser = {};
  Function('window', js)(browser);
  assert.equal(browser.text, 'a  b');
});

test('skipObfuscationFor preserves matching JavaScript names while minifying', async t => {
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
  assert.match(output, /vendorLibrary/);
  assert.match(output, /ready/);
  assert.ok(output.length < source.length);
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

test('TypeScript emits JavaScript and rewrites HTML references', async t => {
  const { src, out } = await createFixture(t, {
    'index.html': '<script src="./scripts/app.js"></script>',
    'scripts/app.ts': 'const answer: number = 42; window.answer = answer;',
  });

  const result = await build({ cwd: projectRoot, src, out });
  const html = await readFile(path.join(out, 'index.html'), 'utf8');
  const emitted = result.manifest['scripts/app.js'];

  assert.match(emitted, /^scripts\/app\.[a-f0-9]{8}\.js$/);
  assert.match(html, /\.\/scripts\/app\.[a-f0-9]{8}\.js/);
  assert.doesNotMatch(await readFile(path.join(out, emitted), 'utf8'), /: number/);
  assert.equal(result.files.js, 1);
});

test('TypeScript wins over matching JavaScript and declarations are skipped', async t => {
  const { src, out } = await createFixture(t, {
    'app.ts': 'window.selectedSource = "typescript" as string;',
    'app.js': 'window.selectedSource = "javascript";',
    'types.d.ts': 'declare const ignored: string;',
  });

  const result = await build({ cwd: projectRoot, src, out, skipObfuscation: true });
  const emitted = await readFile(path.join(out, result.manifest['app.js']), 'utf8');

  assert.match(emitted, /typescript/);
  assert.doesNotMatch(emitted, /javascript/);
  assert.equal(result.files.js, 1);
  await assert.rejects(access(path.join(out, 'types.d.ts')));
});

test('TypeScript input reports how to install a missing peer', async t => {
  const { root, src, out } = await createFixture(t, {
    'app.ts': 'const answer: number = 42;',
  });

  await assert.rejects(
    build({ cwd: root, src, out }),
    /npm install --save-dev typescript/,
  );
});

test('TypeScript diagnostics include the source path', async t => {
  const { src, out } = await createFixture(t, {
    'broken.ts': 'const value: = 1;',
  });

  await assert.rejects(
    build({ cwd: projectRoot, src, out }),
    /Could not compile TypeScript broken\.ts/,
  );
});

test('TypeScript output can be inlined as JavaScript', async t => {
  const { src, out } = await createFixture(t, {
    'index.html': '<script src="app.js"></script>',
    'app.ts': 'const answer: number = 42; window.answer = answer;',
  });

  const result = await build({ cwd: projectRoot, src, out, inlineJs: true });
  const html = await readFile(path.join(out, 'index.html'), 'utf8');

  assert.match(html, /const answer=42;/);
  assert.doesNotMatch(html, /: number/);
  assert.equal(result.warnings.length, 0);
});

test('JavaScript fallback is emitted unchanged and reported as a warning', async t => {
  const source = 'eval("globalThis.answer = 42")';
  const { src, out } = await createFixture(t, { 'unsafe.js': source });

  const result = await build({ src, out });
  const output = await readFile(path.join(out, result.manifest['unsafe.js']), 'utf8');

  assert.equal(output, source);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /unsafe\.js: transformation skipped: eval/);
});

test('skipObfuscation disables encoding and renaming but keeps minification', async t => {
  const source = 'function greet(name) { const message = "hello"; return message + name; }';
  const { src, out } = await createFixture(t, { 'app.js': source });

  const result = await build({ src, out, skipObfuscation: true });
  const output = await readFile(path.join(out, result.manifest['app.js']), 'utf8');

  assert.match(output, /name/);
  assert.match(output, /message/);
  assert.match(output, /"hello"/);
  assert.ok(output.length < source.length);
});

test('native inline script and style use the same transform engine', async t => {
  const { src, out } = await createFixture(t, {
    'index.html': `
      <style>/* remove */ body { color: red; }</style>
      <script>const message = "hello"; window.message = message;</script>
      <script type="application/json">{ "keep": "as data" }</script>`,
  });

  await build({ src, out });
  const html = await readFile(path.join(out, 'index.html'), 'utf8');

  assert.match(html, /<style>body\{color:red\}<\/style>/);
  assert.doesNotMatch(html, /const message =/);
  assert.doesNotMatch(html, /"hello"/);
  assert.match(html, /<script type="application\/json">\{ "keep": "as data" \}<\/script>/);
});
