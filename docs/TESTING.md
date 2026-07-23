# Testing and release checks

## Local checks

```bash
npm install
npm test
npm run test:cli
npm run lint
npm pack --dry-run
```

The tests use operating-system temporary directories. They do not delete the
repository's `build/`, `dist/`, or tracked fixture placeholders.

## Coverage

- asynchronous API results and failures;
- path validation and directories containing spaces;
- HTML/CSS minification;
- JavaScript obfuscation and exclusions;
- content hashing and HTML reference rewriting;
- inline CSS/JavaScript and missing-reference warnings;
- CLI parsing, help, version, and exit codes;
- optional Make delegation;
- tarball contents, clean installation, CLI execution, and ESM import.

## Runtime matrix

The declared target is Node.js 18, 20, and 22 on Windows, macOS, and Linux. Record
the exact versions and command results for each release candidate. Do not mark an
environment as verified when it was unavailable.

### Local verification on 2026-07-23

| Runtime         | Environment                     | Result                                                   |
| --------------- | ------------------------------- | -------------------------------------------------------- |
| Node.js 18.20.8 | macOS, npm-provided Node binary | 17/17 API, CLI, and Make tests passed                    |
| Node.js 20.20.2 | macOS, local NVM installation   | 18/18 tests passed, including clean tarball installation |
| Node.js 22.22.3 | macOS, local NVM installation   | 18/18 tests passed, including clean tarball installation |
| Node.js 24.18.0 | macOS, local NVM installation   | 18/18 tests passed, including clean tarball installation |

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
