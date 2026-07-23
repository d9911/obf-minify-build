import path from 'node:path';
import {
  discoverFiles,
  prepareOutput,
  readSourceFiles,
  writeOutputFile,
} from './build/files.js';
import { resolveBuildOptions } from './build/options.js';
import { hashOutputFiles, rewriteHtmlReferences } from './build/references.js';
import {
  inlineResources,
  loadObfuscatorOptions,
  transformCss,
  transformHtml,
  transformJavaScript,
} from './build/transform.js';

const ASSET_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
]);

function generatedIndex() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Built with obf-minify-build</title>
  </head>
  <body>
    <h1>Built with obf-minify-build</h1>
    <p>Add an HTML file to your source directory and build again.</p>
  </body>
</html>`;
}

export async function build(options = {}) {
  const resolved = await resolveBuildOptions(options);
  const relativePaths = await discoverFiles(resolved.sourceDir);
  const sourceFiles = await readSourceFiles(resolved.sourceDir, relativePaths);
  const obfuscatorOptions = await loadObfuscatorOptions(resolved.cwd);
  const transformedFiles = new Map();
  const warnings = [];
  const files = { html: 0, css: 0, js: 0, assets: 0, copied: 0 };

  for (const relativePath of relativePaths) {
    const extension = path.extname(relativePath).toLowerCase();
    const source = sourceFiles.get(relativePath);

    if (extension === '.css') {
      transformedFiles.set(relativePath, transformCss(source.toString('utf8'), relativePath));
      files.css += 1;
    } else if (extension === '.js') {
      transformedFiles.set(
        relativePath,
        transformJavaScript(
          relativePath,
          source.toString('utf8'),
          resolved,
          obfuscatorOptions,
        ),
      );
      files.js += 1;
    } else if (ASSET_EXTENSIONS.has(extension)) {
      transformedFiles.set(relativePath, source);
      files.assets += 1;
    } else if (extension !== '.html') {
      transformedFiles.set(relativePath, source);
      files.copied += 1;
    }
  }

  const htmlPaths = relativePaths.filter(file => path.extname(file).toLowerCase() === '.html');
  if (htmlPaths.length === 0 && resolved.generateIndex) {
    htmlPaths.push('index.html');
    sourceFiles.set('index.html', Buffer.from(generatedIndex()));
  }

  for (const htmlPath of htmlPaths) {
    const source = sourceFiles.get(htmlPath).toString('utf8');
    const inlined = inlineResources(
      htmlPath,
      source,
      transformedFiles,
      resolved,
      warnings,
    );
    transformedFiles.set(htmlPath, await transformHtml(inlined));
    files.html += 1;
  }

  await prepareOutput(resolved.outputDir);
  for (const [relativePath, content] of transformedFiles) {
    await writeOutputFile(resolved.outputDir, relativePath, content);
  }

  const emittedPaths = [...transformedFiles.keys()];
  const manifest = await hashOutputFiles(resolved.outputDir, emittedPaths);
  await rewriteHtmlReferences(resolved.outputDir, htmlPaths, manifest);

  return {
    sourceDir: resolved.sourceDir,
    outputDir: resolved.outputDir,
    files,
    manifest,
    warnings,
  };
}
