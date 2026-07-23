# Testing and release checks

## Local checks

```bash
npm install
npm test
npm run test:cli
npm run test:e2e
npm run lint
npm pack --dry-run
```

The tests use operating-system temporary directories. They do not delete the
repository's `build/`, `dist/`, or tracked fixture placeholders.

The browser suite requires a local Chromium installation managed by the
development-only Playwright package:

```bash
npx playwright install chromium
npm run test:e2e
```

The E2E suite creates an npm tarball, installs that exact `.tgz` in an isolated
consumer, installs TypeScript from the repository's already resolved
development package, invokes the consumer-local CLI, and serves the output on
an ephemeral loopback port.

## Coverage

- asynchronous API results and failures;
- path validation and directories containing spaces;
- HTML/CSS minification;
- JavaScript preservation and TypeScript-to-JavaScript compilation;
- native JavaScript lexing, minification, string encoding, safe local renaming,
  and unchanged-output fallback;
- content hashing and HTML reference rewriting;
- static and dynamic ES-module hash rewriting;
- CSS `@import` and `url()` hash rewriting;
- inline CSS/JavaScript and missing-reference warnings;
- CLI parsing, help, version, and exit codes;
- optional Make delegation;
- tarball contents, clean installation, CLI execution, and ESM import.
- packed Vanilla TypeScript SPA execution in Chromium;
- JSON fetch, DOM events, `localStorage`, images, computed CSS, HTTP failures,
  uncaught page errors, and browser console errors.

## Runtime matrix

The declared target is Node.js 18, 20, and 22 on Windows, macOS, and Linux. Record
the exact versions and command results for each release candidate. Do not mark an
environment as verified when it was unavailable.

### Local verification on 2026-07-23

| Runtime         | Environment                   | Result                                                       |
| --------------- | ----------------------------- | ------------------------------------------------------------ |
| Node.js 18      | Not available for this RC run | Unverified for `0.0.4-rc.4`                                  |
| Node.js 20.20.2 | macOS, local NVM installation | 49/49 native-engine, API, CLI, TypeScript, and Make tests     |
| Node.js 22.22.3 | macOS, local NVM installation | 51/51 tests, including zero-dependency tarball installation   |
| Node.js 24.18.0 | macOS, local NVM installation | 49/49 native-engine, API, CLI, TypeScript, and Make tests     |

Windows and Linux were not available in this local run and therefore remain
unverified here. The implementation uses Node.js filesystem/path APIs and has no
required shell commands, but that is an architectural property rather than
evidence of a successful Windows or Linux test.

## Release sequence

1. Keep validation builds in the `0.0.4-rc.N` series.
2. Run all checks against the exact `npm pack` tarball.
3. Publish an RC only after maintainer approval.
4. Repeat consumer testing against the published RC.
5. Release stable `0.0.5` only after the matrix and documentation are accepted.

This repository workflow does not automatically publish or push.
