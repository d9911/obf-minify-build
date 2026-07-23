import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function discoverFiles(root) {
  const discovered = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile()) {
        discovered.push(path.relative(root, absolutePath));
      }
    }
  }

  await visit(root);
  return discovered;
}

export async function prepareOutput(outputDir) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
}

export async function readSourceFiles(sourceDir, relativePaths) {
  const files = new Map();
  for (const relativePath of relativePaths) {
    files.set(relativePath, await readFile(path.join(sourceDir, relativePath)));
  }
  return files;
}

export async function writeOutputFile(outputDir, relativePath, content) {
  const target = path.join(outputDir, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}
