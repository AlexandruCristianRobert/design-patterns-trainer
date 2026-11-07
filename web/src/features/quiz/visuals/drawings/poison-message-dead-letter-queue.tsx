import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type ChipKind, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const head = [
  'var msg = await receiver.ReceiveMessageAsync();',
  'try',
  '{',
  '    var order = msg.Body.ToObjectFromJson<Order>();',
  '    await HandleAsync(order);',
  '    await receiver.CompleteMessageAsync(msg);',
  '}',
]
const CODE = [...head, 'catch (Exception)', '{', '    await receiver.AbandonMessageAsync(msg);', '}']
const MAX_CODE = ['// queue setting: MaxDeliveryCount = 10 (default)', ...CODE]
const NOW_CODE = [...head, 'catch (JsonException ex) // will never parse', '{', '    await receiver.DeadLetterMessageAsync(msg, "MalformedPayload", ex.Message);', '}']
const COMPLETE_CODE = [...head, 'catch (Exception)', '{', '    await receiver.CompleteMessageAsync(msg);', '}']
const BACKOFF_CODE = [...head, 'catch (Exception)', '{', '    await Task.Delay(backoff); backoff *= 2; // no limit', '    await receiver.AbandonMessageAsync(msg);', '}']
const PRIORITY_CODE = [...head, 'catch (Exception)', '{', '    // back to the head, higher priority', '}']
const L = { PARSE: 3, CATCH: [7, 10] as [number, number], HANDLER: 9, NEXT: [0, 5] as [number, number] }

const QUEUE: RowDef = { id: 'queue', name: 'Queue', tone: 'io' }
const CONSUMER: RowDef = { id: 'consumer', name: 'Consumer', sub: 'attempts', tone: 'ui' }
const DLQ: RowDef = { id: 'dlq', name: 'Dead-letter queue', tone: 'muted' }
const ALERT: RowDef = { id: 'alert', name: 'Alert', sub: 'on DLQ depth', tone: 'bad' }

const c = (key: string, label: string, kind?: ChipKind): Chip => ({ key, label, kind })
const m7 = (label = 'M7 malformed', kind?: ChipKind) => c('m7', label, kind)
const M8 = c('m8', 'M8', 'run')
const M9 = c('m9', 'M9', 'run')
const fail = (n: string) => c(`a${n}`, `#${n} throws`, 'bad')
const EMPTY = c('empty', 'empty', 'gone')
const done = (m: string) => c(`done-${m}`, `${m} ok`, 'ok')

const step = (rows: RowStep['rows'], line: RowStep['line'], bad = false): RowStep => ({ rows, line, bad })

const SPECS: Record<string, RowSpec> = {
  setup: {
    rows: [QUEUE, CONSUMER],
    code: CODE,
    steps: {
      attempt: step({ queue: [m7('M7 malformed', 'run')], consumer: [fail('1')] }, L.PARSE, true),
      abandon: step({ queue: [m7('M7 again', 'run')], consumer: [fail('1')] }, L.HANDLER),
      again: step({ queue: [m7('M7 again', 'run')], consumer: [fail('1'), fail('2'), fail('3'), c('more', '…', 'wait')] }, L.CATCH),
    },
  },
  max: {
    rows: [QUEUE, CONSUMER, DLQ, ALERT],
    code: MAX_CODE,
    steps: {
      fail: step({ queue: [m7('M7 · count 1', 'run'), M8, M9], consumer: [fail('1')] }, L.HANDLER + 1),
      repeat: step({ queue: [m7('M7 · count 10', 'run'), M8, M9], consumer: [fail('1'), fail('2'), c('more', '…', 'bad'), fail('10')] }, L.PARSE + 1, true),
      dead: step({ queue: [M8, M9], consumer: [fail('1'), fail('2'), c('more', '…', 'bad'), fail('10')], dlq: [m7('M7 · 10 deliveries', 'dead')] }, 0),
      moves: step({ queue: [EMPTY], consumer: [done('M8'), done('M9')], dlq: [m7('M7 · 10 deliveries', 'dead')] }, [1, 6]),
      alert: step({ queue: [EMPTY], consumer: [done('M8'), done('M9')], dlq: [m7('M7 · 10 deliveries', 'dead')], alert: [c('al', 'depth 1: team alerted', 'bad')] }, null),
    },
  },
  now: {
    rows: [QUEUE, CONSUMER, DLQ, ALERT],
    code: NOW_CODE,
    steps: {
      parse: step({ queue: [m7('M7 · count 1', 'run'), M8, M9], consumer: [fail('1')] }, { each: [L.PARSE, 7] }, true),
      dead: step({ queue: [M8, M9], consumer: [fail('1')], dlq: [m7('M7 · 1 delivery', 'dead')] }, L.HANDLER),
      alert: step({ queue: [EMPTY], consumer: [done('M8'), done('M9')], dlq: [m7('M7 · 1 delivery', 'dead')], alert: [c('al', 'depth 1: team alerted', 'bad')] }, L.NEXT),
    },
  },

  'complete-claim': {
    rows: [QUEUE, CONSUMER],
    code: COMPLETE_CODE,
    steps: {
      complete: step({ queue: [M8, M9], consumer: [fail('1'), c('rm', 'M7 completed', 'gone')] }, L.HANDLER, true),
      moves: step({ queue: [EMPTY], consumer: [fail('1'), c('rm', 'M7 completed', 'gone'), done('M8'), done('M9')] }, L.NEXT, true),
    },
  },
  'complete-reality': {
    rows: [QUEUE, CONSUMER, DLQ, ALERT],
    code: COMPLETE_CODE,
    steps: {
      complete: step({ queue: [M8, M9], consumer: [fail('1'), c('rm', 'M7 deleted', 'bad')], dlq: [c('none', 'nothing kept', 'gone')] }, L.HANDLER, true),
      moves: step(
        { queue: [EMPTY], consumer: [fail('1'), c('rm', 'M7 deleted', 'bad'), done('M8'), done('M9')], dlq: [c('none', 'nothing kept', 'gone')], alert: [c('al', 'silent: data lost', 'bad')] },
        L.NEXT,
        true,
      ),
    },
  },

  'backoff-claim': {
    rows: [QUEUE, CONSUMER],
    code: BACKOFF_CODE,
    steps: {
      backoff: step({ queue: [m7('M7 malformed', 'run')], consumer: [fail('1'), c('w1', 'wait 1s', 'run'), fail('2'), c('w2', 'wait 2s', 'run'), fail('3')] }, L.HANDLER, true),
      later: step(
        { queue: [m7('M7 malformed', 'run')], consumer: [fail('1'), c('w1', 'wait 1s', 'run'), fail('2'), c('w2', 'wait 2s', 'run'), fail('3'), c('more', '…', 'wait'), c('ok', 'n: parses', 'bad')] },
        L.PARSE,
        true,
      ),
    },
  },
  'backoff-reality': {
    rows: [QUEUE, CONSUMER],
    code: BACKOFF_CODE,
    steps: {
      backoff: step({ queue: [m7('M7 same bytes', 'run')], consumer: [fail('1'), c('w1', 'wait 1s', 'run'), fail('2'), c('w2', 'wait 2s', 'run'), fail('3')] }, L.PARSE, true),
      later: step(
        { queue: [m7('M7 same bytes', 'run')], consumer: [fail('1'), c('w1', 'wait 1s', 'run'), fail('2'), c('w2', 'wait 2s', 'run'), fail('3'), c('more', '…', 'bad'), c('ok', 'n throws, forever', 'bad')] },
        L.PARSE,
        true,
      ),
    },
  },

  'priority-claim': {
    rows: [QUEUE, { ...CONSUMER, id: 'a', name: 'Instance A' }, { ...CONSUMER, id: 'b', name: 'Instance B' }],
    code: PRIORITY_CODE,
    steps: {
      head: step({ queue: [m7('M7 first, high priority', 'bad'), M8, M9], a: [fail('1')] }, L.HANDLER, true),
      other: step({ queue: [M8, M9], a: [fail('1')], b: [c('b-m7', 'M7: its chance', 'run')] }, L.HANDLER, true),
    },
  },
  'priority-reality': {
    rows: [QUEUE, { ...CONSUMER, id: 'a', name: 'Instance A' }, { ...CONSUMER, id: 'b', name: 'Instance B' }],
    code: PRIORITY_CODE,
    steps: {
      head: step({ queue: [m7('M7 first, high priority', 'bad'), M8, M9], a: [fail('1')] }, L.HANDLER),
      other: step({ queue: [m7('M7 first again', 'bad'), c('m8', 'M8 waits', 'run'), c('m9', 'M9 waits', 'run')], a: [fail('1'), fail('3')], b: [fail('2')] }, L.PARSE, true),
    },
  },
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
