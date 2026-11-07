import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const CODE = [
  'private double _x = 2.0;',
  '',
  '[Benchmark]',
  'public void Root() { double r = Math.Sqrt(_x) * 2; }',
]
const ROOT = 3
const FIXED = [
  'private double _x = 2.0;',
  '',
  '[Benchmark]',
  'public double Root() => Math.Sqrt(_x) * 2;',
]

const SRC: RowDef = { id: 'src', name: 'C# method', sub: 'as written', tone: 'ui' }
const JIT: RowDef = { id: 'jit', name: 'Machine code', sub: 'what runs', tone: 'pool' }
const RUNS: RowDef = { id: 'runs', name: 'Calls', sub: 'benchmark runs', tone: 'io' }
const RESULT: RowDef = { id: 'result', name: 'Reported', tone: 'muted' }
const BUILD: RowDef = { id: 'build', name: 'Build', tone: 'ui' }
const MEASURED: RowDef = { id: 'measured', name: 'Measured', sub: 'per call', tone: 'io' }

const c = (key: string, label: string, kind?: Chip['kind']): Chip => ({ key, label, kind })
const spec = (rows: RowDef[], steps: Record<string, RowStep>, code = CODE): RowSpec => ({ rows, code, steps })

const SOURCE = [c('load', 'read _x'), c('sqrt', 'Math.Sqrt'), c('mul', '× 2'), c('r', 'store in r')]
const SOURCE_RETURN = [c('load', 'read _x'), c('sqrt', 'Math.Sqrt'), c('mul', '× 2'), c('r', 'return it', 'ok')]
const TINY = c('t', '< 1 ns', 'bad')
const OPTIMIZED = [c('null', 'null check', 'run'), c('sqrt', 'sqrt: removed', 'gone'), c('mul', '× 2: removed', 'gone'), c('ret', 'ret', 'run')]
const KEPT = [c('sqrt', 'vsqrtsd', 'ok'), c('mul', 'vmulsd', 'ok'), c('ret', 'ret', 'run')]
const ITERATIONS = [c('pilot', 'pilot', 'run'), c('warm', 'warm-up', 'run'), c('main', 'measured × many', 'run')]

const SPECS: Record<string, RowSpec> = {
  setup: spec([SRC, RESULT], {
    method: { rows: { src: SOURCE }, line: ROOT },
    measure: { rows: { src: SOURCE, result: [c('t', '< 1 ns')] }, line: ROOT },
    question: { rows: { src: SOURCE, result: [c('t', '< 1 ns'), c('why', 'why?', 'gone')] }, line: ROOT },
  }),

  jit: spec([SRC, JIT, RUNS, RESULT], {
    source: { rows: { src: SOURCE }, line: ROOT },
    eliminate: { rows: { src: SOURCE, jit: OPTIMIZED }, line: ROOT, bad: true },
    measure: { rows: { src: SOURCE, jit: OPTIMIZED, runs: ITERATIONS, result: [TINY] }, line: ROOT },
  }),
  fix: spec(
    [SRC, JIT, RUNS, RESULT],
    {
      return: { rows: { src: SOURCE_RETURN }, line: 3 },
      consume: { rows: { src: SOURCE_RETURN, jit: KEPT, runs: [c('consume', 'consumes the value', 'ok')] }, line: 3 },
      measure: { rows: { src: SOURCE_RETURN, jit: KEPT, runs: [c('consume', 'consumes the value', 'ok'), ...ITERATIONS], result: [c('t', 'sqrt + multiply', 'ok')] }, line: 3 },
    },
    FIXED,
  ),

  'once-claim': spec([JIT, RUNS, RESULT], {
    once: { rows: { runs: [c('one', '1 call', 'bad')] }, line: ROOT },
    result: { rows: { jit: [c('none', 'not compiled yet', 'bad')], runs: [c('one', '1 call', 'bad')], result: [c('t', '< 1 ns')] }, line: ROOT, bad: true },
  }),
  'once-reality': spec([JIT, RUNS, RESULT], {
    once: { rows: { runs: ITERATIONS }, line: ROOT },
    result: { rows: { jit: OPTIMIZED, runs: [c('pilot', 'pilot', 'gone'), c('warm', 'warm-up: JIT here', 'gone'), c('main', 'measured × many', 'ok')], result: [TINY] }, line: ROOT },
  }),

  'debug-claim': spec([BUILD, JIT, RESULT], {
    debug: { rows: { build: [c('cfg', 'Debug', 'run')], jit: [c('load', 'read _x', 'run'), c('sqrt', 'sqrt: skipped', 'bad'), c('mul', '× 2: skipped', 'bad'), c('ret', 'ret', 'run')] }, line: ROOT, bad: true },
    result: {
      rows: { build: [c('cfg', 'Debug', 'run')], jit: [c('load', 'read _x', 'run'), c('sqrt', 'sqrt: skipped', 'bad'), c('mul', '× 2: skipped', 'bad'), c('ret', 'ret', 'run')], result: [c('t', '< 1 ns', 'bad')] },
      line: ROOT,
      bad: true,
    },
  }),
  'debug-reality': spec([BUILD, JIT, RESULT], {
    debug: {
      rows: { build: [c('cfg', 'Debug: no optimizations', 'run')], jit: [c('load', 'read _x', 'run'), c('sqrt', 'call Math.Sqrt', 'ok'), c('mul', '× 2', 'ok'), c('r', 'store r', 'ok'), c('ret', 'ret', 'run')] },
      line: ROOT,
    },
    result: {
      rows: {
        build: [c('cfg', 'Debug: no optimizations', 'run')],
        jit: [c('load', 'read _x', 'run'), c('sqrt', 'call Math.Sqrt', 'ok'), c('mul', '× 2', 'ok'), c('r', 'store r', 'ok'), c('ret', 'ret', 'run')],
        result: [c('t', 'refused: assembly not optimized', 'bad')],
      },
      line: null,
    },
  }),

  'overhead-claim': spec([MEASURED, RESULT], {
    measure: { rows: { measured: [c('w', 'Root()', 'run'), c('o', 'empty method', 'run')] }, line: ROOT },
    result: { rows: { measured: [c('w', 'Root()', 'run'), c('o', 'empty method', 'run')], result: [c('m', 'Root − empty − empty', 'bad'), c('t', '≈ 0', 'bad')] }, line: ROOT, bad: true },
  }),
  'overhead-reality': spec([MEASURED, RESULT], {
    measure: { rows: { measured: [c('w', 'Root()', 'run'), c('o', 'empty method', 'run')] }, line: ROOT },
    result: {
      rows: { measured: [c('w', 'Root() ≈ empty: work removed', 'bad'), c('o', 'empty method', 'run')], result: [c('m', 'Root − empty, once', 'ok'), c('t', '≈ 0', 'bad')] },
      line: ROOT,
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
