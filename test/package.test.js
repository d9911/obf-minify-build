import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createFixture, projectRoot } from './helpers/project.js';
import {
  createPackedConsumer,
  runConsumer,
} from './helpers/packed-consumer.js';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
  });
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`,
  );
  return result;
}

test('package metadata guarantees zero runtime dependencies', async () => {
  const metadata = JSON.parse(
    await readFile(path.join(projectRoot, 'package.json'), 'utf8'),
  );

  assert.deepEqual(metadata.dependencies ?? {}, {});
  assert.equal(metadata.peerDependencies?.typescript, '>=5.0.0');
  assert.equal(metadata.peerDependenciesMeta?.typescript?.optional, true);
  assert.equal(metadata.version, '0.0.4-rc.4');
});

test('packed package installs and works in an empty consumer project', async t => {
  const { root } = await createFixture(t);
  const packDirectory = path.join(root, 'pack');
  const consumer = path.join(root, 'consumer');
  const npm = path.join(path.dirname(process.execPath), 'npm');
  const env = {
    ...process.env,
    PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ''}`,
    npm_config_cache: path.join(root, 'npm-cache'),
  };

  await mkdir(packDirectory, { recursive: true });
  const packResult = run(
    npm,
    ['pack', '--json', '--pack-destination', packDirectory],
    { cwd: projectRoot, env },
  );
  const [pack] = JSON.parse(packResult.stdout);
  const packedPaths = pack.files.map(file => file.path);

  assert.ok(packedPaths.includes('README.md'));
  assert.ok(packedPaths.includes('README.ru.md'));
  assert.ok(packedPaths.includes('CHANGELOG.md'));
  assert.ok(packedPaths.includes('LICENSE'));
  assert.ok(packedPaths.includes('docs/README.md'));
  assert.ok(packedPaths.includes('docs/EXAMPLES.md'));
  assert.ok(packedPaths.includes('docs/TESTING.md'));
  assert.ok(packedPaths.includes('docs/TROUBLESHOOTING.md'));
  assert.ok(packedPaths.includes('lib/index.js'));
  assert.ok(packedPaths.includes('bin/cli.js'));
  assert.ok(packedPaths.includes('obfuscator.json'));
  assert.ok(!packedPaths.some(file => file.startsWith('test/')));
  assert.ok(!packedPaths.some(file => file.startsWith('scripts/')));

  await mkdir(path.join(consumer, 'src'), { recursive: true });
  await writeFile(
    path.join(consumer, 'package.json'),
    JSON.stringify({ name: 'consumer', private: true, type: 'module' }),
  );
  await writeFile(
    path.join(consumer, 'src', 'index.html'),
    '<link rel="stylesheet" href="app.css"><h1>Consumer</h1>',
  );
  await writeFile(path.join(consumer, 'src', 'app.css'), 'h1 { color: purple; }');

  const tarball = path.join(packDirectory, pack.filename);
  run(
    npm,
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--offline',
      '--omit=optional',
      tarball,
    ],
    { cwd: consumer, env },
  );
  const consumerLock = JSON.parse(
    await readFile(path.join(consumer, 'package-lock.json'), 'utf8'),
  );
  const installedMetadata = JSON.parse(
    await readFile(
      path.join(consumer, 'node_modules', 'obf-minify-build', 'package.json'),
      'utf8',
    ),
  );
  assert.deepEqual(installedMetadata.dependencies ?? {}, {});
  assert.equal(consumerLock.packages['node_modules/typescript'], undefined);

  const cli = path.join(
    consumer,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'obf-minify-build.cmd' : 'obf-minify-build',
  );
  const cliResult = run(
    cli,
    ['--src', 'src', '--out', 'dist'],
    { cwd: consumer, env },
  );
  assert.match(cliResult.stdout, /Build complete/);

  const apiScript = `
    import { build } from 'obf-minify-build';
    const result = await build({ src: 'src', out: 'api-dist' });
    console.log(JSON.stringify(result.files));
  `;
  const apiResult = run(
    process.execPath,
    ['--input-type=module', '--eval', apiScript],
    { cwd: consumer, env },
  );
  assert.deepEqual(JSON.parse(apiResult.stdout), {
    html: 1,
    css: 1,
    js: 0,
    assets: 0,
    copied: 0,
  });

  const builtHtml = await readFile(path.join(consumer, 'dist', 'index.html'), 'utf8');
  assert.match(builtHtml, /app\.[a-f0-9]{8}\.css/);
});

test('packed package builds JavaScript without installing TypeScript', async t => {
  const { src: fixture } = await createFixture(t, {
    'package.json': JSON.stringify({
      name: 'javascript-only-consumer',
      private: true,
      type: 'module',
    }),
    'src/index.html': '<script type="module" src="./app.js"></script>',
    'src/app.js': 'document.body.dataset.ready = "true";',
  });
  const consumer = await createPackedConsumer(t, fixture);
  const installedMetadata = JSON.parse(
    await readFile(
      path.join(
        consumer.root,
        'node_modules',
        'obf-minify-build',
        'package.json',
      ),
      'utf8',
    ),
  );
  const consumerLock = JSON.parse(
    await readFile(path.join(consumer.root, 'package-lock.json'), 'utf8'),
  );

  assert.deepEqual(installedMetadata.dependencies ?? {}, {});
  assert.equal(consumerLock.packages['node_modules/typescript'], undefined);

  const result = runConsumer(
    consumer.cli,
    ['--src', 'src', '--out', 'dist'],
    { cwd: consumer.root, env: consumer.env },
  );
  assert.match(result.stdout, /Build complete/);
});

test('packed package explains how to install TypeScript when it is missing', async t => {
  const { src: fixture } = await createFixture(t, {
    'package.json': JSON.stringify({
      name: 'missing-typescript-consumer',
      private: true,
      type: 'module',
    }),
    'src/app.ts': 'const answer: number = 42;',
  });
  const consumer = await createPackedConsumer(t, fixture);
  const result = runConsumer(
    consumer.cli,
    ['--src', 'src', '--out', 'dist'],
    {
      allowFailure: true,
      cwd: consumer.root,
      env: consumer.env,
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /npm install --save-dev typescript/);
});
