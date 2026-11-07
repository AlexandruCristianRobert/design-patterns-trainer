import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { PyramidStage, type PyrCell, type PyrSpec, type PyrStep } from '../PyramidStage'

const LAYERS: PyrSpec['layers'] = [
  { id: 'e2e', name: 'End-to-end UI', sub: '20 tests', width: 0.42 },
  { id: 'int', name: 'Integration', sub: '200 tests', width: 0.7 },
  { id: 'unit', name: 'Unit', sub: '2,000 tests', width: 1 },
]
const COLUMNS: PyrSpec['columns'] = [
  { id: 'reason', name: 'Reason to keep it small' },
  // what a claim is about comes first; the cost facts its Reality adds follow on the right
  { id: 'finds', name: 'Bugs it finds' },
  { id: 'coverage', name: 'Code coverage' },
  { id: 'checks', name: 'What it checks' },
  { id: 'new', name: 'New information' },
  { id: 'why', name: 'Why the top is small' },
  { id: 'time', name: 'Time per test' },
  { id: 'layer', name: 'Whole layer' },
  { id: 'breaks', name: 'Breaks on unrelated changes' },
  { id: 'points', name: 'A failure points to' },
  { id: 'best', name: 'Best for' },
]
type Col = (typeof COLUMNS)[number]['id']
type Cells = Partial<Record<'e2e' | 'int' | 'unit', Partial<Record<Col, PyrCell>>>>

/** Merges column groups into one step's cells; columns are drawn in COLUMNS order. */
const cells = (...parts: Cells[]): Cells => {
  const out: Cells = {}
  for (const p of parts)
    for (const [layer, c] of Object.entries(p) as [keyof Cells, Partial<Record<Col, PyrCell>>][]) out[layer] = { ...out[layer], ...c }
  return out
}
const col = (id: Col, e2e?: PyrCell, int?: PyrCell, unit?: PyrCell): Cells => ({
  ...(e2e && { e2e: { [id]: e2e } }),
  ...(int && { int: { [id]: int } }),
  ...(unit && { unit: { [id]: unit } }),
})
const spec = (steps: Record<string, Cells>): PyrSpec => ({
  layers: LAYERS,
  columns: COLUMNS,
  steps: Object.fromEntries(Object.entries(steps).map(([id, c]) => [id, { cells: c } satisfies PyrStep])),
})

// ---- The facts each Reality draws from ----
const TIME = col('time', { text: '~30 s', kind: 'bad' }, { text: '~0.5 s' }, { text: '~5 ms', kind: 'ok' })
/** Whole-layer run time on one linear scale: 600 s, 100 s, 10 s. */
const LAYER = col('layer', { text: '~10 min', kind: 'bad', bar: 1 }, { text: '~100 s', bar: 100 / 600 }, { text: '~10 s', kind: 'ok', bar: 10 / 600 })
const BREAKS = col('breaks', { text: 'often: layout, test data, timing', kind: 'bad' }, { text: 'sometimes' }, { text: 'rarely', kind: 'ok' })
const POINTS = col('points', { text: 'any layer, UI to config', kind: 'bad' }, { text: 'a few components' }, { text: 'one method', kind: 'ok' })
const BEST = col('best', { text: 'proving the parts are wired', kind: 'ok' }, { text: 'components with a real database' }, { text: 'detailed behaviour', kind: 'ok' })
const COST = cells(TIME, BREAKS)

const SPECS: Record<string, PyrSpec> = {
  setup: spec({
    layers: {},
    question: col('reason', { text: '?', kind: 'muted' }),
  }),
  'cost-feedback': spec({
    time: TIME,
    layer: cells(TIME, LAYER),
    brittle: cells(TIME, LAYER, BREAKS),
    diagnose: cells(TIME, LAYER, BREAKS, POINTS),
    'keep-few': cells(TIME, LAYER, BREAKS, POINTS, BEST),
  }),

  'fewer-bugs-claim': spec({
    finds: col('finds', { text: 'fewer: the layers hide defects' }, { text: 'some' }, { text: 'more real bugs' }),
    why: cells(
      col('finds', { text: 'fewer: the layers hide defects' }, { text: 'some' }, { text: 'more real bugs' }),
      col('why', { text: 'it finds less' }),
    ),
  }),
  'fewer-bugs-reality': spec({
    finds: col('finds', { text: 'wiring and config bugs unit tests miss', kind: 'ok' }, { text: 'bugs between components' }, { text: 'logic bugs in one unit' }),
    why: cells(
      col('finds', { text: 'wiring and config bugs unit tests miss', kind: 'ok' }, { text: 'bugs between components' }, { text: 'logic bugs in one unit' }),
      COST,
    ),
  }),

  'coverage-claim': spec({
    coverage: col('coverage', { text: 'cannot be measured' }, { text: 'measured' }, { text: 'measured' }),
    why: cells(col('coverage', { text: 'cannot be measured' }, { text: 'measured' }, { text: 'measured' }), col('why', { text: 'completeness unknown' })),
  }),
  'coverage-reality': spec({
    coverage: col('coverage', { text: 'can be collected too', kind: 'ok' }, { text: 'measured' }, { text: 'measured' }),
    why: cells(col('coverage', { text: 'can be collected too', kind: 'ok' }, { text: 'measured' }, { text: 'measured' }), COST),
  }),

  'duplicate-claim': spec({
    checks: col('checks', { text: "the unit tests' checks, line for line" }, { text: '–', kind: 'muted' }, { text: 'each rule, in one class' }),
    new: cells(
      col('checks', { text: "the unit tests' checks, line for line" }, { text: '–', kind: 'muted' }, { text: 'each rule, in one class' }),
      col('new', { text: 'none' }),
    ),
  }),
  'duplicate-reality': spec({
    checks: col('checks', { text: 'UI, API, database and config together', kind: 'ok' }, { text: 'a few components together' }, { text: 'each rule, in one class' }),
    new: cells(
      col('checks', { text: 'UI, API, database and config together', kind: 'ok' }, { text: 'a few components together' }, { text: 'each rule, in one class' }),
      col('new', { text: 'the real wiring', kind: 'ok' }),
    ),
    cost: cells(
      col('checks', { text: 'UI, API, database and config together', kind: 'ok' }, { text: 'a few components together' }, { text: 'each rule, in one class' }),
      col('new', { text: 'the real wiring', kind: 'ok' }),
      COST,
    ),
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <PyramidStage spec={s} {...p} />]),
)
export default drawing
