import { BoxGraph, type Box, type GraphSpec } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

// ---- Setup: one method, two possible declarations; nothing about callers, delegates or exceptions ----
const method = (fields: Box['fields'], still?: boolean): Box => ({ id: 'm', region: 'code', title: 'The method', fields, still })
const BODY = [
  { name: 'body', value: 'uses await' },
  { name: 'result', value: 'none' },
]
const DECL = { name: 'declared', value: 'async void or async Task' }
const SETUP: GraphSpec = {
  regions: [{ id: 'code', name: 'Code', tone: 'ui' }],
  steps: {
    method: { boxes: [method(BODY)] },
    choice: { boxes: [method([...BODY, DECL])] },
    ask: { boxes: [method([...BODY, DECL, { name: 'async void fits', value: '?', kind: 'muted' }])] },
  },
}

const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const spec = (actors: SeqActor[], code: string[], steps: Record<string, SeqStep>): SeqSpec => ({ actors, code, steps })

// ---- Reality: the event handler ----
const HANDLER_ACTORS: SeqActor[] = [
  { id: 'btn', name: 'Button', sub: 'raises Click', tone: 'ui' },
  { id: 'h', name: 'OnClick', sub: 'async void', tone: 'pool' },
  { id: 'io', name: 'SaveAsync', tone: 'io' },
]
const HANDLER_CODE = [
  'public delegate void EventHandler(object? sender, EventArgs e);',
  '',
  'button.Click += OnClick;',
  '',
  'async void OnClick(object? sender, EventArgs e)',
  '{',
  '    try',
  '    {',
  '        await SaveAsync();',
  '    }',
  '    catch (Exception ex)',
  '    {',
  '        ShowError(ex);',
  '    }',
  '}',
]
const SIG = row('sig', 'btn', 'EventHandler: void')
const RAISE = [row('raise', 'btn', 'Click(sender, e)', 'h'), row('none', 'btn', 'nothing to await')]
const AWAIT = [row('save', 'h', 'await SaveAsync', 'io'), row('ret', 'h', 'returns', 'btn'), row('go', 'btn', 'carries on')]
const CATCH = [row('fail', 'io', 'throws', 'h', 'bad'), row('caught', 'h', 'catch: ShowError', undefined, 'ok')]

// ---- Reality: async Task elsewhere ----
const TASK_ACTORS: SeqActor[] = [
  { id: 'c', name: 'Caller', tone: 'ui' },
  { id: 'm', name: 'SaveAsync', sub: 'async Task', tone: 'pool' },
]
const TASK_CODE = ['try', '{', '    await SaveAsync();', '}', 'catch (Exception ex) { … }', '', 'async Task SaveAsync() { … }']
const T_CALL = [row('call', 'c', 'SaveAsync()', 'm'), row('task', 'm', 'Task', 'c')]
const T_AWAIT = [row('await', 'c', 'awaits the Task'), row('done', 'm', 'Task completes', 'c', 'ok')]

// ---- Claim: fire-and-forget ----
const FIRE_ACTORS: SeqActor[] = [
  { id: 'w', name: 'Worker', sub: 'caller', tone: 'ui' },
  { id: 'd', name: 'DoWork', sub: 'async void', tone: 'pool' },
  { id: 'tp', name: 'Pool', sub: 'thread pool', tone: 'io' },
]
const FIRE_CODE = ['DoWork();', '', 'async void DoWork() { … }']
const F_CALL = [row('call', 'w', 'DoWork()', 'd'), row('go', 'w', 'carries on')]

// ---- Claim: interface method ----
const IFACE_ACTORS: SeqActor[] = [
  { id: 'c', name: 'Caller', tone: 'ui' },
  { id: 's', name: 'SmsNote', sub: 'sync', tone: 'pool' },
  { id: 'a', name: 'MailNote', sub: 'async', tone: 'pool' },
]
const IFACE_CODE = [
  'interface INotifier',
  '{',
  '    void Notify();',
  '}',
  '',
  'class SmsNote : INotifier',
  '{',
  '    public void Notify() { … }',
  '}',
  'class MailNote : INotifier',
  '{',
  '    public async void Notify() { … }',
  '}',
]
const IFACE_TASK = [
  'interface INotifier',
  '{',
  '    Task Notify();',
  '}',
  '',
  'class SmsNote : INotifier',
  '{',
  '    public Task Notify()',
  '    {',
  '        …',
  '        return Task.CompletedTask;',
  '    }',
  '}',
  'class MailNote : INotifier',
  '{',
  '    public async Task Notify() { … }',
  '}',
]
const I_DECL = row('decl', 'c', 'Notify(): void')
const I_CHOOSE = [row('sync', 's', 'void'), row('async', 'a', 'async void')]
const I_CALL = [row('call', 'c', 'Notify()', 'a'), row('ret', 'a', 'returns at await', 'c'), row('go', 'c', 'carries on')]

// ---- Claim: Main ----
const MAIN_ACTORS: SeqActor[] = [
  { id: 'cc', name: 'Compiler', tone: 'muted' },
  { id: 'rt', name: 'Runtime', tone: 'io' },
  { id: 'm', name: 'Main', tone: 'pool' },
]
const MAIN_CODE = ['static async void Main()', '{', '    await RunAsync();', '}']
const MAIN_TASK = ['static async Task Main()', '{', '    await RunAsync();', '}']
const M_DECL = row('decl', 'm', 'async void Main')

const SPECS: Record<string, SeqSpec> = {
  handler: spec(HANDLER_ACTORS, HANDLER_CODE, {
    delegate: { rows: [SIG], line: 0 },
    raise: { rows: [SIG, ...RAISE], line: [2, 4] },
    await: { rows: [SIG, ...RAISE, ...AWAIT], line: 8 },
    catch: { rows: [SIG, ...RAISE, ...AWAIT, ...CATCH], line: [10, 13] },
  }),
  elsewhere: spec(TASK_ACTORS, TASK_CODE, {
    call: { rows: T_CALL, line: 6 },
    await: { rows: [...T_CALL, ...T_AWAIT], line: 2 },
    fault: {
      rows: [...T_CALL, row('await', 'c', 'awaits the Task'), row('done', 'm', 'Task faulted', 'c', 'bad'), row('catch', 'c', 'catch runs', undefined, 'ok')],
      line: 4,
    },
  }),

  'fire-claim': spec(FIRE_ACTORS, FIRE_CODE, {
    start: { rows: F_CALL, line: 0 },
    saves: { rows: [...F_CALL, row('save', 'd', 'no Task allocated')], line: 2 },
  }),
  'fire-reality': spec(FIRE_ACTORS, FIRE_CODE, {
    track: { rows: [...F_CALL, row('none', 'w', 'nothing to track', undefined, 'bad')], line: 0, bad: true },
    crash: {
      rows: [...F_CALL, row('none', 'w', 'nothing to track', undefined, 'bad'), row('throw', 'd', 'throws', undefined, 'bad'), row('re', 'd', 'rethrown', 'tp', 'bad'), row('crash', 'tp', 'process crashes', undefined, 'bad')],
      line: 2,
      bad: true,
    },
    alloc: {
      rows: [...F_CALL, row('none', 'w', 'nothing to track', undefined, 'bad'), row('alloc', 'd', 'still allocates', undefined, 'bad')],
      line: 2,
      bad: true,
    },
  }),

  'iface-claim': spec(IFACE_ACTORS, IFACE_CODE, {
    iface: { rows: [I_DECL], line: 2 },
    choose: { rows: [I_DECL, ...I_CHOOSE], line: { each: [7, 11] } },
  }),
  'iface-reality': spec(IFACE_ACTORS, IFACE_CODE, {
    call: { rows: [I_DECL, ...I_CALL], line: 11, bad: true },
    lost: {
      rows: [I_DECL, ...I_CALL, row('cant', 'c', 'cannot await', undefined, 'bad'), row('throw', 'a', 'throws later', undefined, 'bad')],
      line: 11,
      bad: true,
    },
    task: {
      rows: [row('decl', 'c', 'Notify(): Task', undefined, 'ok'), row('sync', 's', 'done Task', undefined, 'ok'), row('async', 'a', 'async Task', undefined, 'ok'), row('await', 'c', 'await Notify()', 'a', 'ok')],
      line: { each: [2, 7, 10, 15] },
      code: IFACE_TASK,
    },
  }),

  'main-claim': spec(MAIN_ACTORS, MAIN_CODE, {
    decl: { rows: [M_DECL], line: 0 },
    wait: { rows: [M_DECL, row('start', 'rt', 'Main()', 'm'), row('wait', 'rt', 'waits for Main')], line: 0 },
  }),
  'main-reality': spec(MAIN_ACTORS, MAIN_CODE, {
    error: { rows: [M_DECL, row('err', 'cc', 'error CS4009', undefined, 'bad'), row('none', 'rt', 'no program', undefined, 'skip')], line: 0, bad: true },
    task: {
      rows: [row('decl', 'm', 'async Task Main', undefined, 'ok'), row('ok', 'cc', 'builds', undefined, 'ok'), row('start', 'rt', 'wrapper: Main()', 'm'), row('wait', 'rt', 'waits for Task', undefined, 'ok')],
      line: 0,
      code: MAIN_TASK,
    },
  }),
}

const drawing: QuestionDrawing = {
  setup: (p: StageDrawingProps) => <BoxGraph spec={SETUP} {...p} />,
  ...Object.fromEntries(Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />])),
}
export default drawing
