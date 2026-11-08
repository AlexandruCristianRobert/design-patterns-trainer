import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const code = (start: string) => [
  `var t = ${start}(async () =>`,
  '{',
  '    await Task.Delay(1000);',
  '    Console.WriteLine("done");',
  '});',
  'await t;',
  'Console.WriteLine("after");',
]
const CODE = code('Task.Factory.StartNew')
const RUN_CODE = code('Task.Run')
const L = { START: [0, 4] as [number, number], CALL: 0, DELAY: 2, DONE: 3, AWAIT: 5, AFTER: 6, END: [5, 6] as [number, number] }

const actors: SeqActor[] = [
  { id: 'main', name: 'Program', sub: 'top-level code', tone: 'ui' },
  { id: 't', name: 't', sub: 'the awaited task', tone: 'io' },
  { id: 'lam', name: 'Lambda', sub: 'async () => …', tone: 'pool' },
]
const spec = (steps: Record<string, SeqStep>, c = CODE): SeqSpec => ({ actors, code: c, outputName: 'Console', steps })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })

const out = (...lines: [string, string, OutLine['kind']?][]): OutLine[] => lines.map(([label, text, kind]) => ({ label, text, kind }))
const NONE = out(['output', 'nothing yet', 'muted'])
const AFTER = out(['~0 s', 'after'])
const REAL_OUT = out(['~0 s', 'after', 'bad'], ['~1 s', 'done'])

// ---- What really happens with StartNew ----
const call = msg('call', 'main', 't', 'StartNew')
const toPool = msg('pool', 't', 'lam', 'runs it on the pool')
const typed = note('type', 't', 'Task<Task>')
const delay = note('delay', 'lam', 'Delay not done')
const inner = msg('inner', 'lam', 't', 'returns inner Task')
const outerDone = note('outer', 't', 'completes: Result = inner', 'bad')
const resumes = msg('resume', 't', 'main', 'await t resumes')
const after = note('after', 'main', 'prints "after"')
const done = note('done', 'lam', '~1 s: prints "done"')
const innerDone = note('inner-done', 'lam', 'inner completes, unawaited', 'muted')
const START = [call, toPool, typed]
const EARLY = [...START, delay, inner, outerDone]
const ALL = [...EARLY, resumes, after, done, innerDone]

// ---- Task.Run ----
const runCall = msg('call', 'main', 't', 'Task.Run')
const runTyped = note('type', 't', 'Task (unwrapped)', 'ok')
const RUN_START = [runCall, toPool, runTyped]
const waiting = note('waiting', 't', 'still incomplete', 'ok')
const runDone = msg('inner-done', 'lam', 't', 'inner completes')
const tDone = note('t-done', 't', 't completes', 'ok')

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    call: { rows: [call, note('q', 't', '?', 'muted')], line: L.START },
    await: { rows: [call, note('q', 't', '?', 'muted'), note('await', 'main', 'await t')], line: L.END },
    observed: { rows: [call, note('q', 't', '?', 'muted'), note('await', 'main', 'await t')], line: { each: [L.DONE, L.AFTER] }, output: REAL_OUT.map((o) => ({ ...o, kind: undefined })) },
  }),

  'task-of-task': spec({
    start: { rows: START, line: L.CALL, output: NONE },
    'first-await': { rows: [...START, delay, inner], line: L.DELAY, output: NONE },
    'outer-done': { rows: EARLY, line: L.CALL, output: NONE },
    after: { rows: [...EARLY, resumes, after], line: L.END, output: AFTER },
    done: { rows: ALL, line: L.DONE, output: REAL_OUT },
  }),
  unwrapped: spec(
    {
      run: { rows: RUN_START, line: L.CALL, output: NONE },
      'first-await': { rows: [...RUN_START, delay, inner, waiting], line: L.DELAY, output: NONE },
      done: { rows: [...RUN_START, delay, inner, waiting, done, runDone, tDone], line: L.DONE, output: out(['~1 s', 'done']) },
      after: { rows: [...RUN_START, delay, inner, waiting, done, runDone, tDone, resumes, after], line: L.END, output: out(['~1 s', 'done'], ['~1 s', 'after', 'ok']) },
    },
    RUN_CODE,
  ),

  'thread-claim': spec({
    start: { rows: [call, msg('pool', 't', 'lam', 'dedicated thread', 'bad')], line: L.CALL },
    await: {
      rows: [call, msg('pool', 't', 'lam', 'dedicated thread', 'bad'), note('no-wait', 'main', 'await: no wait for it', 'bad'), after],
      line: L.END,
      bad: true,
      output: AFTER,
    },
  }),
  'thread-reality': spec({
    start: { rows: [call, msg('pool', 't', 'lam', 'runs it on the pool', 'ok')], line: L.CALL },
    await: { rows: [...EARLY, resumes, after], line: L.END, output: AFTER },
  }),

  'timer-claim': spec({
    delay: { rows: [call, toPool, note('timer', 'lam', 'Delay: timer thread')], line: L.DELAY },
    print: {
      rows: [call, toPool, note('timer', 'lam', 'Delay: timer thread'), note('outside', 'lam', 'timer prints "done", in no task', 'bad'), note('no-wait', 'main', 'await t: no wait'), after],
      line: { each: [L.DONE, L.AWAIT] },
      bad: true,
      output: REAL_OUT.map((o) => ({ ...o, kind: undefined })),
    },
  }),
  'timer-reality': spec({
    delay: { rows: [call, toPool, delay, inner, note('cont', 'lam', 'rest of lambda: in inner Task', 'ok')], line: { each: [L.DELAY, L.DONE] } },
    print: { rows: [call, toPool, typed, delay, inner, note('cont', 'lam', 'rest of lambda: in inner Task', 'ok'), outerDone, resumes, after, done, innerDone], line: L.END, output: REAL_OUT },
  }),

  'scheduler-claim': spec({
    start: { rows: [call, note('sched', 't', 'TaskScheduler.Current')], line: L.CALL },
    skip: {
      rows: [call, note('sched', 't', 'TaskScheduler.Current'), note('skips', 't', 'skips timers', 'bad'), msg('resume', 't', 'main', 'delay ignored', 'bad'), after],
      line: L.END,
      bad: true,
      output: AFTER,
    },
  }),
  'scheduler-reality': spec({
    start: { rows: [call, note('sched', 't', 'Current = default (pool)', 'ok'), toPool], line: L.CALL },
    skip: { rows: [call, note('sched', 't', 'Current = default (pool)', 'ok'), toPool, delay, inner, outerDone, resumes, after, done, innerDone], line: { each: [L.DELAY, L.AWAIT] }, output: REAL_OUT },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
