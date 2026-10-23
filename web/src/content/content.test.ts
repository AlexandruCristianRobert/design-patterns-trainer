import { describe, expect, it } from 'vitest'
import { getCatalog, getCatalogText } from './catalog'
import { lessonSectionIds } from './lessons'
import { getBuiltPatternIds, getPattern } from './patterns'
import { parseContent, schemas } from './schema'
import { getExerciseText, getPatternText } from './text'

const lessonSources = import.meta.glob('../../../content/patterns/*/lesson.*.mdx', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const patternYaml = import.meta.glob('../../../content/patterns/*/pattern.yaml', { eager: true, import: 'default' })

const examDirs = Object.keys(
  import.meta.glob('../../../content/patterns/*/exam/*/question.yaml', { eager: true, import: 'default' }),
).map((f) => /\/patterns\/([^/]+)\/exam\/([^/]+)\//.exec(f)!.slice(1, 3).join('/'))

/** What each Tier must ship: Exercise kinds (complete, refactor, build) and Exam Questions. */
const tierNeeds = {
  standard: { kinds: { complete: 1, refactor: 1, build: 1 }, exam: 3 },
  tricky: { kinds: { complete: 1, refactor: 2, build: 2 }, exam: 5 },
} as const

/** Problems with a Pattern's Exercise and Exam Question counts; an empty list means it meets its Tier. Version 0 is a Lesson-only placeholder. */
export function tierCountProblems(
  meta: { tier: 'standard' | 'tricky'; version: number; exercises: string[]; examQuestions: string[] },
  kinds: string[],
): string[] {
  if (meta.version === 0) return []
  const need = tierNeeds[meta.tier]
  const total = Object.values(need.kinds).reduce((a, b) => a + b, 0)
  const problems: string[] = []
  if (meta.exercises.length !== total) problems.push(`needs ${total} exercises, has ${meta.exercises.length}`)
  for (const [kind, count] of Object.entries(need.kinds)) {
    const have = kinds.filter((k) => k === kind).length
    if (have !== count) problems.push(`needs ${count} ${kind} exercises, has ${have}`)
  }
  if (meta.examQuestions.length !== need.exam) problems.push(`needs ${need.exam} exam questions, has ${meta.examQuestions.length}`)
  return problems
}

const catalog = getCatalog()
const catalogIds = new Set(catalog.map((c) => c.id))

describe('content', () => {
  it('lists all 23 GoF patterns with 5/7/11 per category', () => {
    expect(catalog).toHaveLength(23)
    const counts = { creational: 0, structural: 0, behavioral: 0 }
    for (const c of catalog) counts[c.category]++
    expect(counts).toEqual({ creational: 5, structural: 7, behavioral: 11 })
  })

  it('catalog ids are unique', () => {
    expect(catalogIds.size).toBe(catalog.length)
  })

  it('every catalog entry has an en name and intent ≤ 80 chars', () => {
    for (const c of catalog) {
      const { value } = getCatalogText(c.id, 'en')
      expect(value.name, c.id).not.toBe('')
      expect(value.intent.length, c.id).toBeGreaterThan(0)
      expect(value.intent.length, c.id).toBeLessThanOrEqual(80)
    }
  })

  it('marks only patterns with a pattern.yaml as built', () => {
    const built = catalog.filter((c) => c.built).map((c) => c.id)
    expect(built.sort()).toEqual([...getBuiltPatternIds()].sort())
    for (const id of getBuiltPatternIds()) expect(catalogIds.has(id), id).toBe(true)
  })

  it('every built pattern: tier matches catalog, exercise count matches tier and kinds', () => {
    for (const id of getBuiltPatternIds()) {
      const p = getPattern(id)!
      const tier = catalog.find((c) => c.id === id)!.tier
      expect(p.meta.tier).toBe(tier)
      expect(p.meta.id).toBe(id)
      expect(p.meta.category).toBe(catalog.find((c) => c.id === id)!.category)
      // A Lesson-only placeholder (version 0) has no Exercises yet; the Tier-count test below covers finished Patterns.
      if (p.meta.version === 0) continue
      const kinds = p.exercises.map((e) => e.meta.kind)
      const n = (k: string) => kinds.filter((x) => x === k).length
      expect([n('complete'), n('refactor'), n('build')]).toEqual(tier === 'standard' ? [1, 1, 1] : [1, 2, 2])
    }
  })

  it('every finished pattern ships the exercises and exam questions its Tier requires', () => {
    expect(getBuiltPatternIds()).toContain('observer')
    let checked = 0
    for (const id of getBuiltPatternIds()) {
      // Lesson-only placeholders (version 0) may list ids that do not exist yet; getPattern would throw on them.
      if ((patternYaml[`../../../content/patterns/${id}/pattern.yaml`] as { version: number }).version === 0) continue
      const p = getPattern(id)!
      checked++
      expect(tierCountProblems(p.meta, p.exercises.map((e) => e.meta.kind)), id).toEqual([])
      for (const ex of p.meta.exercises) expect(p.exercises.some((e) => e.id === ex), `${id}/${ex}`).toBe(true)
      for (const q of p.meta.examQuestions) expect(examDirs, `${id}/${q}`).toContain(`${id}/${q}`)
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('counts a short Tricky pattern as missing exercises and questions, and skips version 0', () => {
    const short = { tier: 'tricky' as const, version: 1, exercises: ['a', 'b', 'c'], examQuestions: ['q1', 'q2', 'q3'] }
    expect(tierCountProblems(short, ['complete', 'refactor', 'build'])).toEqual([
      'needs 5 exercises, has 3',
      'needs 2 refactor exercises, has 1',
      'needs 2 build exercises, has 1',
      'needs 5 exam questions, has 3',
    ])
    expect(tierCountProblems({ ...short, version: 0 }, [])).toEqual([])
    const full = { tier: 'standard' as const, version: 1, exercises: ['a', 'b', 'c'], examQuestions: ['q1', 'q2', 'q3'] }
    expect(tierCountProblems(full, ['complete', 'refactor', 'build'])).toEqual([])
  })

  it('every built pattern: structure edges reference existing nodes; scene calls reference existing actors; every scene step id and structure node id has text', () => {
    for (const id of getBuiltPatternIds()) {
      const p = getPattern(id)!
      const text = getPatternText(id, 'en').value
      const nodes = new Set(p.structure.nodes.map((n) => n.id))
      for (const e of p.structure.edges) {
        expect(nodes.has(e.from), e.id).toBe(true)
        expect(nodes.has(e.to), e.id).toBe(true)
      }
      const actors = new Set(p.scene.actors.map((a) => a.id))
      for (const s of p.scene.steps) {
        if (s.call) for (const a of [s.call.from, ...[s.call.to].flat()]) expect(actors.has(a), s.id).toBe(true)
        expect(text.scene[s.id], s.id).toBeTruthy()
      }
      for (const n of nodes) expect(text.structure[n], n).toBeTruthy()
    }
  })

  it('every built pattern: each lookalike is a catalog id and has a text.lookalikes entry', () => {
    for (const id of getBuiltPatternIds()) {
      const text = getPatternText(id, 'en').value
      for (const l of getPattern(id)!.meta.lookalikes) {
        expect(catalogIds.has(l), l).toBe(true)
        expect(text.lookalikes[l], l).toBeTruthy()
      }
    }
  })

  it('every built exercise: ≤ 3 hints, non-empty title and scenario', () => {
    for (const id of getBuiltPatternIds()) {
      for (const e of getPattern(id)!.exercises) {
        const t = getExerciseText(id, e.id, 'en').value
        expect(t.hints.length).toBeLessThanOrEqual(3)
        expect(t.title).not.toBe('')
        expect(t.scenario).not.toBe('')
      }
    }
  })

  it('every built pattern has an en lesson; every lesson has exactly the six Sections in order', () => {
    for (const id of getBuiltPatternIds()) expect(`../../../content/patterns/${id}/lesson.en.mdx` in lessonSources, id).toBe(true)
    for (const [file, source] of Object.entries(lessonSources)) {
      expect(typeof source, file).toBe('string')
      const ids = [...source.matchAll(/<Section\s+id="([^"]*)"\s*>/g)].map((m) => m[1])
      expect(ids, file).toEqual([...lessonSectionIds])
      expect(source.match(/<Section[\s>]/g)?.length, file).toBe(6)
    }
  })

  it('falls back to en with untranslated=true for lng "de"', () => {
    const de = getCatalogText('observer', 'de')
    expect(de.untranslated).toBe(true)
    expect(de.value.name).toBe('Observer')
    expect(getCatalogText('observer', 'en').untranslated).toBe(false)
  })

  it('schema rejects invalid content with the file path in the message', () => {
    expect(() => parseContent(schemas.exercise, { kind: 'nope' }, 'x/exercise.yaml')).toThrow("x/exercise.yaml: ")
  })

  it('schema rejects unknown keys', () => {
    const text = { title: 't', scenario: 's', hints: [], checks: {}, hint: 'typo' }
    expect(() => parseContent(schemas.exerciseText, text, 'x/text.en.yaml')).toThrow("x/text.en.yaml: ")
  })
})
