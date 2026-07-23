import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isRemoteReference } from './transform.js';
import { lexJavaScript } from '../transform/javascript/lexer.js';

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

function resolveManifestReference(ownerPath, reference, manifest) {
  if (isRemoteReference(reference) || reference.startsWith('node:')) return null;

  const { pathname, suffix } = splitReference(reference);
  const decodedPath = decodeURIComponent(pathname);
  const rootRelative = decodedPath.startsWith('/');
  const target = toPosix(path.normalize(
    rootRelative
      ? decodedPath.slice(1)
      : path.join(path.dirname(ownerPath), decodedPath),
  ));
  const hashedTarget = manifest[target];
  if (!hashedTarget) return null;

  let rewritten = rootRelative
    ? `/${hashedTarget}`
    : toPosix(path.relative(path.dirname(ownerPath), hashedTarget));
  if (!rootRelative && !rewritten.startsWith('.')) rewritten = `./${rewritten}`;
  return `${rewritten}${suffix}`;
}

function applyReplacements(source, replacements) {
  return replacements
    .sort((left, right) => right.start - left.start)
    .reduce(
      (output, replacement) => (
        `${output.slice(0, replacement.start)}`
        + `${replacement.value}${output.slice(replacement.end)}`
      ),
      source,
    );
}

function replaceStringToken(replacements, token, value) {
  const quote = token.text[0];
  replacements.push({
    start: token.start,
    end: token.end,
    value: `${quote}${value}${quote}`,
  });
}

function nextCodeToken(tokens, index) {
  let next = index + 1;
  while (tokens[next]?.type === 'comment') next += 1;
  return { index: next, token: tokens[next] };
}

export function rewriteJavaScriptReferences(source, ownerPath, manifest, warnings = []) {
  const { tokens, error } = lexJavaScript(source);
  if (error) return source;

  const replacements = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== 'keyword' || (token.text !== 'import' && token.text !== 'export')) {
      continue;
    }

    const next = nextCodeToken(tokens, index);
    if (token.text === 'import' && next.token?.text === '(') {
      const argument = nextCodeToken(tokens, next.index);
      if (argument.token?.type !== 'string') {
        warnings.push(`Cannot rewrite computed dynamic import in ${ownerPath}`);
        continue;
      }
      const rewritten = resolveManifestReference(
        ownerPath,
        argument.token.text.slice(1, -1),
        manifest,
      );
      if (rewritten) replaceStringToken(replacements, argument.token, rewritten);
      continue;
    }

    if (token.text === 'import' && next.token?.type === 'string') {
      const rewritten = resolveManifestReference(
        ownerPath,
        next.token.text.slice(1, -1),
        manifest,
      );
      if (rewritten) replaceStringToken(replacements, next.token, rewritten);
      continue;
    }

    for (let cursor = next.index; cursor < tokens.length; cursor += 1) {
      const candidate = tokens[cursor];
      if (candidate.text === ';') break;
      if (
        candidate.type === 'identifier'
        && candidate.text === 'from'
      ) {
        const specifier = nextCodeToken(tokens, cursor).token;
        if (specifier?.type === 'string') {
          const rewritten = resolveManifestReference(
            ownerPath,
            specifier.text.slice(1, -1),
            manifest,
          );
          if (rewritten) replaceStringToken(replacements, specifier, rewritten);
        }
        break;
      }
    }
  }

  return applyReplacements(source, replacements);
}

function readCssQuoted(source, start) {
  const quote = source[start];
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (character === quote) {
      return index;
    }
  }
  return -1;
}

function rewriteCssValue(value, ownerPath, manifest) {
  return resolveManifestReference(ownerPath, value, manifest) ?? value;
}

export function rewriteCssReferences(source, ownerPath, manifest) {
  let output = '';
  let index = 0;

  while (index < source.length) {
    if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2);
      const finish = end === -1 ? source.length : end + 2;
      output += source.slice(index, finish);
      index = finish;
      continue;
    }

    if (source[index] === '"' || source[index] === "'") {
      const end = readCssQuoted(source, index);
      const finish = end === -1 ? source.length : end + 1;
      output += source.slice(index, finish);
      index = finish;
      continue;
    }

    const urlMatch = source.slice(index).match(/^url\(\s*/i);
    if (urlMatch) {
      const valueStart = index + urlMatch[0].length;
      const quote = source[valueStart] === '"' || source[valueStart] === "'"
        ? source[valueStart]
        : '';
      const contentStart = valueStart + quote.length;
      let contentEnd;
      let finish;

      if (quote) {
        contentEnd = readCssQuoted(source, valueStart);
        if (contentEnd === -1) {
          output += source.slice(index);
          break;
        }
        let closing = contentEnd + 1;
        while (/\s/.test(source[closing] ?? '')) closing += 1;
        if (source[closing] !== ')') {
          output += source.slice(index, closing);
          index = closing;
          continue;
        }
        finish = closing + 1;
      } else {
        const closing = source.indexOf(')', contentStart);
        if (closing === -1) {
          output += source.slice(index);
          break;
        }
        contentEnd = closing;
        while (
          contentEnd > contentStart
          && /\s/.test(source[contentEnd - 1])
        ) {
          contentEnd -= 1;
        }
        finish = closing + 1;
      }

      const value = source.slice(contentStart, contentEnd);
      const rewritten = rewriteCssValue(value, ownerPath, manifest);
      output += source.slice(index, contentStart);
      output += rewritten;
      output += source.slice(contentEnd, finish);
      index = finish;
      continue;
    }

    const importMatch = source.slice(index).match(/^@import\s+/i);
    if (importMatch) {
      const quoteStart = index + importMatch[0].length;
      if (source[quoteStart] === '"' || source[quoteStart] === "'") {
        const quoteEnd = readCssQuoted(source, quoteStart);
        if (quoteEnd === -1) {
          output += source.slice(index);
          break;
        }
        const value = source.slice(quoteStart + 1, quoteEnd);
        output += source.slice(index, quoteStart + 1);
        output += rewriteCssValue(value, ownerPath, manifest);
        output += source[quoteEnd];
        index = quoteEnd + 1;
        continue;
      }
    }

    output += source[index];
    index += 1;
  }

  return output;
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

function rewriteHtmlSource(source, htmlPath, manifest) {
  return source.replace(
    /\b(src|href)=(["'])([^"']+)\2/gi,
    (attribute, name, quote, reference) => {
      const rewritten = resolveManifestReference(htmlPath, reference, manifest);
      if (!rewritten) return attribute;
      return `${name}=${quote}${rewritten}${quote}`;
    },
  );
}

export async function rewriteHtmlReferences(outputDir, htmlPaths, manifest) {
  for (const htmlPath of htmlPaths) {
    const absolutePath = path.join(outputDir, htmlPath);
    const source = await readFile(absolutePath, 'utf8');
    await writeFile(absolutePath, rewriteHtmlSource(source, htmlPath, manifest));
  }
}

export async function rewriteOutputReferences(
  outputDir,
  emittedPaths,
  manifest,
  warnings,
) {
  for (const relativePath of emittedPaths) {
    const extension = path.extname(relativePath).toLowerCase();
    if (!['.html', '.css', '.js'].includes(extension)) continue;

    const outputPath = manifest[relativePath] ?? relativePath;
    const absolutePath = path.join(outputDir, outputPath);
    const source = await readFile(absolutePath, 'utf8');
    let rewritten = source;

    if (extension === '.html') {
      rewritten = rewriteHtmlSource(source, relativePath, manifest);
    } else if (extension === '.css') {
      rewritten = rewriteCssReferences(source, relativePath, manifest);
    } else if (extension === '.js') {
      rewritten = rewriteJavaScriptReferences(
        source,
        relativePath,
        manifest,
        warnings,
      );
    }

    await writeFile(absolutePath, rewritten);
  }
}
