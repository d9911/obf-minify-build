# obf-minify-build 0.0.5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a release-candidate package whose Node.js API and CLI perform the same complete cross-platform build, with Make as an optional wrapper and verified English/Russian documentation.

**Architecture:** A single asynchronous pipeline in `lib/` validates paths, copies input, transforms HTML/CSS/JavaScript, hashes assets, rewrites references, and returns a structured result. `bin/cli.js` only parses arguments and invokes that API; `Makefile` only delegates to the CLI. Node's built-in test runner exercises the unpacked repository and an installed `npm pack` tarball.

**Tech Stack:** Node.js ESM, `node:test`, `html-minifier-terser`, `clean-css`, `javascript-obfuscator`, npm packaging, optional GNU Make.

## Global Constraints

- Validation releases use `0.0.4-rc.N`; the stable release is `0.0.5`.
- Do not run `npm publish`, `git push`, or any remote-mutating command.
- Preserve the existing accepted changes in `scripts/hash-assets.js` and `src/js/protection.js`.
- Runtime behavior must not depend on Make, `cpio`, `find`, or shell utilities.
- Claims about Node.js versions are made only after verification.
- Tests use operating-system temporary directories and do not remove repository-owned output.

---

### Task 1: Safe test foundation and package metadata

**Files:**
- Create: `test/helpers/project.js`
- Create: `test/cli.test.js`
- Create: `test/api.test.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `createFixture(t, files)` returning `{ root, src, out }`.
- Produces: `runCli(args, options)` returning `{ status, stdout, stderr }`.
- Consumes: current CLI and `build()` API as intentionally failing behavior.

- [ ] **Step 1: Write failing CLI and API tests**

```js
test('help works without loading build dependencies', () => {
  const result = runCli(['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: obf-minify-build/);
});

test('missing source rejects with an actionable error', async () => {
  await assert.rejects(
    build({ src: '/missing/source', out: '/tmp/unused' }),
    /Source directory does not exist/,
  );
});
```

- [ ] **Step 2: Run tests and confirm the current implementation fails**

Run: `node --test test/cli.test.js test/api.test.js`

Expected: FAIL because CLI imports unavailable runtime packages before printing help and `build()` silently accepts a missing source.

- [ ] **Step 3: Correct metadata and test scripts**

Move `clean-css`, `glob`, `html-minifier-terser`, `javascript-obfuscator`, and
`replace-in-file` to `dependencies`; retain lint/test-only tools in
`devDependencies`; add:

```json
{
  "engines": { "node": ">=18" },
  "scripts": {
    "test": "node --test",
    "test:cli": "node --test test/cli.test.js",
    "test:package": "node --test test/package.test.js"
  }
}
```

- [ ] **Step 4: Replace broad generated-output ignores**

Use anchored rules for `/build/`, `/dist/`, `/coverage/`, and temporary test
output. Preserve tracked `.gitkeep` files under fixtures.

- [ ] **Step 5: Install the declared dependency graph**

Run: `npm install`

Expected: lockfile matches `package.json` and installation completes on the active Node.js version.

- [ ] **Step 6: Commit the foundation**

```bash
git add .gitignore package.json package-lock.json test/helpers/project.js test/cli.test.js test/api.test.js
git commit -m "test: add cross-platform package contract"
```

### Task 2: One asynchronous build pipeline

**Files:**
- Create: `lib/build/options.js`
- Create: `lib/build/files.js`
- Create: `lib/build/transform.js`
- Create: `lib/build/references.js`
- Modify: `lib/index.js`
- Extend: `test/api.test.js`

**Interfaces:**
- Produces: `resolveBuildOptions(options)` returning safe absolute paths and normalized flags.
- Produces: `discoverFiles(root)` returning sorted file paths.
- Produces: `transformFile(file, options)` returning transformation metadata.
- Produces: `hashAndRewrite(out, htmlFiles)` returning `Record<string, string>`.
- Produces: `async build(options): Promise<BuildResult>`.

- [ ] **Step 1: Add failing API behavior tests**

Cover successful recursive builds, path names containing spaces, source/output
safety checks, HTML/CSS minification, JavaScript obfuscation, exclusion options,
content hashes, reference rewriting, generated indexes, and structured results.

```js
const result = await build({ src, out, skipObfuscationFor: ['vendor.js'] });
assert.equal(result.sourceDir, src);
assert.equal(result.outputDir, out);
assert.ok(result.files.html >= 1);
assert.match(await readFile(outputHtml, 'utf8'), /app\.[a-f0-9]{8}\.js/);
```

- [ ] **Step 2: Run API tests and verify the expected failures**

Run: `node --test test/api.test.js`

Expected: FAIL on missing validation, incomplete Node-only transformations, and non-async result behavior.

- [ ] **Step 3: Implement path validation and file discovery**

Use `node:path` and `node:fs/promises`; reject missing/non-directory input,
identical paths, and an output directory containing the source directory. Sort
discovery results for deterministic builds.

- [ ] **Step 4: Implement shared transformations**

Minify `.html` with `html-minifier-terser`, minify `.css` with `clean-css`,
obfuscate eligible `.js` with `javascript-obfuscator`, and copy other files
unchanged. Read `obfuscator.json` from the consumer working directory only when
present and valid.

- [ ] **Step 5: Implement deterministic hashing and reference rewriting**

Hash emitted CSS, JavaScript, and supported image assets with SHA-256 truncated
to eight lowercase hexadecimal characters. Rewrite exact local URL path
components while preserving query strings and fragments.

- [ ] **Step 6: Return the structured build result**

```js
return {
  sourceDir,
  outputDir,
  files: { html, css, js, assets, copied },
  manifest,
  warnings,
};
```

- [ ] **Step 7: Run API tests**

Run: `node --test test/api.test.js`

Expected: PASS.

- [ ] **Step 8: Commit the unified engine**

```bash
git add lib/index.js lib/build test/api.test.js
git commit -m "feat: add cross-platform build pipeline"
```

### Task 3: Inline resources on the shared pipeline

**Files:**
- Modify: `lib/build/transform.js`
- Modify: `lib/build/references.js`
- Extend: `test/api.test.js`
- Delete after migration: `lib/modules/discover.js`
- Delete after migration: `lib/modules/processHtml.js`

**Interfaces:**
- Consumes: normalized inline flags from Task 2.
- Produces: inline HTML using the same validation, transform, manifest, warning, and result model.

- [ ] **Step 1: Add failing inline tests**

Test CSS-only, JavaScript-only, combined inline mode, remote/data URL exclusion,
relative references from nested HTML files, skipped JavaScript obfuscation, and
missing local files.

- [ ] **Step 2: Verify failures**

Run: `node --test test/api.test.js --test-name-pattern inline`

Expected: FAIL because the shared pipeline does not yet inline resources.

- [ ] **Step 3: Implement local-reference classification and inlining**

Resolve only local filesystem references relative to each HTML file. Replace
eligible stylesheet links with `<style>` and external scripts with `<script>`.
Record missing local references in `warnings` without treating remote URLs as
missing files.

- [ ] **Step 4: Remove the obsolete second inline implementation**

Delete `lib/modules/discover.js` and `lib/modules/processHtml.js` only after no
runtime import references them.

- [ ] **Step 5: Verify and commit**

Run: `node --test test/api.test.js`

Expected: PASS.

```bash
git add lib/build lib/index.js lib/modules test/api.test.js
git commit -m "feat: unify inline resource builds"
```

### Task 4: Thin, reliable CLI and Make wrapper

**Files:**
- Modify: `bin/cli.js`
- Modify: `Makefile`
- Modify: `config.mk`
- Extend: `test/cli.test.js`
- Create: `test/make.test.js`

**Interfaces:**
- Consumes: `build(options)` from Task 2.
- Produces: exit code `0` for help/version/success and non-zero for invalid input or build failures.

- [ ] **Step 1: Add failing CLI parsing tests**

Cover all documented flags, unknown flags, missing values, `--version`,
deprecated `--no-make`, and propagated build errors.

- [ ] **Step 2: Verify CLI failures**

Run: `node --test test/cli.test.js`

Expected: FAIL for version, unknown-option validation, asynchronous completion, and error output.

- [ ] **Step 3: Parse arguments before importing the engine**

Print help/version immediately. Dynamically import `../lib/index.js` only for a
build, `await build(options)`, and set `process.exitCode = 1` on caught errors.

- [ ] **Step 4: Replace Make's build pipeline with delegation**

```make
.PHONY: all clean test lint
all:
	node bin/cli.js --src "$(SRC_DIR)" --out "$(BUILD_DIR)"
```

Keep maintainer lint/test targets; remove `cpio`, `find`, transformation loops,
and duplicated build options.

- [ ] **Step 5: Test optional Make parity**

Skip only when `make` is unavailable. Otherwise compare the result of `make all`
with a direct CLI build using the same fixture.

- [ ] **Step 6: Verify and commit**

Run: `node --test test/cli.test.js test/make.test.js`

Expected: PASS.

```bash
git add bin/cli.js Makefile config.mk test/cli.test.js test/make.test.js
git commit -m "feat: route cli and make through node engine"
```

### Task 5: Installed-tarball verification

**Files:**
- Create: `test/package.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: output of `npm pack --json`.
- Proves: a clean consumer can install the tarball, invoke the binary, and import the ESM API without repository dev dependencies.

- [ ] **Step 1: Write the failing package-consumer test**

Create a temporary consumer project, run `npm pack --json`, install the resulting
tarball with `npm install --ignore-scripts`, build a fixture through
`node_modules/.bin/obf-minify-build`, and import `obf-minify-build` from a
consumer script.

- [ ] **Step 2: Verify the test detects packaging defects**

Run: `node --test test/package.test.js`

Expected before final metadata correction: FAIL if any runtime dependency or
required runtime file is absent.

- [ ] **Step 3: Correct the `files` allowlist and package metadata**

Include `README.md`, `README.ru.md`, `LICENSE`, `lib/`, `bin/`, optional
`Makefile`, `config.mk`, and `obfuscator.json`. Exclude fixtures, generated
output, lint configuration, and maintainer scripts.

- [ ] **Step 4: Verify tarball contents and consumer behavior**

Run: `npm pack --dry-run`

Expected: only intended runtime and documentation files.

Run: `node --test test/package.test.js`

Expected: PASS.

- [ ] **Step 5: Commit package verification**

```bash
git add package.json package-lock.json test/package.test.js
git commit -m "test: verify installed package behavior"
```

### Task 6: English npm page and Russian translation

**Files:**
- Modify: `README.md`
- Create: `README.ru.md`
- Modify: `docs/README.md`
- Modify: `docs/EXAMPLES.md`
- Modify: `docs/TESTING.md`
- Modify: `docs/TROUBLESHOOTING.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: only CLI/API behavior verified in Tasks 1–5.
- Produces: matching English and Russian user journeys.

- [ ] **Step 1: Rewrite the primary English README**

Add badges with real targets, language switcher, concise value proposition,
install/CLI/API examples, option table, result object, Make wrapper, supported
platforms, security limitation, troubleshooting, and documentation links.

- [ ] **Step 2: Add a complete Russian translation**

Mirror every user-facing section and code example. Use ESM with `await build()`;
do not retain the invalid CommonJS `require()` example.

- [ ] **Step 3: Align detailed documentation**

Remove claims that Make is the primary engine or that obfuscation prevents
reverse engineering. Document release-candidate installation separately from
stable installation.

- [ ] **Step 4: Validate documentation commands**

Run every quick-start command against the local tarball or repository CLI. Search
for stale claims:

```bash
rg -n "require\\(|cpio|uses Makefile|Node\\.js >= 18|prevents.*reverse" README.md README.ru.md docs
```

Expected: no unsupported or obsolete usage claims.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md README.ru.md docs CHANGELOG.md
git commit -m "docs: publish bilingual 0.0.5 guide"
```

### Task 7: Release-candidate quality gate

**Files:**
- Modify only if failures prove a defect in an in-scope file.

**Interfaces:**
- Proves: repository behavior, installed behavior, lint, ignore rules, Make parity, and active runtime compatibility.

- [ ] **Step 1: Run static and behavior checks**

Run:

```bash
npm test
npm run test:cli
make lint
npm pack --dry-run
git diff --check
```

Expected: every command exits `0`.

- [ ] **Step 2: Verify ignore rules**

Run:

```bash
git check-ignore -v build/example dist/example coverage/example npm-debug.log
```

Expected: every generated path matches an intentional rule.

- [ ] **Step 3: Verify supported Node.js versions**

Run the full behavior and package tests on available Node.js 18, 20, and 22
environments. Record exact versions and results. If an environment is unavailable,
state that it is unverified; do not infer support.

- [ ] **Step 4: Inspect final repository state**

Run:

```bash
git status --short
git log --oneline --decorate -10
```

Expected: only deliberately retained user work or explained generated files
remain; all implementation commits are local.

- [ ] **Step 5: Report the release decision**

Report verified commands, exact failures if any, Node matrix evidence, remaining
risks, and whether the code is ready for another `0.0.4-rc.N` validation release.
Do not publish, push, or call `0.0.5` stable until the maintainer approves.
