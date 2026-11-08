import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'if (await redis.SetContainsAsync("seen", msg.Id)) return;',
  'await ProcessInSqlTransactionAsync(msg); // commits',
  'await redis.SetAddAsync("seen", msg.Id);',
]
const L = { CHECK: 0, PROCESS: 1, ADD: 2 }
const INBOX_CODE = [
  'db.Inbox.Add(new InboxMessage(msg.Id)); // unique key',
  'ApplyBusinessChange(db, msg);',
  'await db.SaveChangesAsync(); // one transaction',
]
const I = { ALL: [0, 2] as [number, number] }
const BEFORE_CODE = [
  'if (!await redis.SetAddAsync("seen", msg.Id)) return;',
  'await ProcessInSqlTransactionAsync(msg); // commits',
]

const BROKER: SeqActor = { id: 'broker', name: 'Broker', tone: 'muted' }
const CONS: SeqActor = { id: 'cons', name: 'Consumer', tone: 'ui' }
const SQL: SeqActor = { id: 'sql', name: 'SQL', tone: 'io' }
const REDIS: SeqActor = { id: 'redis', name: 'Redis', tone: 'pool' }

const spec = (steps: Record<string, SeqStep>, code: string[] | null = CODE, actors = [BROKER, CONS, SQL, REDIS]): SeqSpec => ({
  actors,
  code: code ?? undefined,
  outputName: 'Outcome',
  steps,
})
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const processed = (text: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'm1 processed', text, kind }]

// ---- Today: check, process, add ----
const m1 = msg('m1', 'broker', 'cons', 'm1')
const check = msg('check', 'cons', 'redis', 'm1 seen?')
const no = msg('no', 'redis', 'cons', 'no')
const commit = msg('commit', 'cons', 'sql', 'commit')
const add = msg('add', 'cons', 'redis', 'add m1')
const crash = note('crash', 'cons', 'crash', 'bad')
const noAdd = msg('add', 'cons', 'redis', 'add m1', 'skip')
const noAck = msg('ack', 'cons', 'broker', 'ack', 'skip')
const again = msg('again', 'broker', 'cons', 'm1 again')
const check2 = msg('check2', 'cons', 'redis', 'm1 seen?')
const no2 = msg('no2', 'redis', 'cons', 'no')
const commit2 = msg('commit2', 'cons', 'sql', 're-commit', 'bad')

const CHECKED = [m1, check, no]
const COMMITTED = [...CHECKED, commit]
const CRASHED = [...COMMITTED, crash, noAdd, noAck]
const TWICE = [...CRASHED, again, check2, no2, commit2]

// ---- Inbox ----
const tx = msg('tx', 'cons', 'sql', 'm1 + change', 'ok')
const INBOX_COMMIT = [m1, tx, note('saved', 'sql', 'committed', 'ok')]
const INBOX_CRASH = [...INBOX_COMMIT, crash, noAck, again]

// ---- Claims ----
const addFirst = msg('add', 'cons', 'redis', 'add m1')
const seen = msg('seen', 'redis', 'cons', 'seen')
const FLOW = [m1, check, no, commit, add]

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    check: { rows: CHECKED, line: L.CHECK },
    process: { rows: COMMITTED, line: L.PROCESS },
    record: { rows: FLOW, line: L.ADD },
    question: { rows: FLOW, line: null, output: [{ label: 'Duplicates', text: 'processed now and then' }] },
  }),
  gap: spec({
    deliver: { rows: CHECKED, line: L.CHECK },
    commit: { rows: COMMITTED, line: L.PROCESS, output: processed('once') },
    crash: { rows: CRASHED, line: L.ADD, bad: true, output: processed('once') },
    redeliver: { rows: TWICE, line: L.PROCESS, bad: true, output: processed('twice', 'bad') },
  }),
  inbox: spec(
    {
      commit: { rows: INBOX_COMMIT, line: I.ALL, output: processed('once') },
      crash: { rows: INBOX_CRASH, line: null, output: processed('once') },
      redeliver: {
        rows: [...INBOX_CRASH, msg('tx2', 'cons', 'sql', 'm1 + change'), msg('dup', 'sql', 'cons', 'dup key', 'ok'), msg('ack2', 'cons', 'broker', 'skip, ack', 'ok')],
        line: 0,
        output: processed('once', 'ok'),
      },
    },
    INBOX_CODE,
    [BROKER, CONS, SQL],
  ),

  'before-claim': spec(
    {
      add: { rows: [m1, addFirst], line: 0 },
      redeliver: { rows: [m1, addFirst, again, msg('check2', 'cons', 'redis', 'add m1'), seen, note('rej', 'cons', 'rejected')], line: 0 },
    },
    BEFORE_CODE,
  ),
  'before-reality': spec(
    {
      add: { rows: [m1, addFirst], line: 0 },
      fail: { rows: [m1, addFirst, msg('commit', 'cons', 'sql', 'process'), crash, note('rb', 'sql', 'rolled back', 'bad')], line: 1, bad: true },
      redeliver: {
        rows: [m1, addFirst, msg('commit', 'cons', 'sql', 'process'), crash, note('rb', 'sql', 'rolled back', 'bad'), again, msg('check2', 'cons', 'redis', 'add m1'), seen, note('rej', 'cons', 'skipped', 'bad')],
        line: 0,
        bad: true,
        output: processed('never', 'bad'),
      },
    },
    BEFORE_CODE,
  ),

  'multi-claim': spec({
    flow: { rows: FLOW, line: null },
    multi: { rows: [...FLOW, note('multi', 'redis', 'MULTI/EXEC')], line: { each: [L.CHECK, L.ADD] } },
  }),
  'multi-reality': spec({
    flow: { rows: FLOW, line: null },
    multi: { rows: [...FLOW, note('multi', 'redis', 'MULTI/EXEC'), note('own', 'sql', 'own commit', 'bad')], line: { each: [L.CHECK, L.ADD] } },
    crash: { rows: [...CRASHED, note('multi', 'redis', 'MULTI/EXEC', 'skip'), again, check2, no2, commit2], line: L.ADD, bad: true, output: processed('twice', 'bad') },
  }),

  'broker-claim': spec(
    {
      enable: { rows: [note('dd', 'broker', 'dedupe on'), m1, note('never', 'broker', 'never again', 'bad')], line: null },
      once: { rows: [note('dd', 'broker', 'dedupe on'), m1, note('never', 'broker', 'never again', 'bad'), msg('again', 'broker', 'cons', 'm1 again', 'skip')], line: null, output: processed('once') },
    },
    null,
    [BROKER, CONS, SQL],
  ),
  'broker-reality': spec(
    {
      enable: { rows: [note('dd', 'broker', 'drops resends', 'ok'), m1], line: null },
      crash: { rows: [note('dd', 'broker', 'drops resends', 'ok'), m1, commit, crash, noAck], line: null, output: processed('once') },
      redeliver: {
        rows: [note('dd', 'broker', 'drops resends', 'ok'), m1, commit, crash, noAck, again, msg('commit2', 'cons', 'sql', 're-commit', 'bad')],
        line: null,
        output: processed('twice', 'bad'),
      },
    },
    null,
    [BROKER, CONS, SQL],
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
