import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'var msg = await receiver.ReceiveMessageAsync();',
  'await stock.ReserveAsync(msg);',
  'await receiver.CompleteMessageAsync(msg);',
]
const L = { RECEIVE: 0, UPDATE: 1, ACK: 2 }

const BROKER: SeqActor = { id: 'broker', name: 'Queue', sub: 'message broker', tone: 'pool' }
const CONSUMER: SeqActor = { id: 'consumer', name: 'Consumer', tone: 'ui' }
const DB: SeqActor = { id: 'db', name: 'Database', sub: 'stock', tone: 'io' }
const spec = (steps: Record<string, SeqStep>, actors: SeqActor[] = [BROKER, CONSUMER, DB]): SeqSpec => ({ actors, code: CODE, outputName: 'Outcome', steps })
const DEDUP_ACTORS: SeqActor[] = [{ id: 'sender', name: 'Sender', tone: 'muted' }, { ...BROKER, sub: 'duplicate detection on' }, CONSUMER, DB]

const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const out = (stock: string, processed: string, kind: OutLine['kind'] = 'plain', m1?: string, m1Kind?: OutLine['kind']): OutLine[] => [
  ...(m1 ? [{ label: 'M1', text: m1, kind: m1Kind }] : []),
  { label: 'Stock', text: stock },
  { label: 'Times processed', text: processed, kind },
]

const deliver = row('deliver', 'broker', 'deliver M1', 'consumer')
const kept = row('kept', 'broker', 'M1 kept, locked')
const update = row('update', 'consumer', 'reserve 1', 'db')
const commit = row('commit', 'db', 'stock 10 → 9')
const crash = row('crash', 'consumer', 'process crashes', undefined, 'bad')
const expire = row('expire', 'broker', 'M1 back after timeout')
const deliver2 = row('deliver2', 'broker', 'deliver M1 again', 'consumer')
const update2 = row('update2', 'consumer', 'reserve 1 again', 'db', 'bad')
const commit2 = row('commit2', 'db', 'stock 9 → 8', undefined, 'bad')
const ack = row('ack', 'consumer', 'ack', 'broker')
const removed = row('removed', 'broker', 'M1 removed')

/** The real run with a crash between the commit and the ack. */
const C = {
  receive: { rows: [deliver, kept], line: L.RECEIVE, output: out('10', '0', 'plain', 'kept, locked') },
  update: { rows: [deliver, kept, update, commit], line: L.UPDATE, output: out('9', '1', 'plain', 'kept, locked') },
  crash: { rows: [deliver, kept, update, commit, crash], line: L.ACK, bad: true, output: out('9', '1', 'plain', 'kept, locked') },
  redeliver: { rows: [deliver, kept, update, commit, crash, expire, deliver2], line: L.RECEIVE, output: out('9', '1', 'plain', 'delivered again', 'ok') },
  again: {
    rows: [deliver, kept, update, commit, crash, expire, deliver2, update2, commit2, ack, removed],
    line: { each: [L.UPDATE, L.ACK] },
    output: out('8', '2', 'bad', 'removed'),
  },
} satisfies Record<string, SeqStep>

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    receive: { rows: [deliver], line: L.RECEIVE, output: [{ label: 'Guarantee', text: '?', kind: 'muted' }] },
    update: { rows: [deliver, update, row('commit', 'db', 'commit')], line: L.UPDATE, output: [{ label: 'Guarantee', text: '?', kind: 'muted' }] },
    ack: { rows: [deliver, update, row('commit', 'db', 'commit'), ack], line: L.ACK, output: [{ label: 'Guarantee', text: '?', kind: 'muted' }] },
    crash: {
      rows: [deliver, update, row('commit', 'db', 'commit'), ack, row('crash', 'consumer', 'crash: when?', undefined, 'muted')],
      line: [0, 2],
      output: [{ label: 'Guarantee', text: '?', kind: 'muted' }],
    },
  }),
  'crash-before-ack': spec({
    ...C,
    result: { ...C.again, line: null, output: [...out('8', '2', 'bad', 'removed'), { label: 'Lost', text: 'nothing', kind: 'ok' }] },
  }),
  'crash-before-update': spec({
    receive: C.receive,
    crash: { rows: [deliver, kept, row('crash', 'consumer', 'process crashes', undefined, 'bad')], line: L.UPDATE, bad: true, output: out('10', '0', 'plain', 'kept, locked') },
    redeliver: { rows: [deliver, kept, row('crash', 'consumer', 'process crashes', undefined, 'bad'), expire, deliver2], line: L.RECEIVE, output: out('10', '0', 'plain', 'delivered again', 'ok') },
    done: {
      rows: [deliver, kept, row('crash', 'consumer', 'process crashes', undefined, 'bad'), expire, deliver2, row('update2', 'consumer', 'reserve 1', 'db'), commit, ack, removed],
      line: { each: [L.UPDATE, L.ACK] },
      output: out('9', '1', 'ok', 'removed'),
    },
  }),

  'exactly-once-claim': spec({
    update: { rows: [deliver, update, commit], line: L.UPDATE, output: out('9', '1') },
    crash: {
      rows: [deliver, update, commit, crash, row('rule', 'broker', 'deletes M1 only on ack')],
      line: L.ACK,
      bad: true,
      output: out('9', 'exactly once', 'bad'),
    },
  }),
  'exactly-once-reality': spec({
    update: { rows: [deliver, update, commit], line: L.UPDATE, output: out('9', '1') },
    crash: { rows: [deliver, update, commit, crash, expire, deliver2, update2, commit2], line: L.UPDATE, output: out('8', '2', 'bad') },
  }),

  'at-most-once-claim': spec({
    receive: { rows: [deliver, row('kept', 'broker', 'M1 counted delivered', undefined, 'bad')], line: L.RECEIVE, bad: true, output: [{ label: 'M1', text: 'delivered' }] },
    crash: {
      rows: [deliver, row('kept', 'broker', 'M1 counted delivered', undefined, 'bad'), crash, row('lost', 'broker', 'M1 lost', undefined, 'bad')],
      line: L.ACK,
      bad: true,
      output: [{ label: 'M1', text: 'lost', kind: 'bad' }],
    },
  }),
  'at-most-once-reality': spec({
    receive: { rows: [deliver, row('kept', 'broker', 'M1 kept, locked', undefined, 'ok')], line: L.RECEIVE, output: [{ label: 'M1', text: 'kept, locked' }] },
    crash: {
      rows: [deliver, row('kept', 'broker', 'M1 kept, locked', undefined, 'ok'), crash, expire, deliver2],
      line: L.RECEIVE,
      output: [{ label: 'M1', text: 'delivered again, not lost', kind: 'ok' }],
    },
  }),

  'duplicate-detection-claim': spec(
    {
      enable: { rows: [row('send', 'sender', 'send M1', 'broker')], line: null, output: out('10', '0') },
      crash: {
        rows: [row('send', 'sender', 'send M1', 'broker'), deliver, update, commit, crash],
        line: L.ACK,
        bad: true,
        output: out('9', 'exactly once', 'bad'),
      },
    },
    DEDUP_ACTORS,
  ),
  'duplicate-detection-reality': spec(
    {
      enable: {
        rows: [row('send', 'sender', 'send M1', 'broker'), row('resend', 'sender', 'send M1 again', 'broker'), row('drop', 'broker', 'second send dropped', undefined, 'ok')],
        line: null,
        output: out('10', '0'),
      },
      crash: {
        rows: [
          row('send', 'sender', 'send M1', 'broker'),
          row('resend', 'sender', 'send M1 again', 'broker'),
          row('drop', 'broker', 'second send dropped', undefined, 'ok'),
          deliver,
          update,
          commit,
          crash,
          expire,
          deliver2,
          update2,
          commit2,
        ],
        line: L.UPDATE,
        output: out('8', '2', 'bad'),
      },
    },
    DEDUP_ACTORS,
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
