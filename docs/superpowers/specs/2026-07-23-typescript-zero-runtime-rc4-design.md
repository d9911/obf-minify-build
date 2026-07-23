# TypeScript and Zero-Runtime Design for 0.0.4-rc.4

## Goal

Release `0.0.4-rc.4` with optional TypeScript input support while ensuring that
installing `obf-minify-build` never installs third-party runtime dependencies.
JavaScript-only projects must continue to build with Node.js alone.

## Dependency Policy

`package.json` must not contain production `dependencies`. Development tools
remain in `devDependencies` and are not installed by package consumers when
development dependencies are omitted.

`typescript` is declared as an optional peer dependency. It is loaded only when
the discovered source contains a selected `.ts` file. A JavaScript-only build
must neither resolve nor require TypeScript.

The package tests enforce these rules:

- `dependencies` is absent or empty;
- `typescript` is listed in `peerDependencies`;
- `typescript` is marked optional in `peerDependenciesMeta`;
- a packed JavaScript-only project installs and builds without optional peers.

## Source Selection

The build engine supports `.ts` files without JSX. `.tsx`, declarations
(`.d.ts`), source maps, project references, and arbitrary `tsconfig.json`
pipelines are outside this release.

Selection operates by relative path and basename:

- `scripts/app.ts` produces the logical output `scripts/app.js`;
- if both `scripts/app.ts` and `scripts/app.js` exist, the TypeScript source wins
  and the JavaScript source is not emitted;
- if only `scripts/app.js` exists, the existing JavaScript path is used;
- `.d.ts` files are not emitted as runtime assets;
- two selected sources must never map to the same output path.

HTML can continue to reference `scripts/app.js`. Inlining, hashing, and manifest
rewriting operate on the emitted `.js` path, regardless of whether its source
was JavaScript or TypeScript.

## TypeScript Loading and Compilation

The TypeScript module is resolved dynamically from the consumer installation.
It is never imported during module initialization or a JavaScript-only build.

When TypeScript input is selected:

1. Resolve the optional `typescript` peer.
2. If unavailable, reject with an actionable error containing
   `npm install --save-dev typescript`.
3. Transpile each selected `.ts` file to browser-oriented JavaScript with
   TypeScript's `transpileModule`.
4. Reject diagnostics categorized as errors and include the source path and
   diagnostic text.
5. Pass the emitted JavaScript through the package's JavaScript transformation
   stage.

Compilation is file-oriented. This release does not perform whole-program type
checking; consumers should run `tsc --noEmit` separately when type checking is
required.

## Built-In Transformations

The current runtime imports of `clean-css`, `html-minifier-terser`, and
`javascript-obfuscator` are removed.

The replacement engine must prioritize correctness over maximum compression:

- HTML: remove comments where safe and collapse whitespace conservatively,
  preserving `pre`, `textarea`, `script`, and `style` content;
- CSS: remove comments and unnecessary whitespace without rewriting values or
  identifiers;
- JavaScript: preserve executable source and apply only transformations that do
  not require parsing;
- assets: retain the existing byte-for-byte copy and SHA-256 filename hashing;
- inlining and HTML reference rewriting: retain existing behavior.

The package will no longer claim strong JavaScript obfuscation. Existing
obfuscator configuration is deprecated for this release, and documentation must
state that minification or name changes are not a security boundary.

## API Result

The existing asynchronous `build(options)` API remains compatible. The `files`
result retains the `js` count, which includes JavaScript emitted from selected
TypeScript sources. The manifest uses emitted paths:

```js
{
  'scripts/app.js': 'scripts/app.0123abcd.js'
}
```

No separate `ts` counter is added in this release.

## CLI and Make

The CLI requires no new flag. TypeScript selection is automatic. The Makefile
continues to delegate to the same Node.js CLI, so API, CLI, and Make behavior
cannot diverge.

CLI errors caused by a missing TypeScript peer or failed transpilation are
printed without an internal stack trace and exit non-zero.

## Documentation and Version

English and Russian documentation must cover:

- automatic `.ts` preference over `.js`;
- installation of the optional TypeScript peer;
- the file-oriented compilation boundary;
- unsupported `.tsx` and `.d.ts` emission;
- the zero-runtime-dependency guarantee;
- the conservative transformation and security limitations.

The changelog records the behavior changes. The package version and lockfile
version become `0.0.4-rc.4`.

## Verification

Tests must demonstrate:

1. JavaScript-only API and CLI builds work without resolving TypeScript.
2. A `.ts` file emits `.js` and HTML references the hashed output.
3. `.ts` wins when matching `.ts` and `.js` files both exist.
4. A missing TypeScript peer produces the documented installation command.
5. Invalid TypeScript produces a source-specific diagnostic.
6. Inline JavaScript works with TypeScript input.
7. Package metadata contains no runtime dependencies.
8. A packed tarball installs and builds in an empty JavaScript consumer.
9. Existing API, CLI, hashing, inline, and Make tests continue to pass.
10. Lint, audit, and `npm pack --dry-run` succeed.

No push, tag, npm publication, or promotion to `latest` is part of this work.
