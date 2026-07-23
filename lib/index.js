import path from 'node:path';
import {
  discoverFiles,
  prepareOutput,
  readSourceFiles,
  writeOutputFile,
} from './build/files.js';
import { resolveBuildOptions } from './build/options.js';
import {
  hashOutputFiles,
  rewriteOutputReferences,
} from './build/references.js';
import { selectSources } from './build/sources.js';
import { transpileTypeScript } from './build/typescript.js';
import { loadTransformConfig } from './transform/config.js';
import {
  inlineResources,
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
  const selectedSources = selectSources(relativePaths);
  const transformConfig = await loadTransformConfig(resolved.cwd);
  const transformedFiles = new Map();
  const warnings = [];
  const files = { html: 0, css: 0, js: 0, assets: 0, copied: 0 };

  for (const { sourcePath, outputPath, kind } of selectedSources) {
    const extension = path.extname(outputPath).toLowerCase();
    const source = sourceFiles.get(sourcePath);

    if (extension === '.css') {
      transformedFiles.set(
        outputPath,
        transformCss(source.toString('utf8'), sourcePath, transformConfig),
      );
      files.css += 1;
    } else if (extension === '.js') {
      const javascript = kind === 'typescript'
        ? await transpileTypeScript(source.toString('utf8'), sourcePath, resolved.cwd)
        : source.toString('utf8');
      const skipObfuscation = resolved.skipObfuscation
        || resolved.skipObfuscationFor.some(value => outputPath.includes(value));
      const transformed = transformJavaScript(
        javascript,
        outputPath,
        skipObfuscation
          ? { ...transformConfig, encodeStrings: false, renameLocals: false }
          : transformConfig,
      );
      warnings.push(...transformed.warnings);
      transformedFiles.set(
        outputPath,
        transformed.code,
      );
      files.js += 1;
    } else if (ASSET_EXTENSIONS.has(extension)) {
      transformedFiles.set(outputPath, source);
      files.assets += 1;
    } else if (extension !== '.html') {
      transformedFiles.set(outputPath, source);
      files.copied += 1;
    }
  }

  const htmlPaths = selectedSources
    .map(file => file.outputPath)
    .filter(file => path.extname(file).toLowerCase() === '.html');
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
    const handlers = {
      css: content => transformCss(
        content,
        `${htmlPath}#inline-style`,
        transformConfig,
      ),
      javascript: content => {
        const transformed = transformJavaScript(
          content,
          `${htmlPath}#inline-script`,
          transformConfig,
        );
        warnings.push(...transformed.warnings);
        return transformed.code;
      },
    };
    transformedFiles.set(
      htmlPath,
      await transformHtml(inlined, htmlPath, transformConfig, handlers),
    );
    files.html += 1;
  }

  await prepareOutput(resolved.outputDir);
  for (const [relativePath, content] of transformedFiles) {
    await writeOutputFile(resolved.outputDir, relativePath, content);
  }

  const emittedPaths = [...transformedFiles.keys()];
  const manifest = await hashOutputFiles(resolved.outputDir, emittedPaths);
  await rewriteOutputReferences(
    resolved.outputDir,
    emittedPaths,
    manifest,
    warnings,
  );

  return {
    sourceDir: resolved.sourceDir,
    outputDir: resolved.outputDir,
    files,
    manifest,
    warnings,
  };
}
