# obf-minify-build

<p align="center">
  Zero-runtime-dependency static frontend builds with TypeScript support,
  conservative HTML/CSS minification, inlining, and content-hashed assets.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/obf-minify-build"><img alt="npm version" src="https://img.shields.io/npm/v/obf-minify-build"></a>
  <a href="./LICENSE"><img alt="GPL-3.0-only license" src="https://img.shields.io/badge/license-GPL--3.0--only-blue"></a>
  <img alt="Node.js 18 or newer" src="https://img.shields.io/badge/node-%3E%3D18-339933">
</p>

<p align="center">
  <strong>English</strong> · <a href="./README.ru.md">Русский</a>
</p>

> **Development status:** the cross-platform rewrite is being validated as
> `0.0.4-rc.N`. The first stable release with this architecture will be `0.0.5`.
> npm currently serves the version shown by the badge above.

## Why use it?

`obf-minify-build` turns a directory of static HTML, CSS, JavaScript, images, and
other resources into a deployable build:

- one Node.js engine for the CLI and JavaScript API;
- Windows, macOS, and Linux support without required shell utilities;
- no third-party runtime dependencies;
- conservative HTML and CSS minification;
- native JavaScript minification and safe basic obfuscation;
- optional TypeScript compilation with automatic `.ts` preference;
- optional local CSS and JavaScript inlining;
- content hashes in CSS, JavaScript, and image filenames;
- rewritten local HTML references;
- an optional Makefile wrapper that calls the same Node.js engine.

## Install

Stable channel:

```bash
npm install --save-dev obf-minify-build
```

Release-candidate channel:

```bash
npm install --save-dev obf-minify-build@rc
```

Before a new RC is published, maintainers can test the current checkout:

```bash
npm pack
npm install --save-dev ./obf-minify-build-0.0.4-rc.4.tgz
```

## Quick start

Use this source structure:

```text
src/
├── index.html
├── css/
│   └── app.css
├── js/
│   └── app.js
└── assets/
    └── logo.svg
```

Build it:

```bash
npx obf-minify-build --src src --out dist
```

The build is written to `dist/`. Processed CSS, JavaScript, and supported images
receive eight-character content hashes, and matching HTML references are updated.

### Optional TypeScript

Install TypeScript in projects that contain `.ts` input:

```bash
npm install --save-dev typescript
```

`js/app.ts` is compiled to `js/app.js`. If both `app.ts` and `app.js` exist,
the `.ts` source wins. JavaScript-only projects do not need TypeScript. This
release does not emit `.d.ts`, support `.tsx`, or replace full `tsc --noEmit`
type checking.

## CLI

```text
Usage: obf-minify-build [options]

Options:
  --src <dir>                    Source directory (default: src)
  --out <dir>                    Output directory (default: build)
  --inline-css                   Inline local stylesheets into HTML
  --inline-js                    Inline local scripts into HTML
  --inline-all                   Inline local stylesheets and scripts
  --generate-index               Generate index.html when no HTML exists
  --skip-obfuscation             Deprecated compatibility option (no effect)
  --skip-obfuscation-for <list>  Deprecated compatibility option (no effect)
  --no-make                      Deprecated compatibility option (no effect)
  --version, -v                  Show package version
  --help, -h                     Show help
```

Examples:

```bash
# Default src/ → build/
npx obf-minify-build

# Custom directories
npx obf-minify-build --src website --out public

# Put local CSS and JavaScript inside each HTML document
npx obf-minify-build --inline-all

```

Unknown options, missing option values, invalid paths, and build failures return
a non-zero exit code with an error on standard error.

## JavaScript API

This package is ESM:

```js
import { build } from 'obf-minify-build';

try {
  const result = await build({
    src: 'src',
    out: 'dist',
  });

  console.log(result.outputDir);
  console.log(result.files);
  console.log(result.manifest);
  console.log(result.warnings);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
```

`build()` returns a promise resolving to:

```js
{
  sourceDir: '/absolute/path/to/src',
  outputDir: '/absolute/path/to/dist',
  files: {
    html: 1,
    css: 1,
    js: 1,
    assets: 1,
    copied: 0
  },
  manifest: {
    'css/app.css': 'css/app.a1b2c3d4.css',
    'js/app.js': 'js/app.e5f6a7b8.js'
  },
  warnings: []
}
```

## Dependency policy

The published package has no production `dependencies`. TypeScript is an
optional peer and is loaded only when selected `.ts` files exist. Development
linters and tests are not installed for package consumers.

## Native transform configuration

The transformation engine is original project code and does not copy or vendor
the removed third-party processors. Create `obfuscator.json` in the working
directory to override its defaults:

```json
{
  "compact": true,
  "removeComments": true,
  "encodeStrings": true,
  "renameLocals": true
}
```

Only these boolean options are accepted. JavaScript strings and proven local
bindings may be transformed. Globals, properties, module names, directives, and
ambiguous syntax are preserved. When safety cannot be established, the original
file is emitted with a warning.

## Optional Make wrapper

Make is not required. If it is already part of your workflow:

```bash
make all
make all SRC_DIR=website BUILD_DIR=public
make clean
```

The Makefile delegates to the same Node.js CLI; it does not contain a separate
build implementation.

## Real browser verification

The development test suite installs the exact archive created by `npm pack`
into an isolated consumer project. It builds a multi-module Vanilla TypeScript
SPA and opens the generated output in Chromium:

```bash
# Install the browser once for local development
npx playwright install chromium

# Pack, install, build, serve, and exercise the SPA
npm run test:e2e
```

The test checks static and dynamic ES-module imports, CSS `@import` and `url()`,
hashed images, JSON loading, DOM events, `localStorage`, HTTP responses,
uncaught page errors, and browser console errors. Playwright is a development
dependency and is not a runtime dependency of the published package.

## Requirements and verified support

- Node.js 18 or newer is the declared target.
- Windows, macOS, and Linux are supported by the Node.js implementation.
- Make is optional.

The exact runtime matrix verified for a release is recorded in
[Testing](./docs/TESTING.md). A platform or Node.js version is not considered
verified until its automated tests pass.

## Security scope

JavaScript receives conservative native minification and basic obfuscation, not
strong protection. Minification, TypeScript compilation, and filename hashing
are not security boundaries. Any code,
credentials, or data sent to a browser can ultimately be inspected by the user.
Never place secrets in frontend source code.

Content hashes are primarily cache-busting identifiers; they are not access
control or tamper-proofing.

## Troubleshooting

- **`Source directory does not exist`** — check `--src` relative to the current
  working directory.
- **A local inline resource is missing** — the build finishes and reports the
  unresolved reference in `warnings`.
- **TypeScript peer is not installed** — run
  `npm install --save-dev typescript`.
- **Using `require()` fails** — the package is ESM; use `import` and `await`.

See the full [troubleshooting guide](./docs/TROUBLESHOOTING.md).

## Documentation

- [API and configuration](./docs/README.md)
- [Examples](./docs/EXAMPLES.md)
- [Testing and release checks](./docs/TESTING.md)
- [Troubleshooting](./docs/TROUBLESHOOTING.md)
- [Changelog](./CHANGELOG.md)
- [License](./LICENSE)
- [npm package](https://www.npmjs.com/package/obf-minify-build)
- [Issue tracker](https://github.com/denis991/obf-minify-build/issues)

## License

Licensed under [GNU GPL 3.0](./LICENSE).
