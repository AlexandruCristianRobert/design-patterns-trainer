import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const PLAIN_CODE = [
  'db.Orders.Add(order);',
  'await db.SaveChangesAsync(); // commit',
  'await broker.PublishAsync(new OrderPlaced(order.Id));',
]
const P = { SAVE: [0, 1] as [number, number], PUBLISH: 2 }
const OUTBOX_CODE = [
  'db.Orders.Add(order);',
  'db.Outbox.Add(OutboxMessage.From(new OrderPlaced(order.Id)));',
  'await db.SaveChangesAsync(); // one local transaction',
  '',
  '// the relay, in the background:',
  'foreach (var m in db.Outbox.Where(m => m.SentAt == null))',
  '{',
  '    await broker.PublishAsync(m);',
  '    m.SentAt = now; await db.SaveChangesAsync();',
  '}',
]
const O = { TX: [0, 2] as [number, number], READ: 5, PUBLISH: 7, MARK: 8 }
const TWO_PC_CODE = ['// the claim, as pseudo-code:', 'db.Prepare(); broker.Prepare();', 'db.Commit();  broker.Commit();  // or both roll back']
const BATCH_CODE = [
  '// the claim, as pseudo-code:',
  'buffer.Add(new OrderPlaced(order.Id)); // in memory',
  'every few seconds: broker.PublishBatch(buffer); buffer.Clear();',
]

const SVC: SeqActor = { id: 'svc', name: 'Order service', tone: 'ui' }
const DB: SeqActor = { id: 'db', name: 'Database', tone: 'io' }
const RELAY: SeqActor = { id: 'relay', name: 'Relay', sub: 'background', tone: 'pool' }
const BROKER: SeqActor = { id: 'broker', name: 'Broker', tone: 'muted' }
const THREE = [SVC, DB, BROKER]
const FOUR = [SVC, DB, RELAY, BROKER]

const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const state = (order: string, event: string, eventKind?: OutLine['kind'], orderKind?: OutLine['kind']): OutLine[] => [
  { label: 'Order', text: order, kind: order === '?' ? 'muted' : orderKind },
  { label: 'OrderPlaced', text: event, kind: event === '?' ? 'muted' : eventKind },
]
const seq = (actors: SeqActor[], code: string[] | null, steps: Record<string, SeqStep>): SeqSpec => ({ actors, code: code ?? undefined, outputName: 'State', steps })

// ---- Setup and the plain version ----
const save = row('save', 'svc', 'INSERT order, COMMIT', 'db')
const publish = row('publish', 'svc', 'publish OrderPlaced', 'broker')
const crash = row('crash', 'svc', 'crash', undefined, 'bad')

// ---- The outbox ----
const tx = row('tx', 'svc', 'order + outbox row, COMMIT', 'db', 'ok')
const read = row('read', 'relay', 'read unsent', 'db')
const relayPub = row('rpub', 'relay', 'publish', 'broker')
const mark = row('mark', 'relay', 'mark sent', 'db')
const SENT_ONCE = state('saved', 'published, row marked sent', 'ok', 'ok')

const SPECS: Record<string, SeqSpec> = {
  setup: seq(THREE, PLAIN_CODE, {
    save: { rows: [save], line: P.SAVE, output: state('saved', '?') },
    publish: { rows: [save, publish], line: P.PUBLISH, output: state('saved', 'published') },
    question: { rows: [save, publish, row('q', 'svc', 'Transactional Outbox solves: ?', undefined, 'muted')], line: null, output: state('saved', 'published') },
  }),

  without: seq(THREE, PLAIN_CODE, {
    commit: { rows: [save], line: P.SAVE, output: state('saved', 'not yet') },
    crash: { rows: [save, crash], line: P.PUBLISH, bad: true, output: state('saved', 'not yet') },
    lost: { rows: [save, crash, row('publish', 'svc', 'publish OrderPlaced: never sent', 'broker', 'skip')], line: P.PUBLISH, bad: true, output: state('saved', 'lost', 'bad') },
  }),
  'with-outbox': seq(FOUR, OUTBOX_CODE, {
    tx: { rows: [tx], line: O.TX, output: state('saved', 'stored in the outbox', 'ok', 'ok') },
    crash: { rows: [tx, row('crash', 'svc', 'crash: nothing lost', undefined, 'ok')], line: O.TX, output: state('saved', 'stored in the outbox', 'ok', 'ok') },
    relay: { rows: [tx, read, relayPub], line: [O.READ, O.PUBLISH], output: state('saved', 'published', 'ok', 'ok') },
    mark: { rows: [tx, read, relayPub, mark], line: O.MARK, output: SENT_ONCE },
    again: {
      rows: [tx, read, relayPub, row('rcrash', 'relay', 'crash before mark?'), row('again', 'relay', '…publish again', 'broker', 'bad')],
      line: [O.PUBLISH, O.MARK],
      output: state('saved', 'at least once: maybe twice', 'bad', 'ok'),
    },
  }),

  'exactly-once-claim': seq(FOUR, OUTBOX_CODE, {
    publish: { rows: [tx, read, row('rpub', 'relay', 'publish, exactly once', 'broker')], line: O.PUBLISH, output: state('saved', 'delivered once') },
    consumer: {
      rows: [tx, read, row('rpub', 'relay', 'publish, exactly once', 'broker'), row('nodup', 'broker', 'no dedup')],
      line: O.PUBLISH,
      output: state('saved', 'delivered once, no dedup needed'),
    },
  }),
  'exactly-once-reality': seq(FOUR, OUTBOX_CODE, {
    publish: { rows: [tx, read, relayPub], line: O.PUBLISH, output: state('saved', 'published once', 'plain', 'ok') },
    crash: { rows: [tx, read, relayPub, row('rcrash', 'relay', 'crash before mark', undefined, 'bad')], line: O.MARK, bad: true, output: state('saved', 'published, row still unsent', 'bad', 'ok') },
    again: {
      rows: [tx, read, relayPub, row('rcrash', 'relay', 'crash before mark', undefined, 'bad'), row('reread', 'relay', 'restart: row still unsent', 'db'), row('again', 'relay', 'publish again', 'broker', 'bad')],
      line: [O.READ, O.PUBLISH],
      output: state('saved', 'published twice: consumers must dedupe', 'bad', 'ok'),
    },
  }),

  'two-phase-claim': seq(THREE, TWO_PC_CODE, {
    prepare: { rows: [row('pdb', 'svc', 'PREPARE', 'db'), row('pbr', 'svc', 'PREPARE', 'broker')], line: 1, output: state('prepared', 'prepared') },
    commit: {
      rows: [row('pdb', 'svc', 'PREPARE', 'db'), row('pbr', 'svc', 'PREPARE', 'broker'), row('cdb', 'svc', 'COMMIT', 'db'), row('cbr', 'svc', 'COMMIT', 'broker')],
      line: 2,
      output: state('committed together', 'committed together'),
    },
  }),
  'two-phase-reality': seq(FOUR, OUTBOX_CODE, {
    local: { rows: [tx], line: O.TX, output: state('saved', 'in the outbox, same local transaction', 'ok', 'ok') },
    broker: { rows: [tx, read, relayPub], line: [O.READ, O.PUBLISH], output: state('saved', 'published later, outside the transaction', 'ok', 'ok') },
    why: {
      rows: [tx, read, relayPub, row('nopb', 'svc', 'no PREPARE to the broker', 'broker', 'skip')],
      line: O.TX,
      output: state('saved', 'no distributed transaction involved', 'ok', 'ok'),
    },
  }),

  'batch-claim': seq(THREE, BATCH_CODE, {
    buffer: { rows: [save, row('buf', 'svc', 'buffer: #1, #2, #3')], line: 1, output: state('saved', 'in the buffer') },
    flush: { rows: [save, row('buf', 'svc', 'buffer: #1, #2, #3'), row('flush', 'svc', 'every few seconds: batch of 3', 'broker')], line: 2, output: state('saved', 'published in a batch') },
  }),
  'batch-reality': seq(FOUR, null, {
    buffer: {
      rows: [save, row('buf', 'svc', 'buffer: #1, #2, #3'), row('crash', 'svc', 'crash: buffer gone', undefined, 'bad'), row('flush', 'svc', 'batch: never sent', 'broker', 'skip')],
      line: null,
      output: state('saved', 'lost with the buffer', 'bad'),
    },
    durable: { rows: [tx], line: O.TX, output: state('saved', 'stored in the outbox table', 'ok', 'ok') },
    batch: { rows: [tx, read, row('rpub', 'relay', 'publish (maybe batched)', 'broker')], line: [O.READ, O.PUBLISH], output: state('saved', 'published from the table', 'ok', 'ok') },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
