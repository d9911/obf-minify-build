# obf-minify-build 0.0.5 Cross-Platform Design

## Purpose

Turn `obf-minify-build` into a package that works immediately after installation
on Windows, macOS, and Linux. The public API and CLI must use one Node.js build
engine. Make remains an optional convenience entry point and must not implement a
second build pipeline.

## Release policy

- Continue validation releases as `0.0.4-rc.N`.
- Publish `0.0.5` only after the release-candidate package passes the complete
  installation and behavior test matrix.
- Do not publish or push as part of this implementation work.
- Keep all release and implementation commits local until the maintainer approves
  the final result.

## Supported interfaces

### JavaScript API

The package is ESM. Consumers use:

```js
import { build } from 'obf-minify-build';

const result = await build({
  src: 'src',
  out: 'dist',
});
```

`build(options)` is asynchronous. It resolves with a structured result containing
the resolved source directory, output directory, processed file counts, and
generated asset manifest. It rejects with an actionable `Error` when the source
directory, configuration, or build input is invalid.

### CLI

The CLI calls the same exported `build()` function and awaits it. It supports:

- `--src <dir>`
- `--out <dir>`
- `--inline-css`
- `--inline-js`
- `--inline-all`
- `--generate-index`
- `--skip-obfuscation`
- `--skip-obfuscation-for <comma-separated-list>`
- `--help`
- `--version`

Unknown options, missing option values, and build failures produce a non-zero exit
code and a concise message on standard error. `--help` and `--version` must work
without reading a source directory.

The existing `--no-make` option remains accepted during the `0.0.5` transition as
a deprecated no-op so existing scripts do not break. The help text explains that
Node.js is now always the build engine.

### Makefile

`make all` invokes the package CLI or a focused Node.js entry point. It must not
use `cpio`, `find`, shell loops, or duplicate minification, obfuscation, hashing,
or reference-rewriting logic.

`make clean` may remain a small platform-oriented maintainer command, but package
users do not need Make to build a project.

## Build pipeline

For every build, the engine:

1. Validates and resolves `src` and `out`.
2. Refuses unsafe layouts, including identical source and output directories or
   an output directory that contains the source directory.
3. Recreates the output directory without modifying the source directory.
4. Copies supported project files while preserving relative paths.
5. Minifies HTML and CSS.
6. Obfuscates JavaScript unless excluded by configuration.
7. Optionally inlines referenced CSS and JavaScript into HTML.
8. Adds content hashes to processed CSS, JavaScript, and supported assets.
9. Rewrites matching local references in every output HTML file.
10. Returns the build result and manifest.

The normal and inline modes share the same discovery, validation, transformation,
and reporting components. Inline mode changes how referenced CSS and JavaScript
are emitted; it does not invoke a separate partial build implementation.

Remote URLs, protocol-relative URLs, fragment-only references, and data URLs are
not treated as local files. Missing local references produce clear diagnostics.

## Package metadata

Runtime imports belong in `dependencies`, not `devDependencies` or required peer
dependencies. Development-only lint and test tools remain in `devDependencies`.

`package.json` declares the verified minimum Node.js version through `engines`.
The target matrix is Node.js 18, 20, and 22. If current runtime dependencies
cannot install and execute on Node.js 18, either compatible dependency versions
must be selected or the declared minimum must be raised and documented. Support
must never be claimed without a successful test.

The package tarball must contain the runtime files, README files, license, and
optional Makefile integration. It must not contain build output, local fixtures,
editor files, logs, or development-only artifacts.

The license identifier in `package.json`, the repository `LICENSE`, and the npm
package documentation must agree before `0.0.5`.

## Ignore policy

`.gitignore` covers:

- `node_modules/`
- `/build/`
- `/dist/`
- `/test-custom/` generated output while retaining intentionally tracked fixture
  placeholders
- coverage and temporary test directories
- npm debug logs and general logs
- operating-system and editor metadata
- local environment files, without ignoring committed example environment files

Ignore rules are verified with `git check-ignore`. Existing tracked fixture files
must not be removed merely because their parent directory contains generated
output.

## Documentation

`README.md` is the primary English npm page. `README.ru.md` is a complete Russian
translation. Both include reciprocal language links and the same verified:

- project purpose and limitations;
- feature list;
- installation instructions;
- CLI quick start and complete option reference;
- ESM API example and result/error behavior;
- optional Makefile usage;
- input/output example;
- supported Node.js and operating-system matrix;
- security note explaining that obfuscation is not encryption or a guarantee
  against reverse engineering;
- troubleshooting guidance;
- links to detailed documentation, changelog, license, issues, and repository.

Detailed files under `docs/` are updated to match actual `0.0.5` behavior. Claims
that are not covered by tests are removed or explicitly marked as limitations.

## Testing

Tests use temporary directories and never delete repository-owned `dist/`,
`build/`, or fixture content. Automated coverage includes:

1. CLI help, version, validation errors, and successful builds.
2. Direct ESM API import and asynchronous result/error behavior.
3. Recursive copying and preserved relative paths.
4. HTML and CSS minification.
5. JavaScript obfuscation and exclusion options.
6. Content hashing and HTML reference rewriting.
7. CSS/JavaScript inline modes and missing-reference diagnostics.
8. Generated-index behavior.
9. Paths containing spaces and platform-neutral path handling.
10. `npm pack`, installation into an empty temporary consumer project, CLI
    execution, and API import using only tarball-declared dependencies.
11. Optional Makefile parity with the Node.js CLI where Make is available.

The release candidate is acceptable only when lint, the full test suite, package
tarball inspection, consumer-install smoke tests, and the supported Node.js matrix
all pass. Any unavailable matrix environment is reported as unverified rather
than assumed to pass.

## Compatibility and migration

- ESM remains the supported module format.
- Existing CLI option names remain available for `0.0.5`.
- `--no-make` is deprecated but accepted.
- The old documented CommonJS `require()` example is removed because it does not
  match the package's ESM export.
- Behavior that silently succeeds when the source directory is missing changes
  to an explicit failure.

## Out of scope

- Publishing to npm.
- Pushing branches or commits.
- Adding a graphical interface or hosted website.
- Promising source-code secrecy or cryptographic protection.
- Supporting runtime versions that cannot be verified.
