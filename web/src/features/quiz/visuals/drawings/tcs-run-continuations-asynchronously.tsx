import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const CREATE_PLAIN = ['_tcs = new TaskCompletionSource<int>();']
const CREATE_OPT = ['_tcs = new TaskCompletionSource<int>(', '    TaskCreationOptions.RunContinuationsAsynchronously);']
const code = (opt: boolean, set = '    _tcs.SetResult(value);') => [
  ...(opt ? CREATE_OPT : CREATE_PLAIN),
  '',
  '// consumer',
  'int v = await _tcs.Task;',
  'Handle(v);',
  '',
  '// component, on thread A',
  'lock (_lock)',
  '{',
  set,
  '}',
]
/** Code lines (0-based): the option makes the constructor two lines long. */
const at = (opt: boolean) => {
  const s = opt ? 1 : 0
  return { CREATE: (opt ? [0, 1] : 0) as number | [number, number], AWAIT: [3 + s, 4 + s] as [number, number], HANDLE: 4 + s, SET: 9 + s }
}
const P = at(false)
const O = at(true)
const TWICE = [...CREATE_OPT, '', '_tcs.SetResult(1);', '_tcs.SetResult(2);']

const A: RowDef = { id: 'a', name: 'Thread A', sub: 'calls SetResult', tone: 'ui' }
const TASK: RowDef = { id: 'task', name: '_tcs.Task', sub: 'awaited by the consumer', tone: 'io' }
const POOL: RowDef = { id: 'pool', name: 'Thread pool', sub: 'any free worker', tone: 'pool' }
const CREATOR: RowDef = { id: 'creator', name: 'Creator thread', sub: 'has a SynchronizationContext', tone: 'muted' }

const c = (key: string, label: string, kind: Chip['kind'] = 'run'): Chip => ({ key, label, kind })
const LOCK = c('lock', 'holds _lock')
const SET = c('set', 'SetResult(value)')
const PENDING = c('state', 'pending', 'wait')
const DONE = c('state', 'completed', 'ok')
const CONT = c('cont', 'continuation: Handle(v)', 'wait')

const spec = (rows: RowDef[], code: string[], steps: Record<string, RowStep>): RowSpec => ({ rows, code, steps })

/** The Setup switches to the option's code on its last step; both specs share the steps so the current-step marking carries over. */
const setupSteps = (L: ReturnType<typeof at>): Record<string, RowStep> => ({
  waiting: { rows: { task: [PENDING, CONT] }, line: L.AWAIT },
  'set-result': { rows: { a: [LOCK, SET, c('handle', '↳ Handle(v) inside', 'bad')], task: [DONE, c('cont', 'running on thread A')] }, line: L.SET },
  option: { rows: { a: [LOCK, SET], task: [DONE, c('cont', 'Handle(v): where, when?', 'wait')] }, line: L.CREATE },
})
const SETUP_PLAIN = spec([A, TASK], code(false), setupSteps(P))
const SETUP_OPT = spec([A, TASK], code(true), setupSteps(O))

const SPECS: Record<string, RowSpec> = {
  'inline-default': spec([A, TASK, POOL], code(false), {
    set: { rows: { a: [LOCK, SET], task: [DONE, CONT] }, line: P.SET },
    inline: { rows: { a: [LOCK, SET, c('handle', '↳ Handle(v) runs inline', 'bad')], task: [DONE, c('cont', 'running on thread A', 'bad')] }, line: P.HANDLE, bad: true },
    returns: {
      rows: { a: [LOCK, SET, c('handle', '↳ Handle(v) ran under _lock', 'bad'), c('ret', 'only now SetResult returns')], task: [DONE, c('cont', 'ran on thread A', 'bad')] },
      line: P.SET,
      bad: true,
    },
  }),
  'async-option': spec([A, TASK, POOL], code(true), {
    set: { rows: { a: [LOCK, SET], task: [DONE, CONT] }, line: O.SET },
    queued: { rows: { a: [LOCK, SET, c('ret', 'returns at once', 'ok')], task: [DONE, c('cont', 'queued to the pool', 'ok')], pool: [c('handle', 'Handle(v) queued', 'wait')] }, line: O.SET },
    'pool-runs': { rows: { a: [LOCK, SET, c('ret', 'returns at once', 'ok')], task: [DONE, c('cont', 'queued to the pool', 'ok')], pool: [c('handle', 'Handle(v) runs', 'ok')] }, line: O.HANDLE },
  }),

  'returns-task-claim': spec([A, TASK, POOL], code(true, '    Task done = _tcs.SetResult(value);'), {
    call: { rows: { a: [LOCK, c('set', 'SetResult(value) → Task')], task: [DONE, CONT] }, line: O.SET },
    done: { rows: { a: [LOCK, c('set', 'SetResult(value) → Task'), c('done', 'Task done: continuations finished')], task: [DONE, c('cont', 'finished')], pool: [c('handle', 'Handle(v) finished')] }, line: O.SET },
  }),
  'returns-task-reality': spec([A, TASK, POOL], code(true), {
    call: { rows: { a: [LOCK, c('set', 'SetResult(value): void')], task: [DONE, CONT] }, line: O.SET },
    done: {
      rows: { a: [LOCK, c('set', 'SetResult(value): void'), c('ret', 'returned, nothing to wait on', 'ok')], task: [DONE, c('cont', 'queued to the pool', 'ok')], pool: [c('handle', 'Handle(v) queued', 'wait')] },
      line: O.SET,
    },
  }),

  'context-claim': spec([CREATOR, A, POOL], code(true), {
    create: { rows: { creator: [c('new', 'new TaskCompletionSource(…)'), c('ctx', 'context remembered')] }, line: O.CREATE },
    post: { rows: { creator: [c('new', 'new TaskCompletionSource(…)'), c('ctx', 'context remembered'), c('handle', 'Handle(v) posted here')], a: [LOCK, SET] }, line: O.SET },
  }),
  'context-reality': spec([CREATOR, A, POOL], code(true), {
    create: { rows: { creator: [c('new', 'new TaskCompletionSource(…)'), c('ctx', 'no context stored', 'gone')] }, line: O.CREATE },
    post: { rows: { creator: [c('new', 'new TaskCompletionSource(…)'), c('ctx', 'no context stored', 'gone')], a: [LOCK, SET], pool: [c('handle', 'Handle(v) runs', 'ok')] }, line: { each: [O.AWAIT, O.SET] } },
  }),

  'twice-claim': spec([A, TASK], TWICE, {
    first: { rows: { a: [c('s1', 'SetResult(1)')], task: [c('res', 'Result = 1', 'ok')] }, line: 3 },
    second: { rows: { a: [c('s1', 'SetResult(1)'), c('s2', 'SetResult(2): safe')], task: [c('res', 'Result = 2, last wins', 'ok')] }, line: 4 },
  }),
  'twice-reality': spec([A, TASK], TWICE, {
    first: { rows: { a: [c('s1', 'SetResult(1)')], task: [c('res', 'Result = 1', 'ok')] }, line: 3 },
    second: { rows: { a: [c('s1', 'SetResult(1)'), c('s2', 'SetResult(2) throws', 'bad')], task: [c('res', 'Result = 1', 'ok')] }, line: 4, bad: true },
  }),
}

const drawing: QuestionDrawing = {
  setup: (p: StageDrawingProps) => <RowStage spec={p.stepIds[p.stepIndex] === 'option' ? SETUP_OPT : SETUP_PLAIN} {...p} />,
  ...Object.fromEntries(Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />])),
}
export default drawing
