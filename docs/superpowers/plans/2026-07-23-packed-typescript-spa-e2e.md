# Packed Vanilla TypeScript SPA E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove in a real browser that the packed npm artifact builds and runs a realistic Vanilla TypeScript SPA, including hashed ES-module and CSS asset references.

**Architecture:** Extend the existing two-phase hash pipeline with file-type-specific, token-aware reference rewriting, then test it through a checked-in consumer fixture installed from `npm pack`. A Node test helper owns packing, isolated npm installation, the loopback static server, browser lifecycle, diagnostics, and cleanup.

**Tech Stack:** Node.js ESM and `node:test`, the package's native JavaScript lexer, npm tarballs, optional TypeScript peer dependency, Playwright as a development-only browser tool, HTML/CSS/TypeScript fixture code.

## Global Constraints

- The published package keeps zero runtime dependencies.
- `typescript` remains an optional peer dependency with range `>=5.0.0`.
- JavaScript-only builds must work without TypeScript.
- Supported runtime remains Node.js `>=18`.
- JavaScript rewriting is limited to quoted static import/export specifiers, side-effect imports, and quoted dynamic `import()`.
- CSS rewriting is limited to local `url()` and quoted `@import` references.
- Query strings and fragments are preserved; remote, protocol-relative, `data:`, `node:`, and fragment-only references are unchanged.
- Computed dynamic imports remain unchanged and emit an actionable warning.
- Child processes use argument arrays with `shell: false`.
- No push, tag, npm publication, pull request, framework, bundler, or runtime dependency is added.

---

### Task 1: Rewrite hashed JavaScript and CSS references safely

**Files:**
- Modify: `lib/build/references.js`
- Modify: `lib/index.js`
- Create: `test/references.test.js`

**Interfaces:**
- Consumes: `lexJavaScript(source)` from `lib/transform/javascript/lexer.js` and the manifest returned by `hashOutputFiles(outputDir, relativePaths)`.
- Produces: `rewriteOutputReferences(outputDir, emittedPaths, manifest, warnings): Promise<void>`.
- Produces internally focused helpers `rewriteJavaScriptReferences(source, ownerPath, manifest, warnings)` and `rewriteCssReferences(source, ownerPath, manifest)`.

- [ ] **Step 1: Write failing JavaScript reference tests**

Create `test/references.test.js` with table-driven assertions covering static
imports, re-exports, side-effect imports, dynamic imports, suffix preservation,
root-relative paths, remote paths, and computed dynamic imports:

```js
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

test('leaves remote and computed imports unchanged with one warning', () => {
  const warnings = [];
  const source = [
    "import value from 'https://example.test/value.js';",
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
```

- [ ] **Step 2: Run the JavaScript tests and confirm the missing exports**

Run:

```bash
node --test test/references.test.js
```

Expected: FAIL because `rewriteCssReferences` and
`rewriteJavaScriptReferences` are not exported.

- [ ] **Step 3: Implement path resolution and token-aware JS rewriting**

In `lib/build/references.js`, import `lexJavaScript`, reuse
`splitReference()`, and add:

```js
function resolveManifestReference(ownerPath, reference, manifest) {
  if (isRemoteReference(reference) || reference.startsWith('node:')) return null;
  const { pathname, suffix } = splitReference(reference);
  const decoded = decodeURIComponent(pathname);
  const rootRelative = decoded.startsWith('/');
  const target = toPosix(path.normalize(
    rootRelative
      ? decoded.slice(1)
      : path.join(path.dirname(ownerPath), decoded),
  ));
  const hashedTarget = manifest[target];
  if (!hashedTarget) return null;

  let rewritten = rootRelative
    ? `/${hashedTarget}`
    : toPosix(path.relative(path.dirname(ownerPath), hashedTarget));
  if (!rootRelative && !rewritten.startsWith('.')) rewritten = `./${rewritten}`;
  return `${rewritten}${suffix}`;
}

function quoteValue(token, value) {
  const quote = token.text[0];
  const escaped = value
    .replaceAll('\\', '\\\\')
    .replaceAll(quote, `\\${quote}`);
  return `${quote}${escaped}${quote}`;
}

export function rewriteJavaScriptReferences(source, ownerPath, manifest, warnings) {
  const { tokens, error } = lexJavaScript(source);
  if (error) return source;
  const replacements = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== 'keyword' || (token.text !== 'import' && token.text !== 'export')) {
      continue;
    }

    const next = tokens[index + 1];
    if (token.text === 'import' && next?.text === '(') {
      const argument = tokens[index + 2];
      if (argument?.type !== 'string') {
        warnings.push(`Cannot rewrite computed dynamic import in ${ownerPath}`);
        continue;
      }
      const value = argument.text.slice(1, -1);
      const rewritten = resolveManifestReference(ownerPath, value, manifest);
      if (rewritten) replacements.push([argument.start, argument.end, quoteValue(argument, rewritten)]);
      continue;
    }

    const boundary = tokens.findIndex(
      (candidate, candidateIndex) => candidateIndex > index
        && (candidate.text === ';' || candidate.lineBreakBefore),
    );
    const end = boundary === -1 ? tokens.length : boundary;
    const specifier = tokens
      .slice(index + 1, end)
      .findLast(candidate => candidate.type === 'string');
    if (!specifier) continue;
    const value = specifier.text.slice(1, -1);
    const rewritten = resolveManifestReference(ownerPath, value, manifest);
    if (rewritten) replacements.push([specifier.start, specifier.end, quoteValue(specifier, rewritten)]);
  }

  return replacements
    .sort((left, right) => right[0] - left[0])
    .reduce(
      (output, [start, end, value]) => `${output.slice(0, start)}${value}${output.slice(end)}`,
      source,
    );
}
```

Escaped module specifiers are intentionally not decoded: because they cannot
match a normalized manifest key directly, they remain unchanged. This avoids
`eval` and keeps the supported surface limited to ordinary quoted paths.

- [ ] **Step 4: Run the JS reference tests**

Run:

```bash
node --test test/references.test.js
```

Expected: JavaScript cases PASS; CSS export still has no behavioral coverage.

- [ ] **Step 5: Add failing CSS reference tests**

Append:

```js
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

test('does not rewrite CSS-like text inside comments', () => {
  const source = '/* url("../assets/grid.svg") */ .plain { color: black; }';
  assert.equal(rewriteCssReferences(source, 'css/app.css', manifest), source);
});
```

- [ ] **Step 6: Run the CSS test and verify it fails**

Run:

```bash
node --test test/references.test.js
```

Expected: FAIL because CSS references are not yet rewritten.

- [ ] **Step 7: Implement a small CSS scanner and output dispatcher**

Implement `rewriteCssReferences()` as a single left-to-right character
scanner. At each offset it performs exactly one of these transitions:

1. On `/*`, copy through the next `*/` without inspection.
2. On `'` or `"`, copy through the matching unescaped quote.
3. On case-insensitive `url(`, read optional whitespace, an optional quote,
   the value, its matching optional quote, optional whitespace, and `)`.
4. On case-insensitive `@import` followed by whitespace and a quote, read the
   quoted value.
5. Otherwise copy one character.

For transitions 3 and 4, call
`resolveManifestReference(ownerPath, value, manifest)`. Write the resolved
value when non-null and the original value otherwise. If a comment, quoted
string, or function is unterminated, copy the remainder unchanged. This
defines the full scanner behavior; it must not parse or modify any other CSS
construct.

Add the dispatcher:

```js
export async function rewriteOutputReferences(
  outputDir,
  emittedPaths,
  manifest,
  warnings,
) {
  for (const relativePath of emittedPaths) {
    const extension = path.extname(relativePath).toLowerCase();
    if (!['.html', '.css', '.js'].includes(extension)) continue;

    const outputPath = manifest[relativePath] ?? relativePath;
    const absolutePath = path.join(outputDir, outputPath);
    const source = await readFile(absolutePath, 'utf8');
    const rewritten = extension === '.html'
      ? rewriteHtmlSource(source, relativePath, manifest)
      : extension === '.css'
        ? rewriteCssReferences(source, relativePath, manifest)
        : rewriteJavaScriptReferences(source, relativePath, manifest, warnings);
    await writeFile(absolutePath, rewritten);
  }
}
```

Refactor the current HTML replacement into
`rewriteHtmlSource(source, ownerPath, manifest)`. Keep
`rewriteHtmlReferences()` as a compatibility wrapper if an existing test or
consumer-facing export relies on it.

- [ ] **Step 8: Connect the build pipeline**

Replace in `lib/index.js`:

```js
await rewriteHtmlReferences(resolved.outputDir, htmlPaths, manifest);
```

with:

```js
await rewriteOutputReferences(
  resolved.outputDir,
  emittedPaths,
  manifest,
  warnings,
);
```

Update the import accordingly.

- [ ] **Step 9: Run focused and regression tests**

Run:

```bash
node --test test/references.test.js test/api.test.js test/cli.test.js
npm run lint
```

Expected: all tests PASS and lint exits `0`.

- [ ] **Step 10: Commit the reference pipeline**

```bash
git add lib/build/references.js lib/index.js test/references.test.js
git commit -m "feat: rewrite hashed module and CSS references"
```

---

### Task 2: Add the realistic Vanilla TypeScript SPA fixture

**Files:**
- Create: `test/fixtures/real-world-app/package.json`
- Create: `test/fixtures/real-world-app/obfuscator.json`
- Create: `test/fixtures/real-world-app/src/index.html`
- Create: `test/fixtures/real-world-app/src/css/app.css`
- Create: `test/fixtures/real-world-app/src/css/theme.css`
- Create: `test/fixtures/real-world-app/src/ts/app.ts`
- Create: `test/fixtures/real-world-app/src/ts/store.ts`
- Create: `test/fixtures/real-world-app/src/ts/feature.ts`
- Create: `test/fixtures/real-world-app/src/data/tasks.json`
- Create: `test/fixtures/real-world-app/src/assets/grid.svg`
- Create: `test/fixtures/real-world-app/src/assets/logo.svg`

**Interfaces:**
- Consumes: CLI options `--src src --out dist` from the installed tarball and consumer-provided TypeScript.
- Produces: stable browser selectors `[data-testid="count"]`, `[data-testid="increment"]`, `[data-testid="name"]`, `[data-testid="save"]`, `[data-testid="saved-name"]`, `[data-testid="tasks"]`, `[data-testid="feature"]`, and `[data-testid="logo"]`.

- [ ] **Step 1: Add fixture metadata and safe transform configuration**

Create `package.json`:

```json
{
  "name": "obf-minify-build-real-world-consumer",
  "private": true,
  "type": "module"
}
```

Create `obfuscator.json`:

```json
{
  "compact": true,
  "removeComments": true,
  "encodeStrings": false,
  "renameLocals": false
}
```

- [ ] **Step 2: Add the HTML entry**

Create an accessible page whose local references include:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Packed TypeScript SPA</title>
    <link rel="stylesheet" href="./css/app.css">
  </head>
  <body>
    <main class="app">
      <img data-testid="logo" src="./assets/logo.svg" alt="Test application">
      <output data-testid="count">0</output>
      <button data-testid="increment" type="button">Increment</button>
      <form data-testid="profile-form">
        <label>Name <input data-testid="name" required></label>
        <button data-testid="save" type="submit">Save</button>
      </form>
      <p data-testid="saved-name"></p>
      <ul data-testid="tasks"></ul>
      <p data-testid="feature">Feature pending</p>
    </main>
    <script type="module" src="./ts/app.js"></script>
  </body>
</html>
```

- [ ] **Step 3: Add modules that exercise browser behavior**

Create `store.ts` with typed localStorage state:

```ts
export interface AppState {
  count: number;
  name: string;
}

const key = 'obf-minify-build-e2e';

export function loadState(): AppState {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) as AppState : { count: 0, name: '' };
}

export function saveState(state: AppState): void {
  localStorage.setItem(key, JSON.stringify(state));
}
```

Create `feature.ts`:

```ts
export function activateFeature(target: HTMLElement): void {
  target.textContent = 'Dynamic feature loaded';
  target.dataset.loaded = 'true';
}
```

Create `app.ts` with `.js` specifiers, because those are the emitted browser
paths:

```ts
import { loadState, saveState, type AppState } from './store.js';

const count = document.querySelector<HTMLOutputElement>('[data-testid="count"]')!;
const increment = document.querySelector<HTMLButtonElement>('[data-testid="increment"]')!;
const form = document.querySelector<HTMLFormElement>('[data-testid="profile-form"]')!;
const name = document.querySelector<HTMLInputElement>('[data-testid="name"]')!;
const savedName = document.querySelector<HTMLElement>('[data-testid="saved-name"]')!;
const tasks = document.querySelector<HTMLUListElement>('[data-testid="tasks"]')!;
const feature = document.querySelector<HTMLElement>('[data-testid="feature"]')!;
const state: AppState = loadState();

function render(): void {
  count.value = String(state.count);
  count.textContent = String(state.count);
  savedName.textContent = state.name;
}

increment.addEventListener('click', () => {
  state.count += 1;
  saveState(state);
  render();
});

form.addEventListener('submit', event => {
  event.preventDefault();
  state.name = name.value.trim();
  saveState(state);
  render();
});

const response = await fetch('./data/tasks.json');
if (!response.ok) throw new Error(`Tasks request failed: ${response.status}`);
const values = await response.json() as Array<{ title: string }>;
for (const value of values) {
  const item = document.createElement('li');
  item.textContent = value.title;
  tasks.append(item);
}

const { activateFeature } = await import('./feature.js');
activateFeature(feature);
render();
```

- [ ] **Step 4: Add CSS import and asset URL**

Create `app.css`:

```css
@import "./theme.css";

.app {
  min-height: 100vh;
  background-image: url("../assets/grid.svg#grid");
}
```

Create `theme.css` with a deterministic browser assertion:

```css
:root {
  --accent: rgb(31, 95, 191);
}

[data-testid="increment"] {
  color: var(--accent);
}
```

- [ ] **Step 5: Add JSON and deterministic SVG assets**

Create `tasks.json`:

```json
[
  { "title": "Install packed package" },
  { "title": "Build TypeScript SPA" }
]
```

Create small valid `grid.svg` and `logo.svg` files with explicit `width`,
`height`, `viewBox`, and shapes. `grid.svg` must define `id="grid"` so the CSS
fragment remains meaningful.

- [ ] **Step 6: Verify the fixture contains every intended edge**

Run:

```bash
rg -n "from './store\\.js'|import\\('./feature\\.js'\\)|@import|url\\(|fetch\\(|localStorage|data-testid" test/fixtures/real-world-app
```

Expected: matches for static import, dynamic import, CSS import, CSS URL,
fetch, localStorage, and all stable selectors.

- [ ] **Step 7: Commit the fixture**

```bash
git add test/fixtures/real-world-app
git commit -m "test: add realistic TypeScript SPA fixture"
```

---

### Task 3: Install the tarball and exercise the SPA in a real browser

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `test/helpers/packed-consumer.js`
- Create: `test/helpers/static-server.js`
- Create: `test/e2e.test.js`

**Interfaces:**
- Produces: `createPackedConsumer(t, fixturePath, { installTypeScript }): Promise<{ root, cli, env, tarball }>` in `test/helpers/packed-consumer.js`.
- Produces: `serveDirectory(t, root): Promise<{ origin }>` in `test/helpers/static-server.js`.
- Consumes: Playwright's `chromium.launch()` only in the E2E test.

- [ ] **Step 1: Add the E2E command and Playwright dev dependency**

Use npm so the lockfile records the exact resolved version:

```bash
npm install --save-dev playwright
```

Add scripts:

```json
{
  "test": "node --test test/*.test.js",
  "test:e2e": "node --test test/e2e.test.js"
}
```

Do not add Playwright to `dependencies`, `peerDependencies`, or the package
`files` list.

- [ ] **Step 2: Write the failing packed-consumer helper test through E2E setup**

Create `test/e2e.test.js` with imports and the first assertion:

```js
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';
import { createPackedConsumer } from './helpers/packed-consumer.js';
import { projectRoot } from './helpers/project.js';
import { serveDirectory } from './helpers/static-server.js';

test('packed package builds and runs a real TypeScript SPA', { timeout: 120_000 }, async t => {
  const fixture = path.join(projectRoot, 'test', 'fixtures', 'real-world-app');
  const consumer = await createPackedConsumer(t, fixture, {
    installTypeScript: true,
  });

  assert.match(consumer.tarball, /obf-minify-build-0\.0\.4-rc\.4\.tgz$/);
});
```

- [ ] **Step 3: Run the E2E test and verify the helper is missing**

Run:

```bash
npm run test:e2e
```

Expected: FAIL with module-not-found for `test/helpers/packed-consumer.js`.

- [ ] **Step 4: Implement isolated packing and installation**

Create `test/helpers/packed-consumer.js`. Use `mkdtemp`, `cp`, `mkdir`, and
`rm` from `node:fs/promises`; use `spawn` or `spawnSync` with `shell: false`.
The helper executes this exact sequence:

```js
export async function createPackedConsumer(
  t,
  fixturePath,
  { installTypeScript },
) {
  const root = await mkdtemp(path.join(tmpdir(), 'obf-packed-consumer-'));
  const packDirectory = path.join(root, 'pack');
  const consumer = path.join(root, 'consumer');
  await mkdir(packDirectory, { recursive: true });
  await cp(fixturePath, consumer, { recursive: true });
  t.after(() => rm(root, { recursive: true, force: true }));

  const env = {
    ...process.env,
    PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ''}`,
    npm_config_cache: path.join(root, 'npm-cache'),
  };
  const npm = path.join(
    path.dirname(process.execPath),
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
  );
  const packResult = runConsumer(
    npm,
    ['pack', '--json', '--pack-destination', packDirectory],
    { cwd: projectRoot, env },
  );
  const [packed] = JSON.parse(packResult.stdout);
  const tarball = path.join(packDirectory, packed.filename);
  runConsumer(
    npm,
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--omit=optional',
      tarball,
    ],
    { cwd: consumer, env },
  );

  if (installTypeScript) {
    const metadata = JSON.parse(
      await readFile(path.join(projectRoot, 'package.json'), 'utf8'),
    );
    runConsumer(
      npm,
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--save-dev',
        `typescript@${metadata.devDependencies.typescript}`,
      ],
      { cwd: consumer, env },
    );
  }

  const executable = process.platform === 'win32'
    ? 'obf-minify-build.cmd'
    : 'obf-minify-build';
  return {
    root: consumer,
    cli: path.join(consumer, 'node_modules', '.bin', executable),
    env,
    tarball,
    packedFiles: packed.files.map(file => file.path),
  };
}
```

Read the exact TypeScript specifier from the repository `package.json`; do not
hard-code a second version. Keep npm cache inside the temporary root. On a
non-zero child exit, throw an error containing command, exit code, stdout, and
stderr.

- [ ] **Step 5: Re-run E2E setup**

Run:

```bash
npm run test:e2e
```

Expected: the tarball assertion passes, then the test exits successfully
because browser steps have not been added yet.

- [ ] **Step 6: Implement the zero-dependency static server**

Create `test/helpers/static-server.js` using `node:http`. It must:

- bind `127.0.0.1` on port `0`;
- map `/` to `index.html`;
- decode URL paths and reject traversal outside the root;
- return correct MIME types for HTML, JS, CSS, JSON, SVG, and common images;
- return `404` for missing files and `400` for malformed URLs;
- register `t.after()` to close the server;
- return an origin such as `http://127.0.0.1:54321`.

Core interface:

```js
export async function serveDirectory(t, root) {
  const server = createServer(async (request, response) => {
    // Resolve and serve one safe path.
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const { port } = server.address();
  return { origin: `http://127.0.0.1:${port}` };
}
```

- [ ] **Step 7: Extend E2E with build and browser assertions**

After consumer creation:

```js
const build = runConsumer(
  consumer.cli,
  ['--src', 'src', '--out', 'dist'],
  { cwd: consumer.root, env: consumer.env },
);
assert.match(build.stdout, /Build complete/);

const { origin } = await serveDirectory(t, path.join(consumer.root, 'dist'));
const browser = await chromium.launch({ headless: true });
t.after(() => browser.close());
const page = await browser.newPage();
const failures = [];

page.on('pageerror', error => failures.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') failures.push(`console: ${message.text()}`);
});
page.on('response', response => {
  if (response.url().startsWith(origin) && response.status() >= 400) {
    failures.push(`response: ${response.status()} ${response.url()}`);
  }
});

await page.goto(origin, { waitUntil: 'networkidle' });
await page.getByTestId('feature').waitFor();
assert.equal(await page.getByTestId('feature').textContent(), 'Dynamic feature loaded');
assert.deepEqual(await page.getByTestId('tasks').locator('li').allTextContents(), [
  'Install packed package',
  'Build TypeScript SPA',
]);

await page.getByTestId('increment').click();
assert.equal(await page.getByTestId('count').textContent(), '1');
await page.getByTestId('name').fill('Packed consumer');
await page.getByTestId('save').click();
assert.equal(await page.getByTestId('saved-name').textContent(), 'Packed consumer');

await page.reload({ waitUntil: 'networkidle' });
assert.equal(await page.getByTestId('count').textContent(), '1');
assert.equal(await page.getByTestId('saved-name').textContent(), 'Packed consumer');
assert.equal(
  await page.getByTestId('logo').evaluate(image => image.naturalWidth > 0),
  true,
);
assert.equal(
  await page.getByTestId('increment').evaluate(
    button => getComputedStyle(button).color,
  ),
  'rgb(31, 95, 191)',
);
assert.match(
  await page.locator('.app').evaluate(node => getComputedStyle(node).backgroundImage),
  /grid\.[a-f0-9]{8}\.svg#grid/,
);
assert.deepEqual(failures, []);
```

Expose `runConsumer()` from the packed-consumer helper rather than duplicating
child-process error handling.

- [ ] **Step 8: Assert output hashes and remove stale-reference escape routes**

Read the consumer's `dist` tree and assert:

```js
assert.ok(files.some(file => /^ts\/app\.[a-f0-9]{8}\.js$/.test(file)));
assert.ok(files.some(file => /^ts\/store\.[a-f0-9]{8}\.js$/.test(file)));
assert.ok(files.some(file => /^ts\/feature\.[a-f0-9]{8}\.js$/.test(file)));
assert.ok(files.some(file => /^css\/app\.[a-f0-9]{8}\.css$/.test(file)));
assert.ok(files.some(file => /^css\/theme\.[a-f0-9]{8}\.css$/.test(file)));
assert.ok(files.some(file => /^assets\/grid\.[a-f0-9]{8}\.svg$/.test(file)));
assert.ok(!files.includes('ts/app.js'));
assert.ok(!files.includes('css/app.css'));
assert.ok(!files.includes('assets/grid.svg'));
```

Scan emitted HTML, CSS, and JS for local unhashed references from the fixture.
The assertion message must include the owner file and unresolved reference.

- [ ] **Step 9: Run the browser E2E**

Install the browser once if the local Playwright cache does not contain it:

```bash
npx playwright install chromium
npm run test:e2e
```

Expected: one E2E test PASS with no `404`, console error, or page error.

- [ ] **Step 10: Commit the packed browser test**

```bash
git add package.json package-lock.json test/helpers/packed-consumer.js test/helpers/static-server.js test/e2e.test.js
git commit -m "test: run packed TypeScript SPA in browser"
```

---

### Task 4: Cover JS-only and missing-TypeScript consumers from the tarball

**Files:**
- Modify: `test/package.test.js`
- Modify: `test/helpers/packed-consumer.js`

**Interfaces:**
- Consumes: `createPackedConsumer()` and `runConsumer()` from Task 3.
- Produces: package tests that prove optional-peer behavior using an installed tarball rather than repository-local CLI code.

- [ ] **Step 1: Refactor existing tarball setup to the shared helper**

Replace the package test's private `run()` and duplicated pack/install setup
with `createPackedConsumer()` and `runConsumer()`. Preserve all existing
tarball-content assertions by returning parsed `pack.files` from the helper as
`packedFiles`.

- [ ] **Step 2: Add a JS-only tarball test**

Create a minimal fixture in the temporary consumer containing `src/index.html`
and `src/app.js`, install with `{ installTypeScript: false }`, then assert:

```js
assert.equal(installedMetadata.dependencies, undefined);
assert.equal(consumerLock.packages['node_modules/typescript'], undefined);
const result = runConsumer(
  consumer.cli,
  ['--src', 'src', '--out', 'dist'],
  { cwd: consumer.root, env: consumer.env },
);
assert.match(result.stdout, /Build complete/);
```

- [ ] **Step 3: Add a missing-TypeScript tarball test**

Create `src/app.ts`, install with `{ installTypeScript: false }`, run the
installed CLI with `allowFailure: true`, and assert:

```js
assert.notEqual(result.status, 0);
assert.match(result.stderr, /npm install --save-dev typescript/);
```

- [ ] **Step 4: Run package tests**

Run:

```bash
npm run test:package
```

Expected: all tarball-content, JS-only, API, and missing-TypeScript cases PASS.

- [ ] **Step 5: Commit optional-peer consumer coverage**

```bash
git add test/package.test.js test/helpers/packed-consumer.js
git commit -m "test: verify optional TypeScript from packed package"
```

---

### Task 5: Document and run the complete release gate

**Files:**
- Modify: `docs/TESTING.md`
- Modify: `README.md`
- Modify: `README.ru.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `npm run test:e2e` and the verified behavior from Tasks 1–4.
- Produces: copy-ready English and Russian testing instructions and an RC.4 changelog entry.

- [ ] **Step 1: Document the realistic E2E command in English**

Add to `README.md` and `docs/TESTING.md`:

```bash
# Install the browser used by the development-only E2E suite
npx playwright install chromium

# Pack, install, build, serve, and exercise the TypeScript SPA
npm run test:e2e
```

State explicitly that the fixture installs the generated `.tgz`, that
Playwright is not shipped as a runtime dependency, and that the test rejects
HTTP errors, page errors, console errors, and broken hashed references.

- [ ] **Step 2: Add the equivalent Russian documentation**

Add the same commands and guarantees to `README.ru.md`, using
“браузерный E2E-тест устанавливает именно архив `npm pack`” and
“Playwright используется только при разработке и не является runtime-зависимостью”.

- [ ] **Step 3: Update testing coverage and changelog**

Extend the coverage list in `docs/TESTING.md` with:

- packed Vanilla TypeScript SPA execution in Chromium;
- static/dynamic ES-module hash rewriting;
- CSS `@import` and `url()` hash rewriting;
- fetch, DOM events, localStorage, images, and console/network diagnostics.

Add an `0.0.4-rc.4` unreleased/testing note to `CHANGELOG.md` without claiming
publication.

- [ ] **Step 4: Run formatting-sensitive checks**

Run:

```bash
npm run lint
git diff --check
```

Expected: both exit `0`.

- [ ] **Step 5: Run the full functional gate**

Run:

```bash
npm test
npm run test:e2e
npm run test:package
npm pack --dry-run
```

Expected: every test PASS. `npm pack --dry-run` includes package runtime and
documentation files, and excludes `test/` plus Playwright.

- [ ] **Step 6: Run dependency and security checks**

Run:

```bash
npm audit
npm audit --omit=dev
npm ls --omit=dev --omit=optional --depth=0
```

Expected:

- both audit commands report `found 0 vulnerabilities`;
- runtime dependency listing contains only the root
  `obf-minify-build@0.0.4-rc.4` entry and no child packages.

If registry advisory data cannot be reached, report the audit as unverified;
do not describe it as passing.

- [ ] **Step 7: Inspect the final repository state**

Run:

```bash
git status --short
git diff --stat HEAD
git diff --check HEAD
```

Expected: only intended documentation changes remain before the final commit;
no tarball, temporary consumer, browser output, `dist/`, or `node_modules`
artifact is newly tracked.

- [ ] **Step 8: Commit documentation**

```bash
git add README.md README.ru.md CHANGELOG.md docs/TESTING.md
git commit -m "docs: explain packed browser verification"
```

- [ ] **Step 9: Perform a fresh post-commit verification**

Run:

```bash
npm test
npm run lint
npm audit
npm pack --dry-run
git status --short --branch
```

Expected: tests and lint PASS, audit reports zero known vulnerabilities,
dry-run packaging succeeds, and the branch is clean. Record exact test counts,
tarball file count/size, Node version, and any environment not tested. Do not
push, tag, publish, or create a pull request.
