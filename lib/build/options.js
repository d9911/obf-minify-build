import { stat } from 'node:fs/promises';
import path from 'node:path';

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export async function resolveBuildOptions(options = {}) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const sourceDir = path.resolve(cwd, options.src ?? 'src');
  const outputDir = path.resolve(cwd, options.out ?? 'build');

  let sourceStats;
  try {
    sourceStats = await stat(sourceDir);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Source directory does not exist: ${sourceDir}`);
    }
    throw error;
  }

  if (!sourceStats.isDirectory()) {
    throw new Error(`Source path is not a directory: ${sourceDir}`);
  }
  if (sourceDir === outputDir) {
    throw new Error('Source and output directories must be different');
  }
  if (isInside(outputDir, sourceDir)) {
    throw new Error('Output directory must not contain the source directory');
  }
  if (isInside(sourceDir, outputDir)) {
    throw new Error('Output directory must not be inside the source directory');
  }

  return {
    cwd,
    sourceDir,
    outputDir,
    inlineCss: Boolean(options.inlineCss || options.inlineAll),
    inlineJs: Boolean(options.inlineJs || options.inlineAll),
    generateIndex: Boolean(options.generateIndex),
    skipObfuscation: Boolean(options.skipObfuscation),
    skipObfuscationFor: Array.isArray(options.skipObfuscationFor)
      ? options.skipObfuscationFor.filter(Boolean)
      : [],
  };
}
