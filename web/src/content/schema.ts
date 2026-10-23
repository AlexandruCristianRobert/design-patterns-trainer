import { z } from 'zod'
import type { ContractType } from '../compiler/protocol'

const category = z.enum(['creational', 'structural', 'behavioral'])
const tier = z.enum(['standard', 'tricky'])
const exerciseKind = z.enum(['complete', 'refactor', 'build'])
const role = z.enum(['primary', 'contract', 'concrete'])
const range = z.tuple([z.number().int(), z.number().int()])

const catalog = z.strictObject({ id: z.string(), category, tier })
const catalogText = z.strictObject({ name: z.string().min(1), intent: z.string().min(1).max(80) })
const pattern = z.strictObject({
  id: z.string(),
  category,
  tier,
  version: z.number().int(),
  lookalikes: z.array(z.string()),
  exercises: z.array(z.string()),
  examQuestions: z.array(z.string()).default([]),
  roleNames: z.array(z.string()).default([]),
})
const structure = z.strictObject({
  nodes: z.array(
    z.strictObject({
      id: z.string(),
      name: z.string(),
      role,
      stereotype: z.enum(['interface', 'abstract']).optional(),
      members: z.array(z.string()),
      x: z.number(),
      y: z.number(),
      codeLines: range.optional(),
    }),
  ),
  edges: z.array(
    z.strictObject({
      id: z.string(),
      from: z.string(),
      to: z.string(),
      kind: z.enum(['association', 'realization', 'inheritance', 'dependency', 'creates']),
      label: z.string().optional(),
    }),
  ),
})
const scene = z.strictObject({
  actors: z.array(z.strictObject({ id: z.string(), name: z.string(), role })),
  steps: z.array(
    z.strictObject({
      id: z.string(),
      call: z.strictObject({ from: z.string(), to: z.union([z.string(), z.array(z.string())]), label: z.string() }).optional(),
      state: z.record(z.string(), z.record(z.string(), z.string())).optional(),
      code: range.optional(),
    }),
  ),
})
const patternText = z.strictObject({
  intent: z.string(),
  structure: z.record(z.string(), z.string()),
  scene: z.record(z.string(), z.string()),
  lookalikes: z.record(z.string(), z.string()),
})
const contractType: z.ZodType<ContractType> = z.strictObject({
  name: z.string(),
  kind: z.enum(['class', 'abstractClass', 'interface', 'any']),
  members: z.array(z.string()),
})
const exercise = z.strictObject({ kind: exerciseKind, version: z.number().int(), contract: z.strictObject({ types: z.array(contractType) }) })
const exerciseText = z.strictObject({
  title: z.string(),
  scenario: z.string(),
  hints: z.array(z.string()).max(3),
  checks: z.record(z.string(), z.strictObject({ title: z.string(), failures: z.record(z.string(), z.string()).optional() })),
})
const examQuestion = z.strictObject({ version: z.number().int(), contract: z.strictObject({ types: z.array(contractType) }) })
const examQuestionText = z.strictObject({
  title: z.string(),
  scenario: z.string(),
  checks: z.record(z.string(), z.strictObject({ title: z.string(), failures: z.record(z.string(), z.string()).optional() })),
})

export const schemas = { catalog, catalogText, pattern, structure, scene, patternText, exercise, exerciseText, examQuestion, examQuestionText }

export type Category = z.infer<typeof category>
export type Tier = z.infer<typeof tier>
export type ExerciseKind = z.infer<typeof exerciseKind>
export type Role = z.infer<typeof role>
export type CatalogEntry = z.infer<typeof catalog>
export type CatalogText = z.infer<typeof catalogText>
export type PatternMeta = z.infer<typeof pattern>
export type StructureNode = z.infer<typeof structure>['nodes'][number]
export type StructureEdge = z.infer<typeof structure>['edges'][number]
export type Structure = z.infer<typeof structure>
export type SceneActor = z.infer<typeof scene>['actors'][number]
export type SceneStep = z.infer<typeof scene>['steps'][number]
export type SceneScript = z.infer<typeof scene>
export type PatternText = z.infer<typeof patternText>
export type ExerciseMeta = z.infer<typeof exercise>
export type ExerciseText = z.infer<typeof exerciseText>
export type ExamQuestionMeta = z.infer<typeof examQuestion>
export type ExamQuestionText = z.infer<typeof examQuestionText>

/** Parses `data` with `schema`, throwing `Error("<file>: <zod message>")` when invalid. */
export function parseContent<T>(schema: z.ZodType<T>, data: unknown, file: string): T {
  const r = schema.safeParse(data)
  if (!r.success) throw new Error(`${file}: ${r.error.message}`)
  return r.data
}
