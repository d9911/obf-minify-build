# Troubleshooting

## `ERR_MODULE_NOT_FOUND`

Install the package normally rather than copying `lib/` or `bin/` by hand:

```bash
npm install --save-dev obf-minify-build
```

Runtime libraries must be installed from the package's `dependencies`. The
tarball consumer test checks this release requirement.

## `Source directory does not exist`

`--src` is resolved from the current working directory:

```bash
pwd
npx obf-minify-build --src ./src --out ./dist
```

## Unsafe source/output error

Choose separate, non-nested directories. These layouts are rejected to prevent
recursive copying or accidental source deletion:

```text
src == out
src/out
out/src
```

## Invalid `obfuscator.json`

Validate JSON syntax first. Then compare its options with the installed
`javascript-obfuscator` version. Remove the file to test the conservative built-in
configuration.

## Missing inline resource

Local missing CSS/JavaScript references are left in HTML and returned in
`result.warnings`. Fix the path relative to the HTML file. Remote, protocol-
relative, fragment, and data URLs are intentionally not opened locally.

## CommonJS `require()` fails

The package is ESM:

```js
import { build } from 'obf-minify-build';
await build();
```

## Make is unavailable

Use the CLI directly. Make is optional:

```bash
npx obf-minify-build --src src --out build
```

## Obfuscated code does not behave correctly

First disable obfuscation to isolate the cause:

```bash
npx obf-minify-build --skip-obfuscation
```

Then use `--skip-obfuscation-for` for incompatible vendor files or reduce
aggressive options in `obfuscator.json`. Obfuscator behavior depends on the input
program and selected upstream options.
