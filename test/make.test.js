import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createFixture, projectRoot } from './helpers/project.js';

const hasMake = spawnSync('make', ['--version'], { encoding: 'utf8' }).status === 0;

test('Make delegates to the Node.js build engine', { skip: !hasMake }, async t => {
  const { root, src, out } = await createFixture(t, {
    'index.html': '<main> Make wrapper </main>',
  });
  const nodeDirectory = path.dirname(process.execPath);
  const result = spawnSync(
    'make',
    [
      '-f',
      path.join(projectRoot, 'Makefile'),
      `SRC_DIR=${src}`,
      `BUILD_DIR=${out}`,
      'all',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${nodeDirectory}${path.delimiter}${process.env.PATH ?? ''}`,
      },
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Build complete/);
  assert.equal(
    await readFile(path.join(out, 'index.html'), 'utf8'),
    '<main>Make wrapper</main>',
  );
});
