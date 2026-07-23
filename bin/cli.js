#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const HELP = `Usage: obf-minify-build [options]

Build and protect a static frontend project with Node.js.

Options:
  --src <dir>                    Source directory (default: src)
  --out <dir>                    Output directory (default: build)
  --inline-css                   Inline local stylesheets into HTML
  --inline-js                    Inline local scripts into HTML
  --inline-all                   Inline local stylesheets and scripts
  --generate-index               Generate index.html when no HTML exists
  --skip-obfuscation             Do not obfuscate JavaScript
  --skip-obfuscation-for <list>  Comma-separated path fragments to exclude
  --no-make                      Deprecated compatibility option (no effect)
  --version, -v                  Show package version
  --help, -h                     Show this help

Examples:
  npx obf-minify-build
  npx obf-minify-build --src src --out dist
  npx obf-minify-build --inline-all --out dist
`;

const VALUE_OPTIONS = new Map([
  ['--src', 'src'],
  ['--out', 'out'],
  ['--skip-obfuscation-for', 'skipObfuscationFor'],
]);

const BOOLEAN_OPTIONS = new Map([
  ['--inline-css', 'inlineCss'],
  ['--inline-js', 'inlineJs'],
  ['--inline-all', 'inlineAll'],
  ['--generate-index', 'generateIndex'],
  ['--skip-obfuscation', 'skipObfuscation'],
]);

async function packageVersion() {
  const packagePath = fileURLToPath(new URL('../package.json', import.meta.url));
  return JSON.parse(await readFile(packagePath, 'utf8')).version;
}

function parseArguments(args) {
  const options = {};
  let deprecatedNoMake = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (VALUE_OPTIONS.has(argument)) {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a value`);
      }
      const option = VALUE_OPTIONS.get(argument);
      options[option] = option === 'skipObfuscationFor'
        ? value.split(',').map(item => item.trim()).filter(Boolean)
        : value;
      index += 1;
    } else if (BOOLEAN_OPTIONS.has(argument)) {
      options[BOOLEAN_OPTIONS.get(argument)] = true;
    } else if (argument === '--no-make') {
      deprecatedNoMake = true;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  return { options, deprecatedNoMake };
}

async function main(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    return;
  }
  if (args.includes('--version') || args.includes('-v')) {
    console.log(await packageVersion());
    return;
  }

  const { options, deprecatedNoMake } = parseArguments(args);
  if (deprecatedNoMake) {
    console.error('Warning: --no-make is deprecated; Node.js is always the build engine.');
  }

  const { build } = await import('../lib/index.js');
  const result = await build(options);
  const total = Object.values(result.files).reduce((sum, count) => sum + count, 0);
  console.log(`Build complete: ${total} files → ${result.outputDir}`);

  for (const warning of result.warnings) {
    console.error(`Warning: ${warning}`);
  }
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
