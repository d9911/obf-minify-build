const RAW_TEXT_ELEMENTS = new Set(['pre', 'textarea', 'script', 'style']);
const BLOCK_ELEMENTS = new Set([
  'address', 'article', 'aside', 'blockquote', 'body', 'div', 'dl', 'fieldset',
  'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header',
  'hr', 'html', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul',
]);

function readTag(source, start, relativePath) {
  let quote = '';

  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote && source[index - 1] !== '\\') quote = '';
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '>') {
      const text = source.slice(start, index + 1);
      const match = text.match(/^<\s*(\/?)\s*([a-z][\w:-]*)/i);
      return {
        end: index + 1,
        text,
        name: match?.[2]?.toLowerCase() ?? '',
        closing: match?.[1] === '/',
      };
    }
  }

  throw new Error(`${relativePath}: unterminated HTML tag`);
}

function tokenizeHtml(source, relativePath, removeComments) {
  const tokens = [];
  let index = 0;

  while (index < source.length) {
    if (source.startsWith('<!--', index)) {
      const end = source.indexOf('-->', index + 4);
      if (end === -1) {
        throw new Error(`${relativePath}: unterminated HTML comment`);
      }
      const text = source.slice(index, end + 3);
      if (!removeComments || /^<!--\[if\b/i.test(text)) {
        tokens.push({ type: 'raw', text });
      }
      index = end + 3;
      continue;
    }

    if (source[index] === '<') {
      const tag = readTag(source, index, relativePath);
      if (!tag.closing && RAW_TEXT_ELEMENTS.has(tag.name)) {
        const closingPattern = new RegExp(`</\\s*${tag.name}\\s*>`, 'ig');
        closingPattern.lastIndex = tag.end;
        const closing = closingPattern.exec(source);
        if (!closing) {
          throw new Error(`${relativePath}: unterminated <${tag.name}> element`);
        }
        const end = closing.index + closing[0].length;
        tokens.push({
          type: 'raw',
          text: source.slice(index, end),
          name: tag.name,
          closing: false,
          open: tag.text,
          content: source.slice(tag.end, closing.index),
          close: closing[0],
        });
        index = end;
        continue;
      }
      tokens.push({ type: 'tag', ...tag });
      index = tag.end;
      continue;
    }

    const end = source.indexOf('<', index);
    tokens.push({
      type: 'text',
      text: source.slice(index, end === -1 ? source.length : end),
    });
    index = end === -1 ? source.length : end;
  }

  return tokens;
}

function tagIsBlock(token) {
  return token && (token.type === 'tag' || token.type === 'raw')
    && BLOCK_ELEMENTS.has(token.name);
}

export function transformHtml(
  source,
  relativePath = 'HTML input',
  config = { compact: true, removeComments: true },
  handlers = {},
) {
  if (!config.compact && !config.removeComments) return source;
  const tokens = tokenizeHtml(source, relativePath, config.removeComments);

  return tokens.map((token, index) => {
    if (token.type === 'raw' && token.name === 'style' && handlers.css) {
      return `${token.open}${handlers.css(token.content)}${token.close}`;
    }
    if (
      token.type === 'raw'
      && token.name === 'script'
      && handlers.javascript
      && (
        !/\btype\s*=/i.test(token.open)
        || /\btype\s*=\s*["']?(?:module|text\/javascript|application\/javascript)/i
          .test(token.open)
      )
    ) {
      return `${token.open}${handlers.javascript(token.content)}${token.close}`;
    }
    if (token.type !== 'text') return token.text;
    if (!config.compact) return token.text;

    const compact = token.text.replace(/\s+/g, ' ');
    if (compact.trim() === '') {
      return tagIsBlock(tokens[index - 1]) || tagIsBlock(tokens[index + 1])
        ? ''
        : compact ? ' ' : '';
    }
    return compact.trim();
  }).join('');
}
