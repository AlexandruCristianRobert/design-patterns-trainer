import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const code = (decl: string, call: string) => [
  'try',
  '{',
  `    ${call};`,
  '}',
  'catch (Exception)',
  '{',
  '    Console.WriteLine("caught");',
  '}',
  '',
  `${decl} FireAsync()`,
  '{',
  '    await Task.Delay(100);',
  '    throw new InvalidOperationException();',
  '}',
]
const VOID_CODE = code('async void', 'FireAsync()')
const TASK_CODE = code('async Task', 'await FireAsync()')
const L = { CALL: 2, TRY: [0, 3] as [number, number], CATCH: [4, 7] as [number, number], AWAIT: 11, THROW: 12 }

const A = {
  caller: { id: 'caller', name: 'Caller', sub: 'try / catch', tone: 'ui' },
  method: { id: 'method', name: 'FireAsync', sub: 'async void', tone: 'pool' },
  ctx: { id: 'ctx', name: 'Context', sub: 'or thread pool', tone: 'io' },
} satisfies Record<string, SeqActor>

const spec = (actors: SeqActor[], steps: Record<string, SeqStep>, c = VOID_CODE): SeqSpec => ({ actors, code: c, outputName: 'Outcome', steps })
const REAL = [A.caller, A.method, A.ctx]

const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const call = row('call', 'caller', 'FireAsync()', 'method')
const pending = row('await', 'method', 'await Delay: not done')
const returnsVoid = row('ret', 'method', 'returns, no Task', 'caller')
const leave = row('leave', 'caller', 'leaves try')
const throws = row('throw', 'method', 'resumes, throws', undefined, 'bad')
const noTask = row('notask', 'method', 'no Task to store it', undefined, 'skip')
const rethrow = row('rethrow', 'method', 'rethrown', 'ctx', 'bad')
const crash = row('crash', 'ctx', 'unhandled', undefined, 'bad')

const ex = (text: string, kind: OutLine['kind'] = 'plain'): OutLine => ({ label: 'Exception', text, kind: text === '?' ? 'muted' : kind })
const catchLine = (text: string, kind: OutLine['kind'] = 'plain'): OutLine => ({ label: 'catch', text, kind })
const CRASHED = [catchLine('never runs', 'bad'), ex('unhandled: process usually crashes', 'bad')]
const WAITING = [catchLine('…'), ex('…')]

/** The real run of the async void method. */
const R = {
  call: { rows: [call], line: L.CALL, output: WAITING },
  await: { rows: [call, pending, returnsVoid], line: L.AWAIT, output: WAITING },
  leave: { rows: [call, pending, returnsVoid, leave], line: L.TRY, output: WAITING },
  throw: { rows: [call, pending, returnsVoid, leave, throws, noTask], line: L.THROW, bad: true, output: WAITING },
  rethrow: { rows: [call, pending, returnsVoid, leave, throws, noTask, rethrow, crash], line: L.THROW, bad: true, output: CRASHED },
} satisfies Record<string, SeqStep>

/** The contrast: async Task, awaited inside the try. */
const T = { caller: A.caller, method: { ...A.method, sub: 'async Task' }, task: { id: 'task', name: 'Task', sub: 'returned', tone: 'io' } } satisfies Record<string, SeqActor>
const retTask = row('ret', 'method', 'incomplete Task', 'caller')
const awaitsIt = row('aw', 'caller', 'awaits it, in try')
const stored = row('store', 'method', 'stores exception', 'task', 'bad')
const taskThrows = [call, pending, retTask, awaitsIt, row('throw', 'method', 'resumes, throws', undefined, 'bad'), stored]

const SPECS: Record<string, SeqSpec> = {
  setup: spec([A.caller, A.method], {
    call: { rows: [call], line: L.CALL, output: [ex('…')] },
    await: { rows: [call, pending], line: L.AWAIT, output: [ex('…')] },
    throw: { rows: [call, pending, row('throw', 'method', 'throws')], line: L.THROW, output: [ex('?')] },
  }),
  'async-void': spec(REAL, { call: R.call, await: R.await, 'leave-try': R.leave, throw: R.throw, rethrow: R.rethrow }),
  'async-task': spec(
    [T.caller, T.method, T.task],
    {
      call: { rows: [call, pending, retTask, awaitsIt], line: L.CALL, output: [catchLine('…')] },
      throw: { rows: taskThrows, line: L.THROW, output: [catchLine('…')] },
      catch: {
        rows: [...taskThrows, row('back', 'task', 'await rethrows', 'caller'), row('catch', 'caller', 'catch runs', undefined, 'ok')],
        line: L.CATCH,
        output: [catchLine('handles it: prints "caught"', 'ok')],
      },
    },
    TASK_CODE,
  ),

  'hidden-task-claim': spec([A.caller, A.method, { id: 'task', name: 'Hidden Task', sub: 'claimed', tone: 'muted' }], {
    await: { rows: [call, pending, row('ret', 'method', 'returns', 'caller')], line: L.AWAIT, output: [ex('…')] },
    throw: { rows: [call, pending, row('ret', 'method', 'returns', 'caller'), throws, row('store', 'method', 'stores it', 'task', 'bad')], line: L.THROW, bad: true, output: [ex('…')] },
    dropped: {
      rows: [call, pending, row('ret', 'method', 'returns', 'caller'), throws, row('store', 'method', 'stores it', 'task', 'bad'), row('drop', 'task', 'never awaited', undefined, 'bad')],
      line: L.THROW,
      bad: true,
      output: [ex('silently dropped', 'bad')],
    },
  }),
  'hidden-task-reality': spec(REAL, {
    await: { rows: [call, pending, returnsVoid], line: L.AWAIT, output: [ex('…')] },
    throw: { rows: [call, pending, returnsVoid, throws, noTask], line: L.THROW, bad: true, output: [ex('…')] },
    dropped: { rows: [call, pending, returnsVoid, throws, noTask, rethrow, crash], line: L.THROW, bad: true, output: [ex('unhandled: process usually crashes', 'bad')] },
  }),

  'caller-catch-claim': spec([A.caller, A.method], {
    call: { rows: [call, pending], line: L.TRY, output: WAITING },
    throw: { rows: [call, pending, throws, row('back', 'method', 'passed back', 'caller', 'bad')], line: L.THROW, bad: true, output: WAITING },
    catch: {
      rows: [call, pending, throws, row('back', 'method', 'passed back', 'caller', 'bad'), row('catch', 'caller', 'catch runs', undefined, 'bad')],
      line: L.CATCH,
      bad: true,
      output: [catchLine('handles it: prints "caught"', 'bad'), ex('handled', 'bad')],
    },
  }),
  'caller-catch-reality': spec(REAL, {
    call: { rows: [call, pending, returnsVoid, leave], line: L.TRY, output: WAITING },
    throw: { rows: [call, pending, returnsVoid, leave, throws, row('back', 'method', 'no way back', 'caller', 'skip')], line: L.THROW, bad: true, output: WAITING },
    catch: {
      rows: [call, pending, returnsVoid, leave, throws, row('back', 'method', 'no way back', 'caller', 'skip'), rethrow, crash],
      line: L.CATCH,
      bad: true,
      output: CRASHED,
    },
  }),

  'unobserved-claim': spec([A.caller, A.method, { id: 'fin', name: 'Finalizer', sub: 'runs later', tone: 'muted' }], {
    throw: { rows: [call, pending, throws], line: L.THROW, output: [ex('…')] },
    later: { rows: [call, pending, throws, row('later', 'method', 'unobserved', 'fin', 'bad'), row('event', 'fin', 'UnobservedTask​Exception', undefined, 'bad')], line: L.THROW, bad: true, output: [ex('…')] },
    'no-crash': {
      rows: [call, pending, throws, row('later', 'method', 'unobserved', 'fin', 'bad'), row('event', 'fin', 'UnobservedTask​Exception', undefined, 'bad')],
      line: L.THROW,
      bad: true,
      output: [ex('reported, process keeps running', 'bad')],
    },
  }),
  'unobserved-reality': spec(REAL, {
    throw: { rows: [call, pending, throws], line: L.THROW, output: [ex('…')] },
    later: { rows: [call, pending, throws, row('notask', 'method', 'no task: no event', undefined, 'skip')], line: L.THROW, bad: true, output: [ex('…')] },
    'no-crash': {
      rows: [call, pending, throws, row('notask', 'method', 'no task: no event', undefined, 'skip'), rethrow, crash],
      line: L.THROW,
      bad: true,
      output: [ex('unhandled: process usually crashes', 'bad')],
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
