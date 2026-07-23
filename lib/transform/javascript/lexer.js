const KEYWORDS_BEFORE_REGEX = new Set([
  'await', 'case', 'delete', 'do', 'else', 'in', 'instanceof', 'new', 'of',
  'return', 'throw', 'typeof', 'void', 'yield',
]);

const REGEX_AFTER_PUNCTUATOR = new Set([
  '(', '[', '{', ',', ';', ':', '=', '==', '===', '!', '!=', '!==', '?',
  '??', '&&', '||', '=>', '+', '-', '*', '%', '&', '|', '^', '~', '<', '>',
  '<=', '>=',
]);

const PUNCTUATORS = [
  '>>>=', '===', '!==', '>>>', '**=', '&&=', '||=', '??=', '<<=', '>>=',
  '=>', '==', '!=', '<=', '>=', '++', '--', '**', '&&', '||', '??', '?.',
  '<<', '>>', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '...',
];

function isIdentifierStart(character) {
  return character !== undefined && /[$_\p{ID_Start}]/u.test(character);
}

function isIdentifierPart(character) {
  return character !== undefined && /[$_\u200C\u200D\p{ID_Continue}]/u.test(character);
}

function readQuoted(source, start, quote) {
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (character === quote) {
      return index + 1;
    } else if ((character === '\n' || character === '\r') && quote !== '`') {
      return -1;
    }
  }
  return -1;
}

function readRegex(source, start) {
  let escaped = false;
  let characterClass = false;

  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === '\n' || character === '\r') return -1;
    if (escaped) {
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (character === '[') {
      characterClass = true;
    } else if (character === ']') {
      characterClass = false;
    } else if (character === '/' && !characterClass) {
      let end = index + 1;
      while (/[a-z]/i.test(source[end] ?? '')) end += 1;
      return end;
    }
  }
  return -1;
}

function regexAllowed(previous) {
  if (!previous) return true;
  if (previous.type === 'keyword') return KEYWORDS_BEFORE_REGEX.has(previous.text);
  return previous.type === 'punctuator' && REGEX_AFTER_PUNCTUATOR.has(previous.text);
}

export function lexJavaScript(source) {
  const tokens = [];
  let index = 0;
  let lineBreakBefore = false;

  function push(type, start, end) {
    const token = {
      type,
      text: source.slice(start, end),
      start,
      end,
      lineBreakBefore,
    };
    tokens.push(token);
    lineBreakBefore = false;
    return token;
  }

  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];

    if (/\s/.test(character)) {
      if (character === '\n' || character === '\r') lineBreakBefore = true;
      index += 1;
      continue;
    }

    if (character === '/' && next === '/') {
      const start = index;
      index += 2;
      while (index < source.length && !/[\r\n]/.test(source[index])) index += 1;
      push('comment', start, index);
      if (index < source.length) lineBreakBefore = true;
      continue;
    }

    if (character === '/' && next === '*') {
      const start = index;
      const end = source.indexOf('*/', index + 2);
      if (end === -1) {
        return { tokens, error: 'unterminated block comment' };
      }
      const finish = end + 2;
      const text = source.slice(start, finish);
      push('comment', start, finish);
      if (/[\r\n]/.test(text)) lineBreakBefore = true;
      index = finish;
      continue;
    }

    if (character === '"' || character === "'" || character === '`') {
      const end = readQuoted(source, index, character);
      if (end === -1) {
        return {
          tokens,
          error: character === '`'
            ? 'unterminated template literal'
            : 'unterminated string literal',
        };
      }
      push(character === '`' ? 'template' : 'string', index, end);
      index = end;
      continue;
    }

    if (character === '#') {
      if (!isIdentifierStart(next)) return { tokens, error: 'invalid private identifier' };
      const start = index;
      index += 2;
      while (isIdentifierPart(source[index])) index += 1;
      push('privateIdentifier', start, index);
      continue;
    }

    if (isIdentifierStart(character)) {
      const start = index;
      index += 1;
      while (isIdentifierPart(source[index])) index += 1;
      const text = source.slice(start, index);
      const type = /^(?:await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|function|if|import|in|instanceof|let|new|of|return|static|super|switch|this|throw|try|typeof|var|void|while|with|yield)$/.test(text)
        ? 'keyword'
        : 'identifier';
      push(type, start, index);
      continue;
    }

    if (/\d/.test(character) || (character === '.' && /\d/.test(next))) {
      const start = index;
      index += 1;
      while (/[\w.]/.test(source[index] ?? '')) index += 1;
      push('number', start, index);
      continue;
    }

    if (character === '/') {
      const previous = tokens.findLast(token => token.type !== 'comment');
      if (regexAllowed(previous)) {
        const end = readRegex(source, index);
        if (end === -1) return { tokens, error: 'ambiguous or unterminated regular expression' };
        push('regex', index, end);
        index = end;
        continue;
      }
    }

    if (character === '@') return { tokens, error: 'unsupported decorator syntax' };

    const punctuator = PUNCTUATORS.find(value => source.startsWith(value, index))
      ?? character;
    push('punctuator', index, index + punctuator.length);
    index += punctuator.length;
  }

  return { tokens, error: null };
}
