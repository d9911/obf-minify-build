# Native Transform Engine Design

## Goal

Replace the removed `clean-css`, `html-minifier-terser`, and
`javascript-obfuscator` capabilities with original project code. The published
package must retain zero production dependencies and must not copy or vendor
source code from those packages.

The engine prioritizes executable correctness over compression ratio. When a
JavaScript transformation cannot be proven safe, the original file is emitted
unchanged and an actionable warning is returned.

## Supported Inputs

- HTML and CSS are processed by dedicated state-machine scanners.
- JavaScript targets modern browser syntax through ES2026.
- TypeScript is compiled to JavaScript first through the existing optional
  `typescript` peer.
- JSX and TSX are outside this design.
- Full TypeScript type checking remains the consumer's responsibility through
  `tsc --noEmit`.

“ES2026 support” means that recognized constructs are transformed safely and
unrecognized or ambiguous constructs trigger unchanged-output fallback. It does
not mean that the project implements a complete normative ECMAScript parser.

## Architecture

The transform layer is split by responsibility:

- `lib/transform/html.js`: HTML scanning and conservative whitespace/comment
  removal.
- `lib/transform/css.js`: CSS token scanning and conservative minification.
- `lib/transform/javascript/lexer.js`: JavaScript lexical tokens with exact
  source ranges.
- `lib/transform/javascript/scopes.js`: conservative binding and scope
  analysis.
- `lib/transform/javascript/transform.js`: comment removal, whitespace
  decisions, safe string encoding, local-name replacement, and fallback.
- `lib/transform/config.js`: strict `obfuscator.json` loading and validation.
- `lib/build/transform.js`: resource inlining and compatibility exports only.

Each transform returns:

```js
{
  code: 'transformed source',
  warnings: [],
  transformed: true
}
```

If JavaScript analysis cannot prove safety:

```js
{
  code: originalSource,
  warnings: ['scripts/app.js: transformation skipped: ambiguous regular expression'],
  transformed: false
}
```

The build result collects these warnings in its existing `warnings` array.

## Configuration

`obfuscator.json` is restored as an optional file in the consumer working
directory. Defaults are:

```json
{
  "compact": true,
  "removeComments": true,
  "encodeStrings": true,
  "renameLocals": true
}
```

All four values must be booleans. Unknown keys are rejected to prevent a false
belief that a protection is active.

Legacy options including `controlFlowFlattening`, `deadCodeInjection`,
`selfDefending`, `stringArray`, and `renameGlobals` are rejected with an error
that lists the supported keys. Invalid JSON preserves the parsing error as
`cause`.

## HTML Minification

The HTML scanner distinguishes tags, comments, attributes, quoted attribute
values, raw-text elements, and normal text.

- Ordinary comments are removed when `removeComments` is enabled.
- Conditional comments are preserved.
- Inter-tag whitespace is removed where it cannot change text content.
- Runs of normal text whitespace collapse to one space.
- `pre` and `textarea` content is byte-preserved.
- `script` and `style` content is delegated to the JavaScript and CSS
  transformers when it is inline and locally owned.
- Quoted attributes and template-like text are preserved.
- Unterminated comments, tags, or quoted attributes produce a source-specific
  error instead of partial output.

## CSS Minification

The CSS scanner distinguishes comments, strings, escapes, identifiers, numbers,
functions, URLs, delimiters, and whitespace.

- Comments are removed when configured, except preservation comments beginning
  with `/*!`.
- Whitespace is removed only when adjacent tokens cannot merge or change CSS
  grammar.
- Strings, escapes, custom-property values, URLs, and `calc()` operator spacing
  are preserved.
- A final semicolon immediately before `}` may be removed.
- Unterminated comments or strings produce a source-specific error.

The engine does not reorder declarations, rewrite colors, merge selectors, or
perform semantic optimization in this release.

## JavaScript Lexing and Fallback

The lexer recognizes identifiers, private identifiers, keywords, numeric
literals, string literals, template literals, regular-expression literals,
comments, punctuators, and whitespace. Tokens retain their original text and
source offsets.

Slash interpretation is context-sensitive. If the lexer cannot distinguish a
regular-expression literal from division using the preceding token context, the
entire file falls back unchanged with a warning.

The same fallback applies to:

- direct or indirect `eval`;
- `with`;
- malformed tokens or unterminated literals;
- unsupported decorators, proposals, or syntax forms;
- any binding or reference whose scope cannot be determined;
- a replacement that would create a different token sequence.

Fallback is per JavaScript output file. It does not cancel unrelated files or
the whole build.

## JavaScript Minification

When analysis succeeds:

- removable comments are dropped;
- license comments beginning with `/*!` are retained;
- whitespace is emitted only where token separation, automatic semicolon
  insertion, or readability of required grammar demands it;
- line terminators are preserved around `return`, `throw`, `break`, `continue`,
  `yield`, and `await` where removing them could change parsing;
- no semicolon is inserted or removed unless equivalence is proven.

## Safe String Encoding

Only ordinary string-literal contents are encoded. The quote style and runtime
string value remain unchanged.

Encoding is skipped for:

- directive prologues such as `"use strict"`;
- import/export module specifiers;
- object and class property names;
- labels;
- strings involved in syntax the analyzer cannot classify.

Encoding uses JavaScript escape sequences produced by original project code. It
is obfuscation only, not encryption.

## Local Identifier Renaming

Renaming applies only when the scope analyzer proves a binding and every
reference belong to the same lexical scope.

Eligible bindings:

- function parameters;
- function-local `let`, `const`, and `var`;
- block-local `let` and `const`;
- catch bindings;
- private temporary names created by TypeScript output when safely scoped.

Excluded names:

- globals and top-level bindings;
- imported and exported bindings;
- function and class names visible outside the analyzed local scope;
- property keys and member names;
- labels;
- destructuring bindings until destructuring analysis is explicitly supported;
- any scope containing `eval` or `with`.

Generated names are deterministic, avoid reserved words, do not shadow an
accessible binding, and do not change shorthand properties. If these invariants
cannot all be established, renaming is skipped for that scope or the file falls
back unchanged.

## TypeScript Flow

Selected `.ts` input is compiled through the optional TypeScript peer. The
emitted JavaScript then follows the identical lexer, analysis, minification,
encoding, warning, hashing, and inlining pipeline as `.js` input.

The optional peer remains dynamically loaded only when `.ts` input exists.
JavaScript-only consumers install no TypeScript compiler and no production
dependencies.

## Compatibility

The deprecated CLI/API options `skipObfuscation` and `skipObfuscationFor` remain
accepted during the RC series:

- `skipObfuscation` disables string encoding and local renaming while allowing
  configured minification.
- `skipObfuscationFor` applies the same behavior to matching emitted JavaScript
  paths.

This keeps existing automation working without claiming that old upstream
obfuscator options remain supported.

## Security Boundary

The custom engine must not claim malware resistance, secrecy, encryption, or
equivalence to the removed third-party optimizers. Obfuscation raises the effort
needed to read some output but cannot protect browser-delivered secrets.

Project documentation distinguishes:

- original project implementation;
- optional TypeScript peer code;
- development-only lint/test dependencies;
- generated output;
- verified security checks and unverified claims.

No copied or vendored implementation from the removed packages is permitted.

## Testing

Tests are written before each production behavior and must demonstrate the RED
failure before implementation.

The suite includes:

1. HTML preservation and malformed-input cases.
2. CSS strings, URLs, custom properties, `calc()`, comments, and malformed
   input.
3. JavaScript lexer coverage for modern tokens, templates, regex, private
   fields, optional chaining, nullish operators, modules, classes, async
   functions, generators, and supported ES2026 syntax.
4. Automatic-semicolon-insertion preservation.
5. String value equivalence before and after encoding.
6. Scope and identifier equivalence for every supported binding type.
7. Unchanged-output fallback and warning content for every ambiguity class.
8. TypeScript compilation followed by the native transform.
9. CLI, API, inline, hashing, manifest, and Make regressions.
10. Packed JavaScript-only installation with zero production dependencies.
11. Execution comparison of original and transformed fixtures in isolated Node
    processes where browser APIs are not required.
12. `npm audit`, lint, package inspection, and a repository search proving the
    removed packages are neither runtime dependencies nor vendored source.

The release documentation records exact Node.js and operating-system versions
actually tested. Unavailable platforms remain explicitly unverified.

## Delivery Boundary

This design is implemented incrementally. HTML and CSS scanners, the JavaScript
lexer/minifier, string encoding, and scope-aware renaming are separate reviewable
tasks. A task is not considered complete until its focused tests and the full
regression suite pass.

No push, tag, npm publication, or stable-version promotion is part of this work.
