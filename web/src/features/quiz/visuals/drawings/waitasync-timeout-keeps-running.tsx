import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CALLER = [
  'try',
  '{',
  '    await SaveAsync().WaitAsync(TimeSpan.FromSeconds(5));',
  '}',
  'catch (TimeoutException) { … }',
]
const CODE = [
  ...CALLER,
  '',
  'async Task SaveAsync()',
  '{',
  '    await db.InsertOrderAsync(order); // slow',
  '    await db.InsertLinesAsync(lines);',
  '}',
]
const L = { AWAIT: 2, CATCH: 4, ORDER: 8, LINES: 9 }
const TOKEN_CODE = [
  'using var cts = new CancellationTokenSource();',
  'cts.CancelAfter(TimeSpan.FromSeconds(5));',
  'await SaveAsync(cts.Token);',
  '',
  'async Task SaveAsync(CancellationToken ct)',
  '{',
  '    await db.InsertOrderAsync(order, ct);',
  '    await db.InsertLinesAsync(lines, ct);',
  '}',
]
const T = { CTS: [0, 1] as [number, number], CALL: 2, ORDER: 6, LINES: 7 }

const CALLER_A: SeqActor = { id: 'caller', name: 'Caller', tone: 'ui' }
const WAIT: SeqActor = { id: 'wait', name: 'WaitAsync', sub: '5 s', tone: 'pool' }
const SAVE: SeqActor = { id: 'save', name: 'SaveAsync', tone: 'pool' }
const DB: SeqActor = { id: 'db', name: 'Database', tone: 'io' }
const CTS: SeqActor = { id: 'cts', name: 'Token', sub: 'CancelAfter', tone: 'pool' }

const spec = (steps: Record<string, SeqStep>, code = CODE, actors = [CALLER_A, WAIT, SAVE, DB]): SeqSpec => ({ actors, code, outputName: 'Outcome', steps })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const out = (caller: string, save: string, ck: OutLine['kind'] = 'plain', sk: OutLine['kind'] = 'plain'): OutLine[] => [
  { label: 'Caller', text: caller, kind: ck },
  { label: 'Save', text: save, kind: sk },
]

// ---- Reality ----
const call = msg('call', 'caller', 'save', 'SaveAsync()')
const order = msg('order', 'save', 'db', 'insert order')
const wrap = msg('wrap', 'caller', 'wait', 'WaitAsync')
const races = note('races', 'wait', 'task or 5 s')
const up = note('up', 'wait', '5 s up')
const thrown = msg('thrown', 'wait', 'caller', 'throws', 'bad')
const orderDone = msg('order-done', 'db', 'save', 'order saved')
const lines = msg('lines', 'save', 'db', 'insert lines', 'ok')
const linesDone = msg('lines-done', 'db', 'save', 'lines saved', 'ok')
const unobserved = note('unobserved', 'save', 'unobserved', 'ok')

const START = [call, order, wrap, races]
const TIMED_OUT = [...START, up, thrown]
const TIMEOUT_OUT = out('TimeoutException', 'running', 'bad')
const R = {
  call: { rows: [call, order], line: L.ORDER, output: out('awaiting', 'running') },
  wrap: { rows: START, line: L.AWAIT, output: out('awaiting', 'running') },
  timeout: { rows: TIMED_OUT, line: L.AWAIT, output: TIMEOUT_OUT },
  continues: { rows: [...TIMED_OUT, orderDone, lines], line: L.LINES, output: out('TimeoutException', 'still running', 'bad', 'ok') },
  done: { rows: [...TIMED_OUT, orderDone, lines, linesDone, unobserved], line: L.LINES, output: out('TimeoutException', 'finished after the timeout', 'bad', 'ok') },
} satisfies Record<string, SeqStep>
const KEEPS_OUT = out('TimeoutException', 'kept running, lines saved', 'bad', 'ok')

// ---- With a token ----
const tCall = msg('call', 'caller', 'save', 'SaveAsync(ct)')
const tOrder = msg('order', 'save', 'db', 'insert order, ct')
const cancelled = note('cancelled', 'cts', '5 s: cancel')
const signal = msg('signal', 'cts', 'db', 'ct cancelled')
const oce = msg('oce', 'db', 'save', 'throws', 'ok')
const stopped = note('stopped', 'save', 'stops', 'ok')
const neverLines = note('never', 'db', 'no lines', 'skip')
const oceOut = msg('oce-out', 'save', 'caller', 'throws', 'ok')

// ---- Claims ----
const cancelClaim = msg('cancel', 'wait', 'save', 'cancels it', 'bad')
const abortClaim = note('abort', 'save', 'aborted', 'bad')
const noLines = note('never', 'db', 'no lines', 'skip')
const ambient = note('ambient', 'caller', 'ambient ct', 'bad')
const reaches = msg('reaches', 'caller', 'save', 'cancel request', 'bad')

const SPECS: Record<string, SeqSpec> = {
  setup: spec(
    {
      call: { rows: [msg('call', 'caller', 'save', 'SaveAsync()'), msg('wrap', 'caller', 'wait', 'WaitAsync')], line: L.AWAIT, output: out('awaiting', 'started') },
      timeout: {
        rows: [msg('call', 'caller', 'save', 'SaveAsync()'), msg('wrap', 'caller', 'wait', 'WaitAsync'), note('up', 'wait', '5 s up'), msg('thrown', 'wait', 'caller', 'throws'), note('q', 'save', '?', 'muted')],
        line: L.CATCH,
        output: out('TimeoutException', '?', 'plain', 'muted'),
      },
    },
    CALLER,
    [CALLER_A, WAIT, SAVE],
  ),
  timeout: spec(R),
  'with-token': spec(
    {
      pass: { rows: [tCall, tOrder], line: T.ORDER, output: out('awaiting', 'running') },
      cancel: { rows: [tCall, tOrder, cancelled, signal], line: T.CTS, output: out('awaiting', 'running') },
      stops: {
        rows: [tCall, tOrder, cancelled, signal, oce, stopped, neverLines, oceOut],
        line: T.ORDER,
        output: out('OperationCanceledException', 'stopped, lines never inserted', 'plain', 'ok'),
      },
    },
    TOKEN_CODE,
    [CALLER_A, CTS, SAVE, DB],
  ),

  'abort-claim': spec({
    timeout: { rows: TIMED_OUT, line: L.AWAIT, output: TIMEOUT_OUT },
    cancel: { rows: [...TIMED_OUT, cancelClaim], line: L.AWAIT, bad: true, output: TIMEOUT_OUT },
    abort: { rows: [...TIMED_OUT, cancelClaim, orderDone, abortClaim, noLines], line: L.LINES, bad: true, output: out('TimeoutException', 'aborted at the next await', 'bad', 'bad') },
  }),
  'abort-reality': spec({
    timeout: { rows: TIMED_OUT, line: L.AWAIT, output: TIMEOUT_OUT },
    cancel: { rows: [...TIMED_OUT, note('only', 'wait', 'stops waiting', 'ok')], line: L.AWAIT, output: TIMEOUT_OUT },
    abort: { rows: [...TIMED_OUT, note('only', 'wait', 'stops waiting', 'ok'), orderDone, lines, linesDone], line: L.LINES, output: KEEPS_OUT },
  }),

  'rollback-claim': spec({
    timeout: { rows: TIMED_OUT, line: L.AWAIT, output: TIMEOUT_OUT },
    rollback: { rows: [...TIMED_OUT, note('undo', 'db', 'work undone', 'bad')], line: L.ORDER, bad: true, output: out('TimeoutException', 'rolled back by the runtime', 'bad', 'bad') },
  }),
  'rollback-reality': spec({
    timeout: { rows: TIMED_OUT, line: L.AWAIT, output: TIMEOUT_OUT },
    rollback: { rows: [...TIMED_OUT, orderDone, note('stays', 'db', 'order stays', 'ok'), lines, linesDone], line: L.LINES, output: KEEPS_OUT },
  }),

  'ambient-claim': spec({
    timeout: { rows: TIMED_OUT, line: L.AWAIT, output: TIMEOUT_OUT },
    token: { rows: [...TIMED_OUT, ambient, reaches], line: L.AWAIT, bad: true, output: TIMEOUT_OUT },
    stops: { rows: [...TIMED_OUT, ambient, reaches, note('stops', 'save', 'stops', 'bad')], line: L.ORDER, bad: true, output: out('TimeoutException', 'cancelled through the ambient token', 'bad', 'bad') },
  }),
  'ambient-reality': spec({
    timeout: { rows: TIMED_OUT, line: L.AWAIT, output: TIMEOUT_OUT },
    token: { rows: [...TIMED_OUT, note('no-token', 'save', 'no token', 'ok')], line: L.AWAIT, output: TIMEOUT_OUT },
    stops: { rows: [...TIMED_OUT, note('no-token', 'save', 'no token', 'ok'), orderDone, lines, linesDone], line: L.LINES, output: KEEPS_OUT },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
