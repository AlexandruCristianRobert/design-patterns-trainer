import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const CODE = ['var first = new[] { 1, 1, 2, 3 };', 'var second = new[] { 3 };', 'var result = first.Except(second);']
const L = { INPUTS: [0, 1] as [number, number], CALL: 2 }
const EXCEPT = [
  '// Enumerable.Except, simplified',
  'var set = new HashSet<int>(second);',
  'foreach (var x in first)',
  '    if (set.Add(x))',
  '        yield return x;',
]
const E = { SET: 1, ADD: [2, 3] as [number, number], YIELD: [2, 4] as [number, number] }
const WHERE = ['var exclude = new HashSet<int>(second);', 'var result = first.Where(', '    x => !exclude.Contains(x));']
const W = { SET: 0, FILTER: [1, 2] as [number, number] }

const ROW = {
  first: { id: 'first', name: 'first', tone: 'ui' },
  second: { id: 'second', name: 'second', tone: 'pool' },
  set: { id: 'set', name: 'set', sub: 'HashSet<int>', tone: 'io' },
  exclude: { id: 'set', name: 'exclude', sub: 'HashSet<int>', tone: 'io' },
  result: { id: 'result', name: 'Result', tone: 'muted' },
} satisfies Record<string, RowDef>

type K = Chip['kind']
const c = (key: string, label: string, kind: K = 'run'): Chip => ({ key, label, kind })
const FIRST = [1, 1, 2, 3]
/** The first array; kinds per element (run: not looked at yet). */
const first = (...kinds: K[]) => FIRST.map((v, i) => c(`f${i}`, String(v), kinds[i] ?? 'run'))
const SECOND = [c('s0', '3', 'run')]
const set = (...vals: number[]) => vals.map((v) => c(`set${v}`, String(v), 'run'))
const result = (...vals: [number, K?][]) => vals.map(([v, k], i) => c(`r${i}`, String(v), k ?? 'ok'))

const spec = (rows: RowDef[], code: string[], steps: Record<string, RowStep>): RowSpec => ({ rows, code, steps })
const IO = [ROW.first, ROW.second, ROW.result]

const SPECS: Record<string, RowSpec> = {
  setup: spec(IO, CODE, {
    inputs: { rows: { first: first(), second: SECOND }, line: L.INPUTS },
    call: { rows: { first: first(), second: SECOND, result: [c('q', '?', 'wait')] }, line: L.CALL },
  }),

  except: spec([ROW.first, ROW.second, ROW.set, ROW.result], EXCEPT, {
    build: { rows: { first: first(), second: SECOND, set: set(3) }, line: E.SET },
    'first-one': { rows: { first: first('ok'), second: SECOND, set: set(3, 1), result: result([1]) }, line: E.YIELD },
    'second-one': { rows: { first: first('ok', 'gone'), second: SECOND, set: set(3, 1), result: [...result([1]), c('skip', 'skipped: duplicate', 'gone')] }, line: E.ADD },
    two: { rows: { first: first('ok', 'gone', 'ok'), second: SECOND, set: set(3, 1, 2), result: result([1], [2]) }, line: E.YIELD },
    three: { rows: { first: first('ok', 'gone', 'ok', 'gone'), second: SECOND, set: set(3, 1, 2), result: result([1], [2]) }, line: E.ADD },
  }),
  where: spec([ROW.first, ROW.second, ROW.exclude, ROW.result], WHERE, {
    build: { rows: { first: first(), second: SECOND, set: set(3) }, line: W.SET },
    filter: { rows: { first: first('ok', 'ok', 'ok', 'gone'), second: SECOND, set: set(3), result: result([1], [1], [2]) }, line: W.FILTER },
  }),

  'filter-claim': spec(IO, CODE, {
    inputs: { rows: { first: first(), second: SECOND }, line: L.INPUTS },
    result: { rows: { first: first('ok', 'ok', 'ok', 'gone'), second: SECOND, result: result([1, 'run'], [1, 'bad'], [2, 'run']) }, line: L.CALL, bad: true },
  }),
  'filter-reality': spec(IO, CODE, {
    inputs: { rows: { first: first(), second: SECOND }, line: L.INPUTS },
    result: { rows: { first: first('ok', 'gone', 'ok', 'gone'), second: SECOND, result: result([1], [2]) }, line: L.CALL },
  }),

  'repeated-claim': spec(IO, CODE, {
    inputs: { rows: { first: first(), second: SECOND }, line: L.INPUTS },
    result: { rows: { first: first('bad', 'bad', 'ok', 'gone'), second: SECOND, result: [c('r0', '2'), c('miss', '1 removed', 'bad')] }, line: L.CALL, bad: true },
  }),
  'repeated-reality': spec(IO, CODE, {
    inputs: { rows: { first: first(), second: SECOND }, line: L.INPUTS },
    result: { rows: { first: first('ok', 'gone', 'ok', 'gone'), second: SECOND, result: result([1], [2]) }, line: L.CALL },
  }),

  'dedupe-first-claim': spec(IO, CODE, {
    dedupe: { rows: { first: first('run', 'gone'), second: SECOND, result: result([1, 'run'], [2, 'run'], [3, 'run']) }, line: L.CALL },
    result: { rows: { first: first('run', 'gone'), second: SECOND, result: result([1, 'run'], [2, 'run'], [3, 'bad']) }, line: L.CALL, bad: true },
  }),
  'dedupe-first-reality': spec(IO, CODE, {
    dedupe: { rows: { first: first('run', 'gone'), second: SECOND, result: result([1, 'run'], [2, 'run'], [3, 'run']) }, line: L.CALL },
    result: { rows: { first: first('run', 'gone', 'run', 'gone'), second: SECOND, result: result([1], [2]) }, line: L.CALL },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
