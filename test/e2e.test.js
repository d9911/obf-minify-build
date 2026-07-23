import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';
import {
  createPackedConsumer,
  runConsumer,
} from './helpers/packed-consumer.js';
import { projectRoot } from './helpers/project.js';
import { serveDirectory } from './helpers/static-server.js';

async function listFiles(root, directory = root) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(root, absolutePath));
    } else if (entry.isFile()) {
      files.push(path.relative(root, absolutePath).split(path.sep).join('/'));
    }
  }
  return files.sort();
}

test('packed package builds and runs a real TypeScript SPA', { timeout: 120_000 }, async t => {
  const fixture = path.join(projectRoot, 'test', 'fixtures', 'real-world-app');
  const consumer = await createPackedConsumer(t, fixture, {
    installTypeScript: true,
  });

  assert.match(consumer.tarball, /obf-minify-build-0\.0\.4-rc\.4\.tgz$/);
  const build = runConsumer(
    consumer.cli,
    ['--src', 'src', '--out', 'dist'],
    { cwd: consumer.root, env: consumer.env },
  );
  assert.match(build.stdout, /Build complete/);

  const outputDirectory = path.join(consumer.root, 'dist');
  const files = await listFiles(outputDirectory);
  assert.ok(files.some(file => /^ts\/app\.[a-f0-9]{8}\.js$/.test(file)));
  assert.ok(files.some(file => /^ts\/store\.[a-f0-9]{8}\.js$/.test(file)));
  assert.ok(files.some(file => /^ts\/feature\.[a-f0-9]{8}\.js$/.test(file)));
  assert.ok(files.some(file => /^css\/app\.[a-f0-9]{8}\.css$/.test(file)));
  assert.ok(files.some(file => /^css\/theme\.[a-f0-9]{8}\.css$/.test(file)));
  assert.ok(files.some(file => /^assets\/grid\.[a-f0-9]{8}\.svg$/.test(file)));
  assert.ok(!files.includes('ts/app.js'));
  assert.ok(!files.includes('css/app.css'));
  assert.ok(!files.includes('assets/grid.svg'));

  const textFiles = files.filter(file => /\.(?:html|css|js)$/.test(file));
  for (const file of textFiles) {
    const content = await readFile(path.join(outputDirectory, file), 'utf8');
    assert.doesNotMatch(
      content,
      /(?:\.\/)?(?:app|store|feature|theme)\.(?:js|css)|grid\.svg|logo\.svg/,
      `Unhashed local reference remains in ${file}`,
    );
  }

  const { origin } = await serveDirectory(t, outputDirectory);
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
  assert.equal(
    await page.getByTestId('feature').textContent(),
    'Dynamic feature loaded',
  );
  assert.deepEqual(
    await page.getByTestId('tasks').locator('li').allTextContents(),
    ['Install packed package', 'Build TypeScript SPA'],
  );

  await page.getByTestId('increment').click();
  assert.equal(await page.getByTestId('count').textContent(), '1');
  await page.getByTestId('name').fill('Packed consumer');
  await page.getByTestId('save').click();
  assert.equal(
    await page.getByTestId('saved-name').textContent(),
    'Packed consumer',
  );

  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.getByTestId('count').textContent(), '1');
  assert.equal(
    await page.getByTestId('saved-name').textContent(),
    'Packed consumer',
  );
  assert.equal(
    await page.getByTestId('logo').evaluate(image => image.naturalWidth > 0),
    true,
  );
  assert.equal(
    await page.getByTestId('increment').evaluate(
      button => button.ownerDocument.defaultView.getComputedStyle(button).color,
    ),
    'rgb(31, 95, 191)',
  );
  assert.match(
    await page.locator('.app').evaluate(
      element => (
        element.ownerDocument.defaultView.getComputedStyle(element).backgroundImage
      ),
    ),
    /grid\.[a-f0-9]{8}\.svg#grid/,
  );
  assert.deepEqual(failures, []);
});
