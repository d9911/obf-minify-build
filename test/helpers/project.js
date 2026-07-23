import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

export async function createFixture(t, files = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'obf-minify-build-'));
  const src = path.join(root, 'source files');
  const out = path.join(root, 'output files');

  await mkdir(src, { recursive: true });

  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(src, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }

  t.after(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(root, { recursive: true, force: true });
  });

  return { root, src, out };
}

export function runCli(args, { cwd = projectRoot, env = process.env } = {}) {
  const result = spawnSync(
    process.execPath,
    [path.join(projectRoot, 'bin', 'cli.js'), ...args],
    {
      cwd,
      env,
      encoding: 'utf8',
    },
  );

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
