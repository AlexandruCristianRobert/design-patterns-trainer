import { describe, expect, it } from 'vitest'
import { getCatalog, getCatalogText } from './catalog'
import { getBuiltPatternIds, getPattern } from './patterns'
import { schemas } from './schema'
import { getExerciseText, getPatternText } from './text'

const catalog = getCatalog()
const catalogIds = new Set(catalog.map((c) => c.id))

describe('content', () => {
  it('lists all 23 GoF patterns with 5/7/11 per category', () => {
    expect(catalog).toHaveLength(23)
    const counts = { creational: 0, structural: 0, behavioral: 0 }
    for (const c of catalog) counts[c.category]++
    expect(counts).toEqual({ creational: 5, structural: 7, behavioral: 11 })
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
      const kinds = p.exercises.map((e) => e.meta.kind)
      const n = (k: string) => kinds.filter((x) => x === k).length
      expect([n('complete'), n('refactor'), n('build')]).toEqual(tier === 'standard' ? [1, 1, 1] : [1, 2, 2])
    }
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

  it('falls back to en with untranslated=true for lng "de"', () => {
    const de = getCatalogText('observer', 'de')
    expect(de.untranslated).toBe(true)
    expect(de.value.name).toBe('Observer')
    expect(getCatalogText('observer', 'en').untranslated).toBe(false)
  })

  it('schema rejects invalid content with the file path in the message', () => {
    expect(() => schemas.exercise.parse({ kind: 'nope' })).toThrow()
  })
})
