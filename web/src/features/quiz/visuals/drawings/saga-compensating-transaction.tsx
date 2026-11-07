import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

// Soft hyphens let long labels break cleanly in a narrow column.
const actors: SeqActor[] = [
  { id: 'saga', name: 'Order saga', tone: 'muted' },
  { id: 'pay', name: 'Payment service', tone: 'ui' },
  { id: 'db', name: 'Payment DB', tone: 'io' },
  { id: 'stock', name: 'Stock service', tone: 'pool' },
]
const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const spec = (steps: Record<string, SeqStep>): SeqSpec => ({ actors, outputName: 'State', steps })
const state = (payment: string, money: string, stock: string, kinds: [OutLine['kind']?, OutLine['kind']?, OutLine['kind']?] = []): OutLine[] => [
  { label: 'Payment', text: payment, kind: payment === '?' ? 'muted' : kinds[0] },
  { label: 'Money', text: money, kind: money === '?' ? 'muted' : kinds[1] },
  { label: 'Stock', text: stock, kind: stock === '?' ? 'muted' : kinds[2] },
]

// ---- The neutral Setup: no transactions mentioned ----
const capture = row('capture', 'saga', 'capture payment', 'pay')
const captured = row('captured', 'pay', 'captured', 'saga')
const reserve = row('reserve', 'saga', 'reserve item', 'stock')
const outOfStock = row('oos', 'stock', 'out of stock', 'saga', 'bad')

// ---- Reality: a committed local transaction per step ----
const commit = row('commit', 'pay', 'INSERT capture, COMMIT', 'db', 'ok')
const PAID = [capture, commit, captured]
const FAILED = [...PAID, reserve, outOfStock]
const refund = row('refund', 'saga', 'Refund­Payment', 'pay', 'ok')
const refundCommit = row('rcommit', 'pay', 'INSERT refund, COMMIT', 'db', 'ok')
const LOCAL_FAILED = [...PAID, reserve, row('local', 'stock', 'nothing com­mitted'), outOfStock]

const CAPTURED = state('captured, committed', 'taken from the customer', '…')
const OOS = state('captured, committed', 'taken from the customer', 'out of stock', [undefined, undefined, 'bad'])
const BACK = state('captured, then refunded', 'back with the customer', 'out of stock', ['ok', 'ok', 'bad'])

/** The claims start from a capture they do not speak about: neutral rows. */
const neutralFailed = [capture, row('commit', 'pay', 'store capture', 'db', 'muted'), captured, reserve, outOfStock]
const NEUTRAL_OOS = state('captured', 'taken from the customer', 'out of stock', [undefined, undefined, 'bad'])

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    pay: { rows: [capture, captured], output: state('captured', 'taken from the customer', '…') },
    stock: { rows: [capture, captured, reserve, outOfStock], output: state('captured', 'taken from the customer', 'out of stock', [undefined, undefined, 'bad']) },
    question: { rows: [capture, captured, reserve, outOfStock, row('q', 'saga', 'undo: ?', undefined, 'muted')], output: state('?', '?', 'out of stock', [undefined, undefined, 'bad']) },
  }),
  compensate: spec({
    pay: { rows: PAID, output: CAPTURED },
    stock: { rows: LOCAL_FAILED, output: OOS },
    refund: { rows: [...LOCAL_FAILED, refund, refundCommit], output: BACK },
    done: { rows: [...LOCAL_FAILED, refund, refundCommit, row('cancel', 'saga', 'order can­celled', undefined, 'ok')], output: BACK },
  }),
  idempotent: spec({
    refund: { rows: [row('r1', 'saga', 'Refund­Payment r1', 'pay', 'ok'), row('c1', 'pay', 'refund r1, COMMIT', 'db', 'ok')], output: [{ label: 'Refunds', text: 'r1', kind: 'ok' }] },
    again: {
      rows: [row('r1', 'saga', 'Refund­Payment r1', 'pay', 'ok'), row('c1', 'pay', 'refund r1, COMMIT', 'db', 'ok'), row('r1b', 'saga', 'Refund­Payment r1, again', 'pay')],
      output: [{ label: 'Refunds', text: 'r1' }],
    },
    noop: {
      rows: [row('r1', 'saga', 'Refund­Payment r1', 'pay', 'ok'), row('c1', 'pay', 'refund r1, COMMIT', 'db', 'ok'), row('r1b', 'saga', 'Refund­Payment r1, again', 'pay'), row('noop', 'pay', 'r1 already done: no-op', undefined, 'ok')],
      output: [{ label: 'Refunds', text: 'r1, once', kind: 'ok' }],
    },
  }),

  'rollback-claim': spec({
    pay: { rows: [capture, row('commit', 'pay', 'BEGIN, INSERT capture, kept open', 'db', 'bad'), captured], output: state('captured, transaction open', 'taken from the customer', '…', ['bad']) },
    stock: { rows: [capture, row('commit', 'pay', 'BEGIN, INSERT capture, kept open', 'db', 'bad'), captured, reserve, outOfStock], output: state('captured, transaction open', 'taken from the customer', 'out of stock', ['bad', undefined, 'bad']) },
    rollback: {
      rows: [capture, row('commit', 'pay', 'BEGIN, INSERT capture, kept open', 'db', 'bad'), captured, reserve, outOfStock, row('rb', 'saga', 'roll back', 'pay', 'bad'), row('rbdb', 'pay', 'ROLLBACK', 'db', 'bad')],
      output: state('rolled back', 'never captured', 'out of stock', ['bad', 'bad', 'bad']),
    },
  }),
  'rollback-reality': spec({
    pay: { rows: PAID, output: CAPTURED },
    stock: { rows: FAILED, output: OOS },
    rollback: { rows: [...FAILED, row('rb', 'saga', 'roll back: nothing open', 'pay', 'skip'), refund, refundCommit], output: BACK },
  }),

  'delete-claim': spec({
    stock: { rows: neutralFailed, output: NEUTRAL_OOS },
    delete: { rows: [...neutralFailed, row('del', 'saga', 'DELETE payment row', 'db', 'bad')], output: state('row deleted', 'as if never captured', 'out of stock', ['bad', 'bad', 'bad']) },
  }),
  'delete-reality': spec({
    stock: { rows: neutralFailed, output: NEUTRAL_OOS },
    delete: { rows: [...neutralFailed, row('del', 'saga', 'DELETE payment row', 'db', 'bad')], output: state('row deleted', 'still taken, at the provider', 'out of stock', ['bad', 'bad', 'bad']) },
    refund: { rows: [...neutralFailed, row('del', 'saga', 'no DELETE in its DB', 'db', 'skip'), refund, refundCommit], output: BACK },
  }),

  'retry-claim': spec({
    stock: { rows: neutralFailed, output: NEUTRAL_OOS },
    retry: {
      rows: [...neutralFailed, row('retry1', 'saga', 'reserve item, retry', 'stock', 'bad'), row('until', 'saga', '… until it succeeds', 'stock', 'bad')],
      output: state('captured, never undone', 'taken from the customer', 'reserved, eventually', [undefined, undefined, 'bad']),
    },
  }),
  'retry-reality': spec({
    stock: { rows: neutralFailed, output: NEUTRAL_OOS },
    retry: {
      rows: [...neutralFailed, row('retry1', 'saga', 'reserve item, retry', 'stock'), row('oos2', 'stock', 'out of stock', 'saga', 'bad'), row('retry2', 'saga', 'retry again', 'stock'), row('oos3', 'stock', 'out of stock', 'saga', 'bad')],
      output: state('captured', 'taken from the customer', 'out of stock, every time', [undefined, undefined, 'bad']),
    },
    refund: { rows: [...neutralFailed, row('retry1', 'saga', 'retries: out of stock', 'stock', 'muted'), refund, refundCommit], output: BACK },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
