function shouldSeparate(previous, next) {
  return (
    previous
    && !/[{(:,;>]/.test(previous)
    && !/[{}:,;>]/.test(next)
  );
}

export function transformCss(
  source,
  relativePath = 'CSS input',
  config = { compact: true, removeComments: true },
) {
  if (!config.compact && !config.removeComments) return source;

  let output = '';
  let quote = '';
  let escaped = false;
  let pendingWhitespace = '';

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (quote) {
      output += character;
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = '';
      }
      continue;
    }

    if (character === '"' || character === "'") {
      if (pendingWhitespace) {
        output += config.compact
          ? shouldSeparate(output.at(-1), character) ? ' ' : ''
          : pendingWhitespace;
      }
      pendingWhitespace = '';
      quote = character;
      output += character;
      continue;
    }

    if (character === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      if (end === -1) {
        throw new Error(`${relativePath}: unterminated CSS comment`);
      }
      const comment = source.slice(index, end + 2);
      if (!config.removeComments || comment.startsWith('/*!')) output += comment;
      index = end + 1;
      if (config.removeComments) pendingWhitespace ||= ' ';
      continue;
    }

    if (/\s/.test(character)) {
      pendingWhitespace += character;
      continue;
    }

    if (pendingWhitespace) {
      output += config.compact
        ? shouldSeparate(output.at(-1), character) ? ' ' : ''
        : pendingWhitespace;
      pendingWhitespace = '';
    }
    output += character;
  }

  if (quote) throw new Error(`${relativePath}: unterminated CSS string`);
  if (pendingWhitespace && !config.compact) output += pendingWhitespace;
  return config.compact ? output.trim().replace(/;}/g, '}') : output;
}
