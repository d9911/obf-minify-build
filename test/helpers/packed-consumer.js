import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { projectRoot } from './project.js';

function npmExecutable() {
  return path.join(
    path.dirname(process.execPath),
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
  );
}

export function runConsumer(
  command,
  args,
  { allowFailure = false, ...options } = {},
) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: false,
    ...options,
  });

  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed with exit code ${result.status}`
      + `\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }

  return result;
}

export async function createPackedConsumer(
  t,
  fixturePath,
  { installTypeScript = false } = {},
) {
  const temporaryRoot = await mkdtemp(
    path.join(tmpdir(), 'obf-packed-consumer-'),
  );
  const packDirectory = path.join(temporaryRoot, 'pack');
  const consumer = path.join(temporaryRoot, 'consumer');
  await mkdir(packDirectory, { recursive: true });
  await cp(fixturePath, consumer, { recursive: true });

  t.after(async () => {
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  const executableDirectory = path.dirname(process.execPath);
  const env = {
    ...process.env,
    PATH: `${executableDirectory}${path.delimiter}${process.env.PATH ?? ''}`,
    npm_config_cache: path.join(temporaryRoot, 'npm-cache'),
  };
  const npm = npmExecutable();
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
      '--offline',
      '--omit=optional',
      tarball,
    ],
    { cwd: consumer, env },
  );

  if (installTypeScript) {
    runConsumer(
      npm,
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--offline',
        '--save-dev',
        path.join(projectRoot, 'node_modules', 'typescript'),
      ],
      { cwd: consumer, env },
    );
  }

  const cliName = process.platform === 'win32'
    ? 'obf-minify-build.cmd'
    : 'obf-minify-build';

  return {
    root: consumer,
    cli: path.join(consumer, 'node_modules', '.bin', cliName),
    env,
    tarball,
    packedFiles: packed.files.map(file => file.path),
  };
}
