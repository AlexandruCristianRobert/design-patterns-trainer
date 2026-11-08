import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type ChipKind, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const GEN = ['[GeneratedRegex(@"^\\d{4}-\\d{2}$")]', 'private static partial Regex Period();']
const COMP = ['private static readonly Regex Period =', '    new(@"^\\d{4}-\\d{2}$", RegexOptions.Compiled);']
const BOTH = [...GEN, '', ...COMP]
const NONBT = [...GEN, '', 'private static readonly Regex Linear =', '    new(@"^\\d{4}-\\d{2}$", RegexOptions.NonBacktracking);']
const THREADS = [...COMP, '', 'Parallel.ForEach(lines, line => Period.IsMatch(line));']

const ROW: Record<string, RowDef> = {
  gen: { id: 'gen', name: 'Generated', sub: 'attribute', tone: 'ui' },
  comp: { id: 'comp', name: 'Compiled', sub: 'RegexOptions', tone: 'pool' },
  build: { id: 'build', name: 'Build', tone: 'muted' },
  start: { id: 'start', name: 'Run time', sub: 'first use', tone: 'pool' },
  match: { id: 'match', name: 'Matching', tone: 'io' },
  aot: { id: 'aot', name: 'Native AOT', sub: 'and trimming', tone: 'muted' },
  engine: { id: 'engine', name: 'Engine', tone: 'io' },
}
const rows = (...ids: string[]) => ids.map((id) => ROW[id])
const LIFE = rows('build', 'start', 'match', 'aot')
const spec = (r: RowDef[], steps: Record<string, RowStep>, code: string[]): RowSpec => ({ rows: r, code, steps })
const chip = (key: string, label: string, kind: ChipKind = 'item'): Chip => ({ key, label, kind })

const PAIR = rows('gen', 'comp')
const G = chip('g', 'Period()')
const C = chip('c', 'new Regex(…, Compiled)')

const C_BUILD = chip('b', 'stores the pattern string')
const C_START = [chip('s1', 'parse pattern', 'run'), chip('s2', 'Reflection.Emit → IL', 'bad')]
const G_BUILD = [chip('b1', 'source generator', 'run'), chip('b2', 'emits C#', 'ok')]
const G_START = [chip('s1', 'no compile step', 'ok'), chip('s2', 'one cached instance', 'ok')]

const SPECS: Record<string, RowSpec> = {
  // ---- Setup: the two declarations, nothing about when or how they turn into code ----
  setup: spec(
    PAIR,
    {
      generated: { rows: { gen: [G] }, line: [0, 1] },
      compiled: { rows: { gen: [G], comp: [C] }, line: [3, 4] },
      ask: { rows: { gen: [G], comp: [C] }, line: null },
    },
    BOTH,
  ),

  compiled: spec(
    LIFE,
    {
      build: { rows: { build: [C_BUILD] }, line: 1 },
      ctor: { rows: { build: [C_BUILD], start: C_START, match: [chip('m', 'emitted IL: fast', 'ok')] }, line: 1 },
      aot: { rows: { build: [C_BUILD], start: C_START, match: [chip('m', 'emitted IL: fast', 'ok')], aot: [chip('a1', 'no Reflection.Emit', 'bad'), chip('a2', 'falls back to interpreter', 'bad')] }, line: 1, bad: true },
    },
    COMP,
  ),
  generated: spec(
    LIFE,
    {
      build: { rows: { build: G_BUILD }, line: [0, 1] },
      run: { rows: { build: G_BUILD, start: G_START, match: [chip('m', 'like Compiled', 'ok')] }, line: 1 },
      aot: { rows: { build: G_BUILD, start: G_START, match: [chip('m', 'like Compiled', 'ok')], aot: [chip('a1', 'works', 'ok')] }, line: [0, 1] },
    },
    GEN,
  ),

  'engine-claim': spec(
    rows('gen', 'engine'),
    {
      engine: { rows: { gen: [G], engine: [chip('e', 'a different engine')] }, line: [0, 1] },
      linear: { rows: { gen: [G], engine: [chip('e', 'a different engine'), chip('l', 'no backtracking, any pattern')] }, line: [0, 1] },
    },
    GEN,
  ),
  'engine-reality': spec(
    rows('gen', 'comp', 'engine'),
    {
      same: { rows: { gen: [G], comp: [chip('c', 'Compiled')], engine: [chip('e', 'same backtracking engine', 'ok')] }, line: [0, 1] },
      option: { rows: { gen: [G], comp: [chip('c', 'NonBacktracking')], engine: [chip('e', 'same backtracking engine', 'ok'), chip('l', 'linear: separate option', 'ok')] }, line: [3, 4] },
    },
    NONBT,
  ),

  'interp-claim': spec(
    rows('gen', 'match'),
    {
      interp: { rows: { gen: [G], match: [chip('i', 'interpreter')] }, line: [0, 1] },
      tradeoff: { rows: { gen: [G], match: [chip('i', 'interpreter'), chip('mem', 'less memory'), chip('slow', 'slower than Compiled')] }, line: [0, 1] },
    },
    GEN,
  ),
  'interp-reality': spec(
    rows('gen', 'build', 'match'),
    {
      code: { rows: { gen: [G], build: [chip('b', 'specialised C# code', 'ok')], match: [chip('i', 'no interpreter call', 'ok')] }, line: [0, 1] },
      speed: { rows: { gen: [G], build: [chip('b', 'specialised C# code', 'ok')], match: [chip('i', 'no interpreter call', 'ok'), chip('s', 'same range as Compiled', 'ok')] }, line: [0, 1] },
    },
    GEN,
  ),

  'threads-claim': spec(
    PAIR,
    {
      compiled: { rows: { comp: [C, chip('t', 'not shareable')] }, line: [0, 1] },
      generated: { rows: { gen: [G, chip('t', 'thread-safe')], comp: [C, chip('t', 'not shareable')] }, line: [0, 1] },
    },
    THREADS,
  ),
  'threads-reality': spec(
    PAIR,
    {
      immutable: { rows: { gen: [G, chip('t', 'immutable, thread-safe', 'ok')], comp: [C, chip('t', 'immutable, thread-safe', 'ok')] }, line: [0, 1] },
      shared: { rows: { gen: [G, chip('t', 'immutable, thread-safe', 'ok')], comp: [C, chip('t', 'immutable, thread-safe', 'ok'), chip('s', 'one static, shared', 'ok')] }, line: 3 },
    },
    THREADS,
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
