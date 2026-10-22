import { parseContent, schemas } from './schema'
import type { ExerciseMeta, PatternMeta, SceneScript, Structure } from './schema'

const yaml = import.meta.glob('../../../content/patterns/*/{pattern,structure,scene}.yaml', { eager: true, import: 'default' })
const exerciseYaml = import.meta.glob('../../../content/patterns/*/exercises/*/exercise.yaml', { eager: true, import: 'default' })
const cs = import.meta.glob('../../../content/patterns/*/{example.cs,exercises/*/{starter,solution,checks}.cs}', {
  eager: true,
  query: '?raw',
  import: 'default',
})

const root = '../../../content/patterns/'

export interface ExerciseContent { id: string; meta: ExerciseMeta; starter: string; solution: string; checks: string }
export interface PatternContent { meta: PatternMeta; example: string; structure: Structure; scene: SceneScript; exercises: ExerciseContent[] }

function raw(path: string): string {
  const v = cs[root + path]
  if (typeof v !== 'string') throw new Error(`${root}${path}: missing file`)
  return v
}

function doc(path: string, files: Record<string, unknown>): unknown {
  if (!(root + path in files)) throw new Error(`${root}${path}: missing file`)
  return files[root + path]
}

export function getBuiltPatternIds(): string[] {
  const ids: string[] = []
  for (const p of Object.keys(yaml)) {
    const m = /\/patterns\/([^/]+)\/pattern\.yaml$/.exec(p)
    if (m) ids.push(m[1])
  }
  return ids
}

const cache = new Map<string, PatternContent>()

export function getPattern(id: string): PatternContent | undefined {
  const hit = cache.get(id)
  if (hit) return hit
  if (!getBuiltPatternIds().includes(id)) return undefined
  const meta = parseContent(schemas.pattern, doc(`${id}/pattern.yaml`, yaml), `${id}/pattern.yaml`)
  const content: PatternContent = {
    meta,
    example: raw(`${id}/example.cs`),
    structure: parseContent(schemas.structure, doc(`${id}/structure.yaml`, yaml), `${id}/structure.yaml`),
    scene: parseContent(schemas.scene, doc(`${id}/scene.yaml`, yaml), `${id}/scene.yaml`),
    exercises: meta.exercises.map((ex) => {
      const base = `${id}/exercises/${ex}/`
      return {
        id: ex,
        meta: parseContent(schemas.exercise, doc(`${base}exercise.yaml`, exerciseYaml), `${base}exercise.yaml`),
        starter: raw(`${base}starter.cs`),
        solution: raw(`${base}solution.cs`),
        checks: raw(`${base}checks.cs`),
      }
    }),
  }
  cache.set(id, content)
  return content
}
