const RESERVED = new Set([
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for',
  'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'return',
  'static', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void',
  'while', 'with', 'yield',
]);

function matching(tokens, start, open, close) {
  let depth = 0;
  for (let index = start; index < tokens.length; index += 1) {
    if (tokens[index].text === open) depth += 1;
    if (tokens[index].text === close) depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
}

function replacementName(index, used) {
  let value = index;
  while (index < Number.MAX_SAFE_INTEGER) {
    let name = '_';
    do {
      name += String.fromCharCode(97 + (value % 26));
      value = Math.floor(value / 26) - 1;
    } while (value >= 0);
    if (!used.has(name) && !RESERVED.has(name)) return name;
    index += 1;
    value = index;
  }
  throw new Error('Could not generate a local identifier');
}

function isUnsafeReference(tokens, index) {
  const previous = tokens[index - 1]?.text;
  const next = tokens[index + 1]?.text;
  const shorthand = ['{', ','].includes(previous) && [',', '}'].includes(next);
  return previous === '.' || previous === '?.' || next === ':' || shorthand;
}

export function analyzeScopes(tokens) {
  const replacements = new Map();
  const used = new Set(
    tokens
      .filter(token => token.type === 'identifier')
      .map(token => token.text),
  );
  let generated = 0;

  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].text !== 'function') continue;
    const parametersStart = tokens.findIndex(
      (token, tokenIndex) => tokenIndex > index && token.text === '(',
    );
    if (parametersStart === -1) continue;
    const parametersEnd = matching(tokens, parametersStart, '(', ')');
    const bodyStart = parametersEnd + 1;
    if (parametersEnd === -1 || tokens[bodyStart]?.text !== '{') continue;
    const bodyEnd = matching(tokens, bodyStart, '{', '}');
    if (bodyEnd === -1) continue;

    const body = tokens.slice(bodyStart + 1, bodyEnd);
    if (body.some(token => token.text === 'function' || token.text === '=>')) continue;

    const candidates = new Set();
    let simpleParameters = true;
    for (let cursor = parametersStart + 1; cursor < parametersEnd; cursor += 1) {
      if (tokens[cursor].type === 'identifier') candidates.add(tokens[cursor].text);
      else if (tokens[cursor].text !== ',') {
        simpleParameters = false;
        break;
      }
    }
    if (!simpleParameters) continue;
    for (let cursor = bodyStart + 1; cursor < bodyEnd; cursor += 1) {
      if (
        ['let', 'const', 'var'].includes(tokens[cursor].text)
        && tokens[cursor + 1]?.type === 'identifier'
      ) {
        candidates.add(tokens[cursor + 1].text);
      }
      if (tokens[cursor].text === 'catch' && tokens[cursor + 1]?.text === '('
        && tokens[cursor + 2]?.type === 'identifier') {
        candidates.add(tokens[cursor + 2].text);
      }
    }

    for (const candidate of candidates) {
      const indexes = [];
      let unsafe = body.some(
        token => token.type === 'template'
          && new RegExp(`\\$\\{[^}]*\\b${candidate}\\b`).test(token.text),
      );
      for (let cursor = parametersStart + 1; cursor < bodyEnd; cursor += 1) {
        if (tokens[cursor].text !== candidate) continue;
        if (isUnsafeReference(tokens, cursor)) {
          unsafe = true;
          break;
        }
        indexes.push(cursor);
      }
      if (unsafe || indexes.length === 0) continue;
      const replacement = replacementName(generated, used);
      generated += 1;
      used.add(replacement);
      for (const tokenIndex of indexes) replacements.set(tokenIndex, replacement);
    }
    index = bodyEnd;
  }

  return { replacements, reason: null };
}
