import path from 'node:path';

function isDeclaration(relativePath) {
  return relativePath.toLowerCase().endsWith('.d.ts');
}

export function selectSources(relativePaths) {
  const selected = new Map();

  for (const sourcePath of relativePaths) {
    if (isDeclaration(sourcePath)) continue;

    const extension = path.extname(sourcePath).toLowerCase();
    const kind = extension === '.ts' ? 'typescript' : 'file';
    const outputPath = kind === 'typescript'
      ? `${sourcePath.slice(0, -extension.length)}.js`
      : sourcePath;
    const existing = selected.get(outputPath);

    if (!existing || kind === 'typescript') {
      selected.set(outputPath, { sourcePath, outputPath, kind });
    }
  }

  return [...selected.values()]
    .sort((left, right) => left.outputPath.localeCompare(right.outputPath));
}
