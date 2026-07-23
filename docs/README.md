# API and configuration

## `build(options)`

```js
import { build } from 'obf-minify-build';

const result = await build(options);
```

`build()` is asynchronous and rejects with an `Error` for invalid input.

| Option               | Type       | Default         | Meaning                                            |
| -------------------- | ---------- | --------------- | -------------------------------------------------- |
| `src`                | `string`   | `"src"`         | Source directory relative to the working directory |
| `out`                | `string`   | `"build"`       | Output directory relative to the working directory |
| `inlineCss`          | `boolean`  | `false`         | Inline local stylesheet references                 |
| `inlineJs`           | `boolean`  | `false`         | Inline local external scripts                      |
| `inlineAll`          | `boolean`  | `false`         | Enable both inline modes                           |
| `generateIndex`      | `boolean`  | `false`         | Create a basic English index when no HTML exists   |
| `skipObfuscation`    | `boolean`  | `false`         | Deprecated compatibility option                    |
| `skipObfuscationFor` | `string[]` | `[]`            | Deprecated compatibility option                    |
| `cwd`                | `string`   | `process.cwd()` | Base for paths and optional peer resolution         |

The result contains absolute directories, file counts, a source-to-output
manifest, and non-fatal warnings. See the primary [README](../README.md) for the
complete shape.

## Safety rules

The source must exist and be a directory. Source and output cannot be equal,
nested inside one another, or arranged so that deleting old output could delete
source files.

The output directory is recreated after validation. The source is never modified.

## Transform order

1. Discover source files.
2. Prefer `.ts` over matching `.js` and compile it to JavaScript.
3. Conservatively transform HTML/CSS and preserve JavaScript.
4. Optionally inline local CSS/JavaScript references.
5. Write output.
6. Hash emitted CSS, JavaScript, and supported images with SHA-256.
7. Rename hashed files and rewrite local `src`/`href` references.

The filename uses the first eight lowercase hexadecimal characters of the
SHA-256 digest.

## Local and remote references

Relative paths are local. `http:`, `https:`, other URI schemes, `//`, `data:`,
and fragment-only references are not opened as files. Missing local references
requested for inlining remain in HTML and are reported in `result.warnings`.

## TypeScript

Install `typescript` as a dev dependency when `.ts` input is used. The compiler
is resolved from `cwd`. `.ts` emits `.js`, while `.tsx`, declaration emission,
project references, source maps, and full type checking are outside this release.

## `obfuscator.json`

The native engine accepts four boolean keys: `compact`, `removeComments`,
`encodeStrings`, and `renameLocals`. Unknown or legacy upstream options stop the
build with an actionable error. Ambiguous JavaScript is emitted unchanged and
reported through `result.warnings`.

## Make

`Makefile` is an optional wrapper around:

```bash
node bin/cli.js --src "$SRC_DIR" --out "$BUILD_DIR"
```

It does not provide a separate build mode.
