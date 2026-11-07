import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const code = (awaited: string) => [
  'Task work = WorkAsync();',
  'Console.WriteLine("3");',
  'await work;',
  '',
  'static async Task WorkAsync()',
  '{',
  '    Console.WriteLine("1");',
  `    await ${awaited};`,
  '    Console.WriteLine("2");',
  '}',
]
const CODE = code('Task.CompletedTask')
const DELAY_CODE = code('Task.Delay(100)')
const L = { CALL: 0, P3: 1, CALLER: [1, 2] as [number, number], BODY: [6, 8] as [number, number], P1: 6, AWAIT: 7, P2: 8, P2_END: [8, 9] as [number, number] }

const actors = (awaited: string): SeqActor[] => [
  { id: 'caller', name: 'Caller', sub: 'top-level code', tone: 'ui' },
  { id: 'work', name: 'WorkAsync', sub: 'async method', tone: 'pool' },
  { id: 'task', name: 'Awaited task', sub: awaited, tone: 'io' },
]
const spec = (steps: Record<string, SeqStep>, delay = false): SeqSpec => ({
  actors: actors(delay ? 'Delay(100)' : 'CompletedTask'),
  code: delay ? DELAY_CODE : CODE,
  outputName: 'Console',
  steps,
})

const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const call = row('call', 'caller', 'WorkAsync()', 'work')
const p1 = row('p1', 'work', 'writes 1')
const awaits = row('await', 'work', 'await', 'task')
const complete = row('done', 'task', 'already complete: carry on', 'work', 'ok')
const p2 = row('p2', 'work', 'writes 2')
const returns = row('ret', 'work', 'completed Task', 'caller')
const p3 = row('p3', 'caller', 'writes 3')
const awaitWork = row('aw', 'caller', 'await work: complete')

/** Console lines in the order they were written; nothing yet is a muted placeholder. */
const out = (...lines: string[]): OutLine[] =>
  lines.length ? lines.map((t, i) => ({ label: `line ${i + 1}`, text: t, kind: t === '?' ? 'muted' : 'plain' })) : [{ label: '', text: '(nothing yet)', kind: 'muted' }]

const SYNC = {
  call: { rows: [call], line: L.CALL, output: out() },
  p1: { rows: [call, p1], line: L.P1, output: out('1') },
  await: { rows: [call, p1, awaits, complete], line: L.AWAIT, output: out('1') },
  p2: { rows: [call, p1, awaits, complete, p2, returns], line: L.P2_END, output: out('1', '2') },
  p3: { rows: [call, p1, awaits, complete, p2, returns, p3, awaitWork], line: L.CALLER, output: out('1', '2', '3') },
} satisfies Record<string, SeqStep>

const pending = row('pending', 'task', 'still running')
const early = row('ret', 'work', 'incomplete Task', 'caller')
const suspends = row('aw', 'caller', 'await work: suspends')
const resumes = row('resume', 'task', 'completes: resume', 'work')

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    call: { rows: [call], line: L.CALL, output: out('?') },
    body: { rows: [call, row('body', 'work', 'writes 1, awaits, writes 2', undefined, 'muted')], line: L.BODY, output: out('?') },
    caller: {
      rows: [call, row('body', 'work', 'writes 1, awaits, writes 2', undefined, 'muted'), row('rest', 'caller', 'writes 3, awaits work', undefined, 'muted')],
      line: L.CALLER,
      output: out('?', '?', '?'),
    },
  }),
  'completed-await': spec({ call: SYNC.call, 'print-1': SYNC.p1, 'await-completed': SYNC.await, 'print-2': SYNC.p2, 'print-3': SYNC.p3 }),
  'pending-await': spec(
    {
      'print-1': { rows: [call, p1], line: L.P1, output: out('1') },
      'await-pending': { rows: [call, p1, awaits, pending, early], line: L.AWAIT, output: out('1') },
      'print-3': { rows: [call, p1, awaits, pending, early, p3, suspends], line: L.CALLER, output: out('1', '3') },
      resume: { rows: [call, p1, awaits, pending, early, p3, suspends, resumes, p2], line: L.P2, output: out('1', '3', '2') },
    },
    true,
  ),

  'every-await-yields-claim': spec({
    'print-1': SYNC.p1,
    await: { rows: [call, p1, awaits, row('ret', 'work', 'returns at the await', 'caller', 'bad')], line: L.AWAIT, output: out('1') },
    order: {
      rows: [call, p1, awaits, row('ret', 'work', 'returns at the await', 'caller', 'bad'), p3, row('p2', 'work', 'resumes, writes 2', undefined, 'bad')],
      line: L.P2,
      output: out('1', '3', '2'),
    },
  }),
  'every-await-yields-reality': spec({ 'print-1': SYNC.p1, await: SYNC.await, order: SYNC.p3 }),

  'queued-body-claim': spec({
    call: { rows: [row('call', 'caller', 'WorkAsync(): body queued', 'work', 'bad'), row('ret', 'work', 'returns at once', 'caller', 'bad')], line: L.CALL, output: out() },
    'print-3': {
      rows: [row('call', 'caller', 'WorkAsync(): body queued', 'work', 'bad'), row('ret', 'work', 'returns at once', 'caller', 'bad'), p3],
      line: L.P3,
      output: out('3'),
    },
    body: {
      rows: [row('call', 'caller', 'WorkAsync(): body queued', 'work', 'bad'), row('ret', 'work', 'returns at once', 'caller', 'bad'), p3, row('body', 'work', 'runs later: writes 1, 2', undefined, 'bad')],
      line: L.BODY,
      output: out('3', '1', '2'),
    },
  }),
  'queued-body-reality': spec({
    call: { rows: [call, row('now', 'work', 'body starts now', undefined, 'ok')], line: L.CALL, output: out() },
    'print-1': { rows: [call, row('now', 'work', 'body starts now', undefined, 'ok'), p1], line: L.P1, output: out('1') },
    'print-3': { rows: [call, row('now', 'work', 'body starts now', undefined, 'ok'), p1, awaits, complete, p2, returns, p3], line: L.P3, output: out('1', '2', '3') },
  }),

  'race-claim': spec({
    'print-1': SYNC.p1,
    race: {
      rows: [call, p1, row('p2', 'work', 'writes 2, concurrently', undefined, 'bad'), row('p3', 'caller', 'writes 3, concurrently', undefined, 'bad')],
      line: null,
      output: [
        { label: 'run 1', text: '1 3 2', kind: 'bad' },
        { label: 'run 2', text: '1 2 3', kind: 'bad' },
      ],
    },
  }),
  'race-reality': spec({
    'print-1': SYNC.p1,
    race: {
      rows: SYNC.p3.rows,
      line: L.AWAIT,
      output: [
        { label: 'run 1', text: '1 2 3', kind: 'ok' },
        { label: 'run 2', text: '1 2 3', kind: 'ok' },
      ],
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
