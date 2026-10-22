// Publishes compiler/DesignPatterns.Wasm into a staging folder, then copies only what the browser loader needs
// (wwwroot/_framework, without the precompressed .br/.gz twins that a static host would not serve) into
// web/public/dotnet/wwwroot/_framework. The path stays the one dotnetBoot.ts expects.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const web = join(dirname(fileURLToPath(import.meta.url)), '..')
const project = join(web, '..', 'compiler', 'DesignPatterns.Wasm')
// PublishDir is relative to the project folder; -o breaks on paths with spaces (see the project README).
const stagingRelative = 'bin/publish-staging/'
const staging = join(project, stagingRelative)
const target = join(web, 'public', 'dotnet')

rmSync(staging, { recursive: true, force: true })
execFileSync('dotnet', ['publish', project, '-c', 'Release', `-p:PublishDir=${stagingRelative}`], { stdio: 'inherit' })

const framework = join(staging, 'wwwroot', '_framework')
if (!existsSync(join(framework, 'dotnet.js'))) throw new Error(`publish produced no ${framework}/dotnet.js`)

rmSync(target, { recursive: true, force: true })
cpSync(framework, join(target, 'wwwroot', '_framework'), {
  recursive: true,
  filter: (src) => !src.endsWith('.br') && !src.endsWith('.gz'),
})
console.log(`Copied ${framework} -> ${join(target, 'wwwroot', '_framework')} (no .br/.gz)`)
