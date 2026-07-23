import { lexJavaScript } from './lexer.js';
import { analyzeScopes } from './scopes.js';

const ASI_KEYWORDS = new Set([
  'await', 'break', 'continue', 'return', 'throw', 'yield',
]);

function needsSpace(previous, current) {
  if (!previous) return false;
  const wordLike = new Set(['identifier', 'privateIdentifier', 'keyword', 'number']);
  if (wordLike.has(previous.type) && wordLike.has(current.type)) return true;
  if ((previous.text === '+' && current.text.startsWith('+'))
    || (previous.text === '-' && current.text.startsWith('-'))) return true;
  if (previous.text.endsWith('/') && current.text.startsWith('/')) return true;
  return false;
}

function encodeString(token, previous, next) {
  if (token.text.includes('\\')) return token.text;
  if (previous?.text === 'import' || previous?.text === 'from') return token.text;
  if (next?.text === ':' || next?.text === ';' && !previous) return token.text;

  const quote = token.text[0];
  const content = token.text.slice(1, -1);
  if ([...content].some(character => character.codePointAt(0) > 0xffff)) {
    return token.text;
  }
  const encoded = [...content].map(character => {
    const code = character.charCodeAt(0);
    return code <= 0xff
      ? `\\x${code.toString(16).padStart(2, '0')}`
      : `\\u${code.toString(16).padStart(4, '0')}`;
  }).join('');
  return `${quote}${encoded}${quote}`;
}

function fallback(source, relativePath, reason) {
  return {
    code: source,
    warnings: [`${relativePath}: transformation skipped: ${reason}`],
    transformed: false,
  };
}

export function transformJavaScript(source, relativePath = 'JavaScript input', config = {}) {
  const lexed = lexJavaScript(source);
  if (lexed.error) return fallback(source, relativePath, lexed.error);
  const significant = lexed.tokens.filter(token => token.type !== 'comment');

  if (significant.some(token => token.text === 'eval')) {
    return fallback(source, relativePath, 'eval can observe local names');
  }
  if (significant.some(token => token.text === 'with')) {
    return fallback(source, relativePath, 'with changes identifier resolution');
  }

  const analysis = config.renameLocals
    ? analyzeScopes(significant)
    : { replacements: new Map() };
  if (analysis.reason) return fallback(source, relativePath, analysis.reason);

  let output = '';
  let significantIndex = 0;
  let previous;
  let cursor = 0;
  for (const token of lexed.tokens) {
    if (token.type === 'comment') {
      if (!config.compact) {
        output += source.slice(cursor, token.start);
      }
      if (!config.removeComments || token.text.startsWith('/*!')) {
        output += token.text;
      }
      cursor = token.end;
      continue;
    }

    const replacement = analysis.replacements.get(significantIndex);
    let text = replacement ?? token.text;
    const next = significant[significantIndex + 1];

    if (config.encodeStrings && token.type === 'string') {
      const directive = (!previous || previous.text === '{' || previous.text === ';')
        && next?.text === ';';
      if (!directive) text = encodeString(token, previous, next);
    }

    if (!config.compact) {
      output += source.slice(cursor, token.start);
    } else {
      if (token.lineBreakBefore && ASI_KEYWORDS.has(previous?.text)) {
        output += '\n';
      } else if (needsSpace(previous, { ...token, text })) {
        output += ' ';
      }
    }

    output += text;
    cursor = token.end;
    previous = token;
    significantIndex += 1;
  }
  if (!config.compact) output += source.slice(cursor);

  return { code: output, warnings: [], transformed: output !== source };
}
