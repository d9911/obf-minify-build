# Changelog

## [0.0.4-rc.4] - 2026-07-23

- Add automatic `.ts` to `.js` compilation through an optional TypeScript peer.
- Prefer `.ts` when matching TypeScript and JavaScript sources both exist.
- Remove all third-party production dependencies.
- Replace dependency-backed transforms with conservative built-in transforms.
- Add original JavaScript lexing, minification, string encoding, and
  conservative local identifier renaming.
- Restore a strict four-option `obfuscator.json` for the native engine.
- Remove strong JavaScript obfuscation claims and document the security boundary.
- Keep JavaScript-only builds functional without TypeScript.
- Rewrite hashed static and dynamic ES-module references.
- Rewrite hashed CSS `@import` and `url()` references.
- Add a packed-tarball Chromium E2E test with a realistic Vanilla TypeScript SPA.
- Verify JS-only and missing-TypeScript consumers from the packed artifact.

## [0.0.5] - Unreleased

### Planned stable changes

- Use one asynchronous Node.js build engine for the ESM API and CLI.
- Support builds without required Make, `cpio`, or `find`.
- Keep Make as an optional wrapper around the Node.js CLI.
- Validate source/output paths before recreating output.
- Minify HTML/CSS, preserve JavaScript, hash assets, and rewrite local
  HTML references through one pipeline.
- Add inline CSS/JavaScript support to the shared pipeline.
- Keep the published package free of production dependencies.
- Add clean-tarball consumer tests.
- Publish matching English and Russian documentation.

Validation releases remain in the `0.0.4-rc.N` series until this release is
approved as stable.

## [0.0.4-rc.1] - 2025-09-11

- chore(release): prepare release 0.0.4-rc.1
- docs: add full docs and examples
- fix(cli): pass args to build; make Makefile respect params
- feat(test): add test-all.sh and npm test scripts
- fix(i18n): remove inline translations, restore src/i18n JSON loader
- misc: assets hashing, HTML handling, obfuscator config

Description: `docs/releases/0.0.4-rc.1.md`
