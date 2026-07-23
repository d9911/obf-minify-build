# Native Transform Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement original zero-runtime HTML, CSS, and JavaScript transformation code with conservative ES2026 fallback, TypeScript integration, safe string encoding, and local identifier renaming.

**Architecture:** Focused state-machine scanners produce tokens without external parsers. JavaScript transformations operate only on confidently classified tokens and otherwise emit the original file with a warning. The existing build pipeline owns file selection, TypeScript compilation, inlining, hashing, and warning aggregation.

**Tech Stack:** Node.js ESM and built-in modules, optional TypeScript peer, `node:test`.

## Global Constraints

- No production dependencies and no copied or vendored third-party implementation.
- Recognized ES2026 JavaScript is transformed; ambiguous syntax is emitted unchanged with a warning.
- JSX and TSX remain unsupported.
- `obfuscator.json` accepts only `compact`, `removeComments`, `encodeStrings`, and `renameLocals`.
- Strong obfuscation, encryption, control-flow flattening, dead-code injection, and global renaming are out of scope.
- No push, tag, publication, or stable promotion.

---

### Task 1: Strict native transform configuration

**Files:**
- Create: `lib/transform/config.js`
- Create: `test/transform-config.test.js`
- Modify: `lib/index.js`

**Interfaces:**
- Produces: `loadTransformConfig(cwd)` returning four booleans.

- [ ] Write tests for defaults, valid overrides, invalid JSON, non-boolean values, and rejected legacy/unknown keys.
- [ ] Run `node --test test/transform-config.test.js`; expect failures because the module is absent.
- [ ] Implement strict loading with parsing errors preserved as `cause`.
- [ ] Run the focused test; expect all cases to pass.

### Task 2: Native HTML scanner

**Files:**
- Create: `lib/transform/html.js`
- Create: `test/html-transform.test.js`
- Modify: `lib/build/transform.js`

**Interfaces:**
- Produces: `transformHtml(source, relativePath, config)` returning transformed HTML.

- [ ] Write tests for comments, conditional comments, text whitespace, attributes, `pre`, `textarea`, `script`, `style`, and malformed constructs.
- [ ] Run the focused test and verify RED against the current regex implementation.
- [ ] Implement an original state-machine scanner with raw-text preservation and source-specific errors.
- [ ] Run focused and API regression tests; expect all to pass.

### Task 3: Native CSS scanner

**Files:**
- Create: `lib/transform/css.js`
- Create: `test/css-transform.test.js`
- Modify: `lib/build/transform.js`

**Interfaces:**
- Produces: `transformCss(source, relativePath, config)` returning transformed CSS.

- [ ] Write tests for ordinary/license comments, strings, escapes, URLs, custom properties, `calc()`, safe delimiters, and malformed input.
- [ ] Run the focused test and verify RED.
- [ ] Implement an original token-aware state machine that preserves grammar-sensitive spacing.
- [ ] Run focused and API regression tests; expect all to pass.

### Task 4: JavaScript lexer and conservative minifier

**Files:**
- Create: `lib/transform/javascript/lexer.js`
- Create: `lib/transform/javascript/transform.js`
- Create: `test/javascript-transform.test.js`
- Modify: `lib/build/transform.js`

**Interfaces:**
- Produces: `lexJavaScript(source)` token records with `type`, `text`, `start`, `end`, and line-break metadata.
- Produces: `transformJavaScript(source, relativePath, config)` returning `{ code, warnings, transformed }`.

- [ ] Write tests for literals, comments, templates, regex/division, optional chaining, private names, modules, classes, async/generators, and ASI-sensitive keywords.
- [ ] Verify RED because the lexer module is absent.
- [ ] Implement lexing, token-boundary whitespace, license-comment preservation, and unchanged-output fallback.
- [ ] Run focused tests and API regressions.

### Task 5: Safe strings and local identifier renaming

**Files:**
- Create: `lib/transform/javascript/scopes.js`
- Modify: `lib/transform/javascript/transform.js`
- Extend: `test/javascript-transform.test.js`

**Interfaces:**
- Produces: `analyzeScopes(tokens)` returning safe replacement ranges or a fallback reason.

- [ ] Write behavior-equivalence tests for string encoding, parameters, local declarations, nested blocks, catch bindings, properties, exports, destructuring fallback, `eval`, and `with`.
- [ ] Verify RED because strings and names are unchanged.
- [ ] Implement deterministic escape encoding and conservative declaration/reference analysis.
- [ ] Run original and transformed fixtures in isolated Node processes and compare serialized results.

### Task 6: Pipeline integration, documentation, and release verification

**Files:**
- Modify: `lib/index.js`
- Modify: `lib/build/transform.js`
- Add: `obfuscator.json`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `README.ru.md`
- Modify: `docs/README.md`
- Modify: `docs/EXAMPLES.md`
- Modify: `docs/TESTING.md`
- Modify: `docs/TROUBLESHOOTING.md`
- Modify: `CHANGELOG.md`
- Extend: `test/api.test.js`
- Extend: `test/package.test.js`

**Interfaces:**
- Preserves: asynchronous `build(options)` result and CLI/Make behavior.

- [ ] Add failing integration tests for config propagation, warnings, skip compatibility, inline transforms, TypeScript output, and tarball contents.
- [ ] Load configuration once, pass relative paths into transforms, and aggregate warnings.
- [ ] Restore a supported example `obfuscator.json` to the tarball.
- [ ] Document exact supported behavior and security limitations in English and Russian.
- [ ] Run `npm test`, `npm run lint`, `npm audit`, `npm pack --dry-run`, `npm ls --omit=dev --omit=optional --depth=0`, and `git diff --check`.
- [ ] Commit implementation and documentation locally without push.
