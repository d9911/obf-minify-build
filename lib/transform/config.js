import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_TRANSFORM_CONFIG = Object.freeze({
  compact: true,
  removeComments: true,
  encodeStrings: true,
  renameLocals: true,
});

const SUPPORTED_OPTIONS = new Set(Object.keys(DEFAULT_TRANSFORM_CONFIG));

export async function loadTransformConfig(cwd) {
  let input;

  try {
    input = JSON.parse(
      await readFile(path.join(cwd, 'obfuscator.json'), 'utf8'),
    );
  } catch (error) {
    if (error.code === 'ENOENT') return { ...DEFAULT_TRANSFORM_CONFIG };
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid obfuscator.json: ${error.message}`, {
        cause: error,
      });
    }
    throw error;
  }

  if (!input || Array.isArray(input) || typeof input !== 'object') {
    throw new Error('obfuscator.json must contain a JSON object');
  }

  for (const [key, value] of Object.entries(input)) {
    if (!SUPPORTED_OPTIONS.has(key)) {
      throw new Error(
        `Unsupported obfuscator option: ${key}. Supported options: `
        + [...SUPPORTED_OPTIONS].join(', '),
      );
    }
    if (typeof value !== 'boolean') {
      throw new Error(`Obfuscator option ${key} must be a boolean`);
    }
  }

  return { ...DEFAULT_TRANSFORM_CONFIG, ...input };
}
