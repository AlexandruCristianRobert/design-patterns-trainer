// Publishes compiler/DesignPatterns.Wasm into a staging folder, then copies only what the browser loader needs
// (wwwroot/_framework, without the precompressed .br/.gz twins that a static host would not serve) into
// web/public/dotnet/wwwroot/_framework. The path stays the one dotnetBoot.ts expects.
// It then writes web/public/dotnet/ide-manifest.json for the lazy IDE assemblies (ADR 0003).
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const web = join(dirname(fileURLToPath(import.meta.url)), '..')
const project = join(web, '..', 'compiler', 'DesignPatterns.Wasm')
// PublishDir is relative to the project folder; -o breaks on paths with spaces (see the project README).
const stagingRelative = 'bin/publish-staging/'
const staging = join(project, stagingRelative)
const target = join(web, 'public', 'dotnet')
const targetFramework = join(target, 'wwwroot', '_framework')

rmSync(staging, { recursive: true, force: true })
execFileSync('dotnet', ['publish', project, '-c', 'Release', `-p:PublishDir=${stagingRelative}`], { stdio: 'inherit' })

const framework = join(staging, 'wwwroot', '_framework')
if (!existsSync(join(framework, 'dotnet.js'))) throw new Error(`publish produced no ${framework}/dotnet.js`)

rmSync(target, { recursive: true, force: true })
cpSync(framework, targetFramework, {
  recursive: true,
  filter: (src) => !src.endsWith('.br') && !src.endsWith('.gz'),
})
console.log(`Copied ${framework} -> ${targetFramework} (no .br/.gz)`)

// The boot config is embedded in dotnet.js between /*json-start*/ and /*json-end*/. Its resources.lazyAssembly is an
// array of { virtualPath: 'X.wasm', name: 'X.<fingerprint>.wasm', hash } (SDK 10.0.300), one per
// BlazorWebAssemblyLazyLoad item in DesignPatterns.Wasm.csproj.
const dotnetJs = readFileSync(join(targetFramework, 'dotnet.js'), 'utf8')
const start = dotnetJs.indexOf('/*json-start*/')
const end = dotnetJs.indexOf('/*json-end*/')
if (start < 0 || end < 0) throw new Error('dotnet.js has no embedded boot config (/*json-start*/ ... /*json-end*/)')
const lazy = JSON.parse(dotnetJs.slice(start + '/*json-start*/'.length, end)).resources?.lazyAssembly
if (!Array.isArray(lazy) || lazy.length === 0) throw new Error('the boot config lists no lazyAssembly array')

const assemblies = lazy.map((a) => a.name)
// The download size the "Enable IDE features" button shows: gzip, because GitHub Pages serves gzip, not Brotli.
const bytes = assemblies.reduce((sum, name) => sum + gzipSync(readFileSync(join(targetFramework, name)), { level: 9 }).length, 0)
writeFileSync(join(target, 'ide-manifest.json'), JSON.stringify({ assemblies, bytes }, null, 2) + '\n')
console.log(`Wrote ide-manifest.json: ${assemblies.length} lazy assemblies, ${bytes} B gzip-9`)
