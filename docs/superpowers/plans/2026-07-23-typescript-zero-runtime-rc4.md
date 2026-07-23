# TypeScript Zero-Runtime RC4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic `.ts` to `.js` compilation through an optional TypeScript peer and remove all production dependencies for `0.0.4-rc.4`.

**Architecture:** The file-discovery stage maps source paths to emitted paths and gives `.ts` precedence over matching `.js`. A focused TypeScript adapter dynamically resolves the consumer's optional peer only when required. Built-in conservative HTML/CSS/JavaScript transforms replace production third-party processors while hashing, inlining, CLI, API, and Make continue through the existing pipeline.

**Tech Stack:** Node.js ESM and built-in modules, optional `typescript` peer, `node:test`, npm packaging.

## Global Constraints

- `package.json` has no production `dependencies`.
- `typescript` is an optional peer and is not loaded for JavaScript-only builds.
- `.ts` emits `.js`; matching `.ts` takes precedence over `.js`.
- `.tsx`, `.d.ts` emission, source maps, project references, and full type checking are out of scope.
- Version is `0.0.4-rc.4`.
- No push, tag, npm publication, or `latest` promotion.

---

### Task 1: Enforce zero-runtime package metadata

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `test/package.test.js`

**Interfaces:**
- Produces: optional peer metadata consumed by the TypeScript adapter.

- [ ] **Step 1: Write the failing metadata assertions**

Add assertions that `dependencies` is absent or empty, `peerDependencies.typescript`
is declared, `peerDependenciesMeta.typescript.optional` is `true`, and the
version is `0.0.4-rc.4`.

- [ ] **Step 2: Verify RED**

Run: `node --test test/package.test.js`

Expected: FAIL because production dependencies remain and peer metadata is absent.

- [ ] **Step 3: Update package metadata**

Remove `dependencies`, add:

```json
"peerDependencies": {
  "typescript": ">=5.0.0"
},
"peerDependenciesMeta": {
  "typescript": {
    "optional": true
  }
}
```

Set the package and lockfile versions to `0.0.4-rc.4`, then run `npm install
--package-lock-only`.

- [ ] **Step 4: Verify GREEN**

Run: `node --test test/package.test.js`

Expected: PASS.

### Task 2: Select TypeScript sources and emit JavaScript paths

**Files:**
- Create: `lib/build/sources.js`
- Modify: `lib/index.js`
- Test: `test/api.test.js`

**Interfaces:**
- Produces: `selectSources(relativePaths)` returning entries shaped as
  `{ sourcePath, outputPath, kind }`.

- [ ] **Step 1: Write failing API tests**

Cover a lone `scripts/app.ts`, matching `scripts/app.ts` plus `scripts/app.js`,
and ignored `.d.ts`. Assert the logical manifest key is `scripts/app.js`.

- [ ] **Step 2: Verify RED**

Run: `node --test test/api.test.js --test-name-pattern TypeScript`

Expected: FAIL because `.ts` is copied and no JavaScript output is emitted.

- [ ] **Step 3: Implement selection**

Normalize extensions case-insensitively, map `.ts` to `.js`, skip `.d.ts`, and
replace a selected `.js` entry when the matching `.ts` exists. Pass source and
output paths separately through the build loop.

- [ ] **Step 4: Verify selection behavior**

Run: `node --test test/api.test.js --test-name-pattern TypeScript`

Expected: tests progress to the missing TypeScript peer error.

### Task 3: Compile through the optional TypeScript peer

**Files:**
- Create: `lib/build/typescript.js`
- Modify: `lib/index.js`
- Test: `test/api.test.js`
- Test: `test/cli.test.js`

**Interfaces:**
- Produces: `transpileTypeScript(source, relativePath, cwd)` returning emitted
  JavaScript text or rejecting with an actionable `Error`.

- [ ] **Step 1: Write failing behavior tests**

Test successful transpilation with type syntax, `.ts` preference, inline output,
source-specific diagnostics, and a CLI missing-peer message containing:

```text
npm install --save-dev typescript
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/api.test.js test/cli.test.js --test-name-pattern TypeScript`

Expected: FAIL because no adapter exists.

- [ ] **Step 3: Implement dynamic peer loading**

Use `createRequire(path.join(cwd, 'package.json'))` to resolve TypeScript from the
consumer. Call `transpileModule` with ES2020 module/target settings and
`reportDiagnostics: true`. Format error diagnostics with the source path.

- [ ] **Step 4: Verify GREEN**

Run: `node --test test/api.test.js test/cli.test.js --test-name-pattern TypeScript`

Expected: PASS.

### Task 4: Replace production transforms with built-in conservative transforms

**Files:**
- Modify: `lib/build/transform.js`
- Modify: `lib/build/references.js`
- Modify: `lib/index.js`
- Test: `test/api.test.js`

**Interfaces:**
- Retains: `transformHtml`, `transformCss`, `transformJavaScript`,
  `inlineResources`, and `isRemoteReference`.

- [ ] **Step 1: Add preservation tests**

Test that HTML preformatted content, CSS quoted values, and executable JavaScript
survive transformation while comments and safe surrounding whitespace shrink.

- [ ] **Step 2: Verify RED against old dependency-backed behavior**

Run: `node --test test/api.test.js --test-name-pattern conservative`

Expected: at least one preservation assertion fails.

- [ ] **Step 3: Implement dependency-free transforms**

Remove third-party imports. Use state-aware scanning for HTML comments and
whitespace, state-aware CSS comment/whitespace handling, and preserve JavaScript
source text unchanged except for a final newline policy. Remove obfuscator
configuration loading from the pipeline.

- [ ] **Step 4: Verify GREEN and regressions**

Run: `node --test test/api.test.js`

Expected: PASS.

### Task 5: Documentation, packaging, and complete verification

**Files:**
- Modify: `README.md`
- Modify: `README.ru.md`
- Modify: `docs/README.md`
- Modify: `docs/EXAMPLES.md`
- Modify: `docs/TESTING.md`
- Modify: `docs/TROUBLESHOOTING.md`
- Modify: `CHANGELOG.md`
- Modify: `test/package.test.js`

**Interfaces:**
- Documents the finalized CLI/API contract and security boundary.

- [ ] **Step 1: Update English and Russian documentation**

Document automatic selection, optional peer installation, unsupported TS
features, zero runtime dependencies, and the absence of strong obfuscation.

- [ ] **Step 2: Strengthen tarball consumer tests**

Install the packed package using `--omit=optional`, assert no production packages
are added, then run JavaScript API and CLI smoke builds.

- [ ] **Step 3: Run complete verification**

Run:

```bash
npm test
npm run lint
npm audit
npm pack --dry-run
git diff --check
```

Expected: every command exits zero, all tests pass, audit reports zero known
vulnerabilities, and the tarball contains only intended files.

- [ ] **Step 4: Create local thematic commits**

Commit implementation and documentation locally. Do not push, tag, or publish.
