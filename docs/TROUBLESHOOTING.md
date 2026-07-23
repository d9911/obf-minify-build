# Troubleshooting

## `ERR_MODULE_NOT_FOUND`

Install the package normally rather than copying `lib/` or `bin/` by hand:

```bash
npm install --save-dev obf-minify-build
```

The package has no production dependencies. Do not copy individual package files.

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

## TypeScript peer is missing

Install TypeScript in the consuming project:

```bash
npm install --save-dev typescript
```

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

## JavaScript is not obfuscated

The native engine intentionally falls back to unchanged source when syntax or
scope analysis is ambiguous. Inspect `result.warnings`. This behavior prevents a
speculative transformation from breaking executable code.

Basic string encoding and local-name replacement are not protection for secrets.
