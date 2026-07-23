import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isRemoteReference } from './transform.js';

const HASHED_EXTENSIONS = new Set([
  '.css',
  '.js',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
]);

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function splitReference(reference) {
  const match = reference.match(/^([^?#]*)(.*)$/);
  return { pathname: match[1], suffix: match[2] };
}

export async function hashOutputFiles(outputDir, relativePaths) {
  const manifest = {};

  for (const relativePath of relativePaths) {
    const extension = path.extname(relativePath).toLowerCase();
    if (!HASHED_EXTENSIONS.has(extension)) continue;

    const absolutePath = path.join(outputDir, relativePath);
    const content = await readFile(absolutePath);
    const hash = createHash('sha256').update(content).digest('hex').slice(0, 8);
    const hashedPath = path.join(
      path.dirname(relativePath),
      `${path.basename(relativePath, extension)}.${hash}${extension}`,
    );

    await rename(absolutePath, path.join(outputDir, hashedPath));
    manifest[toPosix(relativePath)] = toPosix(hashedPath);
  }

  return manifest;
}

export async function rewriteHtmlReferences(outputDir, htmlPaths, manifest) {
  for (const htmlPath of htmlPaths) {
    const absolutePath = path.join(outputDir, htmlPath);
    const source = await readFile(absolutePath, 'utf8');
    const rewritten = source.replace(
      /\b(src|href)=(["'])([^"']+)\2/gi,
      (attribute, name, quote, reference) => {
        if (isRemoteReference(reference)) return attribute;

        const { pathname, suffix } = splitReference(reference);
        const decodedPath = decodeURIComponent(pathname);
        const rootRelative = decodedPath.startsWith('/');
        const target = toPosix(path.normalize(
          rootRelative
            ? decodedPath.slice(1)
            : path.join(path.dirname(htmlPath), decodedPath),
        ));
        const hashedTarget = manifest[target];
        if (!hashedTarget) return attribute;

        let relative = rootRelative
          ? `/${hashedTarget}`
          : toPosix(path.relative(path.dirname(htmlPath), hashedTarget));
        if (!relative.startsWith('.')) {
          relative = !rootRelative && pathname.startsWith('./')
            ? `./${relative}`
            : relative;
        }
        return `${name}=${quote}${relative}${suffix}${quote}`;
      },
    );

    await writeFile(absolutePath, rewritten);
  }
}
