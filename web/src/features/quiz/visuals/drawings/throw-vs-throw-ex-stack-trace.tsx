import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const code = (rethrow: string) => [
  'void Main()',
  '{',
  '    try { Run(); }',
  '    catch (Exception e)',
  '        { Console.WriteLine(e.StackTrace); }',
  '}',
  'void Run()',
  '{',
  '    try { Load(); }',
  '    catch (Exception ex)',
  '    {',
  '        log.LogError(ex, "Load failed");',
  `        ${rethrow}`,
  '    }',
  '}',
  'void Load() =>',
  '    throw new InvalidOperationException();',
]
const BOTH = code('throw;   // or: throw ex;')
const RETHROW = code('throw;')
const THROW_EX = code('throw ex;')
const L = { MAIN: [2, 4] as [number, number], CATCH: [9, 11] as [number, number], RETHROW: 12, LOAD: [15, 16] as [number, number] }

const ROW = {
  stack: { id: 'stack', name: 'Call stack', sub: 'innermost last', tone: 'ui' },
  exc: { id: 'exc', name: 'Exception', sub: 'InvalidOperationException', tone: 'pool' },
  il: { id: 'il', name: 'IL emitted', tone: 'muted' },
  trace: { id: 'trace', name: 'StackTrace', sub: 'of the object', tone: 'ui' },
  traceA: { id: 'traceA', name: 'Main sees', sub: 'after throw;', tone: 'ui' },
  traceB: { id: 'traceB', name: 'Main sees', sub: 'after throw ex;', tone: 'ui' },
  main: { id: 'main', name: 'Main catches', tone: 'ok' },
  mainA: { id: 'mainA', name: 'Main catches', sub: 'after throw;', tone: 'ok' },
  mainB: { id: 'mainB', name: 'Main catches', sub: 'after throw ex;', tone: 'ok' },
} satisfies Record<string, RowDef>

const c = (key: string, label: string, kind: Chip['kind'] = 'run'): Chip => ({ key, label, kind })
const frames = (...names: string[]) => names.map((n) => c(n, n, 'run'))
const STACK_ALL = frames('Main', 'Run', 'Load')
const STACK_RUN = frames('Main', 'Run')
const EX1 = [c('ex', '#1')]
const at = (where: string, kind: Chip['kind'] = 'run') => c(where, `at ${where}`, kind)
const TRACE_LOAD = [at('Load')]
const TRACE_CAUGHT = [at('Load'), at('Run')]
const FULL = [at('Load', 'ok'), at('Run'), at('Main')]
const RESET = [at('Run', 'bad'), at('Main')]
const unknown = (key: string) => [c(key, '?', 'wait')]

const spec = (rows: RowDef[], src: string[], steps: Record<string, RowStep>): RowSpec => ({ rows, code: src, steps })

const THROWN: RowStep = { rows: { stack: STACK_ALL, exc: EX1, trace: TRACE_LOAD }, line: L.LOAD }
const CAUGHT: RowStep = { rows: { stack: STACK_RUN, exc: EX1, trace: TRACE_CAUGHT }, line: L.CATCH }
const REALITY = [ROW.stack, ROW.exc, ROW.il, ROW.trace, ROW.main]

const SPECS: Record<string, RowSpec> = {
  setup: spec([ROW.stack, ROW.exc, ROW.main], BOTH, {
    throw: { rows: { stack: STACK_ALL, exc: EX1 }, line: L.LOAD },
    catch: { rows: { stack: STACK_RUN, exc: EX1 }, line: L.CATCH },
    rethrow: { rows: { stack: STACK_RUN, exc: EX1, main: unknown('m') }, line: { each: [L.RETHROW, L.MAIN] } },
  }),

  rethrow: spec(REALITY, RETHROW, {
    thrown: THROWN,
    caught: CAUGHT,
    rethrow: { rows: { stack: STACK_RUN, exc: EX1, il: [c('il', 'rethrow')], trace: TRACE_CAUGHT }, line: L.RETHROW },
    caller: { rows: { stack: frames('Main'), exc: EX1, il: [c('il', 'rethrow')], trace: FULL, main: [c('m', '#1, origin kept', 'ok')] }, line: L.MAIN },
  }),
  'throw-ex': spec(REALITY, THROW_EX, {
    thrown: THROWN,
    caught: CAUGHT,
    rethrow: { rows: { stack: STACK_RUN, exc: EX1, il: [c('il', 'throw')], trace: [at('Run', 'bad')] }, line: L.RETHROW, bad: true },
    caller: { rows: { stack: frames('Main'), exc: EX1, il: [c('il', 'throw')], trace: RESET, main: [c('m', '#1, origin lost', 'bad')] }, line: L.MAIN, bad: true },
  }),

  'wrap-claim': spec([ROW.exc, ROW.main], THROW_EX, {
    caught: { rows: { exc: EX1 }, line: L.CATCH },
    rethrow: { rows: { exc: EX1, main: [c('m', 'TargetInvocationException', 'bad'), c('inner', 'inner: #1')] }, line: L.RETHROW, bad: true },
  }),
  'wrap-reality': spec([ROW.exc, ROW.trace, ROW.main], THROW_EX, {
    caught: { rows: { exc: EX1, trace: TRACE_CAUGHT }, line: L.CATCH },
    rethrow: { rows: { exc: EX1, trace: RESET, main: [c('m', 'InvalidOperationException #1', 'ok')] }, line: L.RETHROW },
  }),

  'rewrite-claim': spec([ROW.il, ROW.traceA, ROW.traceB], BOTH, {
    compile: { rows: { il: [c('a', 'throw; → rethrow'), c('b', 'throw ex; → rethrow', 'bad')] }, line: L.RETHROW, bad: true },
    run: {
      rows: { il: [c('a', 'throw; → rethrow'), c('b', 'throw ex; → rethrow', 'bad')], traceA: FULL, traceB: [at('Load', 'bad'), at('Run'), at('Main')] },
      line: L.RETHROW,
      bad: true,
    },
  }),
  'rewrite-reality': spec([ROW.il, ROW.traceA, ROW.traceB], BOTH, {
    compile: { rows: { il: [c('a', 'throw; → rethrow'), c('b', 'throw ex; → throw', 'ok')] }, line: L.RETHROW },
    run: { rows: { il: [c('a', 'throw; → rethrow'), c('b', 'throw ex; → throw', 'ok')], traceA: FULL, traceB: RESET }, line: L.RETHROW },
  }),

  'copy-claim': spec([ROW.exc, ROW.mainA, ROW.mainB], BOTH, {
    caught: { rows: { exc: EX1 }, line: L.CATCH },
    rethrow: { rows: { exc: EX1, mainA: [c('m', 'copy #2', 'bad')], mainB: [c('m', '#1')] }, line: L.RETHROW, bad: true },
  }),
  'copy-reality': spec([ROW.exc, ROW.mainA, ROW.mainB], BOTH, {
    caught: { rows: { exc: EX1 }, line: L.CATCH },
    rethrow: { rows: { exc: EX1, mainA: [c('m', '#1', 'ok'), c('t', 'trace from Load')], mainB: [c('m', '#1', 'ok'), c('t', 'trace from Run')] }, line: L.RETHROW },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
