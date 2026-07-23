import { readFile } from 'node:fs/promises';
import path from 'node:path';
import CleanCSS from 'clean-css';
import { minify } from 'html-minifier-terser';
import JavaScriptObfuscator from 'javascript-obfuscator';

const DEFAULT_OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  renameGlobals: false,
  selfDefending: false,
  stringArray: true,
  stringArrayThreshold: 0.75,
};

export async function loadObfuscatorOptions(cwd) {
  try {
    const raw = await readFile(path.join(cwd, 'obfuscator.json'), 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return DEFAULT_OBFUSCATOR_OPTIONS;
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid obfuscator.json: ${error.message}`);
    }
    throw error;
  }
}

export function isRemoteReference(reference) {
  return (
    reference.startsWith('//')
    || reference.startsWith('#')
    || reference.startsWith('data:')
    || /^[a-z][a-z\d+.-]*:/i.test(reference)
  );
}

function referencePath(reference) {
  return reference.split(/[?#]/, 1)[0];
}

function resolveReference(htmlPath, reference) {
  const decoded = decodeURIComponent(referencePath(reference));
  if (decoded.startsWith('/')) {
    return path.normalize(decoded.slice(1));
  }
  return path.normalize(path.join(path.dirname(htmlPath), decoded));
}

function shouldSkipJavaScript(relativePath, options) {
  return (
    options.skipObfuscation
    || options.skipObfuscationFor.some(value => relativePath.includes(value))
  );
}

export function transformJavaScript(relativePath, source, options, obfuscatorOptions) {
  if (shouldSkipJavaScript(relativePath, options)) return source;
  return JavaScriptObfuscator
    .obfuscate(source, obfuscatorOptions)
    .getObfuscatedCode();
}

export function transformCss(source, relativePath) {
  const result = new CleanCSS().minify(source);
  if (result.errors.length > 0) {
    throw new Error(`Could not minify CSS ${relativePath}: ${result.errors.join('; ')}`);
  }
  return result.styles;
}

export async function transformHtml(source) {
  return minify(source, {
    collapseWhitespace: true,
    removeComments: true,
    removeEmptyAttributes: true,
    removeRedundantAttributes: true,
    minifyCSS: true,
    minifyJS: false,
  });
}

export function inlineResources(htmlPath, html, transformedFiles, options, warnings) {
  let output = html;

  if (options.inlineCss) {
    output = output.replace(
      /<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/gi,
      (tag, reference) => {
        if (isRemoteReference(reference)) return tag;
        const relativePath = resolveReference(htmlPath, reference);
        const content = transformedFiles.get(relativePath);
        if (content === undefined) {
          warnings.push(`Missing local stylesheet referenced by ${htmlPath}: ${reference}`);
          return tag;
        }
        return `<style>${content}</style>`;
      },
    );
  }

  if (options.inlineJs) {
    output = output.replace(
      /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi,
      (tag, reference) => {
        if (isRemoteReference(reference)) return tag;
        const relativePath = resolveReference(htmlPath, reference);
        const content = transformedFiles.get(relativePath);
        if (content === undefined) {
          warnings.push(`Missing local script referenced by ${htmlPath}: ${reference}`);
          return tag;
        }
        return `<script>${content}</script>`;
      },
    );
  }

  return output;
}
