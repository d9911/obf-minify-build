# Examples

## npm script

```json
{
  "type": "module",
  "scripts": {
    "build": "obf-minify-build --src src --out dist",
    "build:inline": "obf-minify-build --src src --out dist --inline-all"
  },
  "devDependencies": {
    "obf-minify-build": "^0.0.5",
    "typescript": "^7.0.2"
  }
}
```

`^0.0.5` is appropriate after stable `0.0.5` is published. During validation,
install the explicitly approved `0.0.4-rc.N` or the npm `rc` tag.

## API script

```js
// build.js
import { build } from 'obf-minify-build';

const result = await build({
  src: 'website',
  out: 'public',
});

console.log(`Created ${result.outputDir}`);
```

Run it with:

```bash
node build.js
```

## Inline resources

Given:

```html
<link rel="stylesheet" href="./css/app.css">
<script src="./js/app.js"></script>
```

Run:

```bash
obf-minify-build --inline-all
```

The matching local resources become `<style>` and inline `<script>` elements.
Remote and data URLs remain external.

When `js/app.ts` exists, it is compiled and used for the `js/app.js` reference.
If the project contains only `js/app.js`, TypeScript is not required.

## Native transform options

```json
{
  "compact": true,
  "removeComments": true,
  "encodeStrings": true,
  "renameLocals": true
}
```

Save this as `obfuscator.json` beside the consuming project's `package.json`.

## Make wrapper

```bash
make -f node_modules/obf-minify-build/Makefile \
  SRC_DIR=website \
  BUILD_DIR=public
```

This invokes the installed package's Node.js CLI.
