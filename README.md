# obf-minify-build

<p align="center">
  Cross-platform static frontend builds with HTML/CSS minification,
  JavaScript obfuscation, resource inlining, and content-hashed assets.
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
- HTML and CSS minification;
- configurable JavaScript obfuscation;
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
npm install --save-dev ./obf-minify-build-0.0.4-rc.3.tgz
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
  --skip-obfuscation             Do not obfuscate JavaScript
  --skip-obfuscation-for <list>  Comma-separated path fragments to exclude
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

# Keep vendor files readable while obfuscating other JavaScript
npx obf-minify-build --skip-obfuscation-for vendor.js,libs/
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
    skipObfuscationFor: ['vendor.js'],
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

## Obfuscator configuration

Create `obfuscator.json` in the directory where the build command runs. Its
contents are passed to
[`javascript-obfuscator`](https://github.com/javascript-obfuscator/javascript-obfuscator).
Without this file, the package uses a conservative built-in configuration.

```json
{
  "compact": true,
  "controlFlowFlattening": false,
  "deadCodeInjection": false,
  "renameGlobals": false,
  "selfDefending": false,
  "stringArray": true,
  "stringArrayThreshold": 0.75
}
```

## Optional Make wrapper

Make is not required. If it is already part of your workflow:

```bash
make all
make all SRC_DIR=website BUILD_DIR=public
make clean
```

The Makefile delegates to the same Node.js CLI; it does not contain a separate
build implementation.

## Requirements and verified support

- Node.js 18 or newer is the declared target.
- Windows, macOS, and Linux are supported by the Node.js implementation.
- Make is optional.

The exact runtime matrix verified for a release is recorded in
[Testing](./docs/TESTING.md). A platform or Node.js version is not considered
verified until its automated tests pass.

## Security scope

Obfuscation can raise the effort required to read generated JavaScript, but it is
not encryption and cannot guarantee secrecy. Any code, credentials, or data sent
to a browser can ultimately be inspected by the user. Never place secrets in
frontend source code.

Content hashes are primarily cache-busting identifiers; they are not access
control or tamper-proofing.

## Troubleshooting

- **`Source directory does not exist`** — check `--src` relative to the current
  working directory.
- **A local inline resource is missing** — the build finishes and reports the
  unresolved reference in `warnings`.
- **`Invalid obfuscator.json`** — validate the file as JSON and confirm that its
  options are supported by the installed `javascript-obfuscator`.
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
