// Node smoke test for the published WebAssembly bundle.
// Usage (after publishing to web/public/dotnet): node compiler/DesignPatterns.Wasm/smoke.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const dotnetJs = path.resolve(here, '../../web/public/dotnet/wwwroot/_framework/dotnet.js');

const { dotnet } = await import(pathToFileURL(dotnetJs).href);
const t0 = performance.now();
const { getAssemblyExports, getConfig } = await dotnet.create();
const bootMs = performance.now() - t0;

const exports = await getAssemblyExports(getConfig().mainAssemblyName);
const { CompilerExports, RunnerExports } = exports.DesignPatterns.Wasm;

let t = performance.now();
const warm = CompilerExports.WarmUp();
const warmUpMs = performance.now() - t;

t = performance.now();
const compiled = JSON.parse(CompilerExports.Compile(JSON.stringify({
  source: 'Console.WriteLine("Hello from wasm");',
  purpose: 'run',
})));
const compileMs = performance.now() - t;
if (!compiled.success) {
  console.error('Compile failed:', JSON.stringify(compiled.diagnostics));
  process.exit(1);
}

const loaded = RunnerExports.Load(JSON.stringify({ assemblyBase64: compiled.assemblyBase64, source: '' }));
const outcome = await RunnerExports.RunMain();

console.log('WarmUp:', warm);
console.log('Load:', loaded);
console.log('RunOutcome:', outcome);
console.log(`boot ${bootMs.toFixed(0)} ms, warm-up ${warmUpMs.toFixed(0)} ms, first compile ${compileMs.toFixed(0)} ms`);

const ok = JSON.parse(outcome).stdout === 'Hello from wasm\n';
console.log(ok ? 'SMOKE OK' : 'SMOKE FAILED');
process.exit(ok ? 0 : 1);
