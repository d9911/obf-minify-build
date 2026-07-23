import path from 'node:path';
export { transformCss } from '../transform/css.js';
export { transformHtml } from '../transform/html.js';
export { transformJavaScript } from '../transform/javascript/transform.js';

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
