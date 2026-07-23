import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

function loadTypeScript(cwd) {
  const require = createRequire(path.join(cwd, 'package.json'));

  try {
    const packagePath = require.resolve('typescript/package.json');
    return {
      compiler: require('typescript'),
      packageRoot: path.dirname(packagePath),
    };
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        'TypeScript input found, but the optional TypeScript peer is not installed. '
        + 'Run: npm install --save-dev typescript',
        { cause: error },
      );
    }
    throw error;
  }
}

function formatApiDiagnostics(typescript, diagnostics, cwd) {
  return typescript.formatDiagnostics(diagnostics, {
    getCanonicalFileName: fileName => fileName,
    getCurrentDirectory: () => cwd,
    getNewLine: () => '\n',
  }).trim();
}

async function transpileWithCli(source, relativePath, cwd, packageRoot) {
  const temporary = await mkdtemp(path.join(tmpdir(), 'obf-minify-build-ts-'));
  const input = path.join(temporary, 'input.ts');
  const outputDirectory = path.join(temporary, 'output');
  const compiler = path.join(packageRoot, 'bin', 'tsc');

  try {
    await writeFile(input, source);
    await promisify(execFile)(
      process.execPath,
      [
        compiler,
        input,
        '--target', 'ES2020',
        '--module', 'ES2020',
        '--outDir', outputDirectory,
        '--noCheck',
        '--pretty', 'false',
      ],
      { cwd },
    );
    return await readFile(path.join(outputDirectory, 'input.js'), 'utf8');
  } catch (error) {
    const diagnostic = String(error.stderr || error.stdout || error.message).trim();
    throw new Error(
      `Could not compile TypeScript ${relativePath}: ${diagnostic}`,
      { cause: error },
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function transpileTypeScript(source, relativePath, cwd) {
  const { compiler: typescript, packageRoot } = loadTypeScript(cwd);

  if (typeof typescript.transpileModule !== 'function') {
    return transpileWithCli(source, relativePath, cwd, packageRoot);
  }

  const result = typescript.transpileModule(source, {
    fileName: relativePath,
    compilerOptions: {
      module: typescript.ModuleKind.ES2020,
      target: typescript.ScriptTarget.ES2020,
    },
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? [])
    .filter(diagnostic => diagnostic.category === typescript.DiagnosticCategory.Error);

  if (errors.length > 0) {
    const message = formatApiDiagnostics(typescript, errors, cwd);
    throw new Error(`Could not compile TypeScript ${relativePath}: ${message}`);
  }

  return result.outputText;
}
