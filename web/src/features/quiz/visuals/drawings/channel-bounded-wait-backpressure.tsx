import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type ChipKind, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const PRODUCER_LOOP = ['// producer', 'await foreach (var msg in ReadMessagesAsync(socket, ct))']
const CONSUMER_LOOP = ['// consumer', 'await foreach (var msg in channel.Reader.ReadAllAsync(ct))', '    await store.SaveAsync(msg, ct);']

const WAIT_CODE = [
  'var channel = Channel.CreateBounded<Message>(new BoundedChannelOptions(3)',
  '{',
  '    FullMode = BoundedChannelFullMode.Wait',
  '});',
  '',
  ...PRODUCER_LOOP,
  '    await channel.Writer.WriteAsync(msg, ct);',
  '',
  ...CONSUMER_LOOP,
]
const W = { CREATE: [0, 3] as [number, number], WRITE: 7, READ: [10, 11] as [number, number] }

const SINGLE_CODE = [
  'var channel = Channel.CreateUnbounded<Message>(new UnboundedChannelOptions',
  '{',
  '    SingleReader = true',
  '});',
  '',
  ...PRODUCER_LOOP,
  '    await channel.Writer.WriteAsync(msg, ct);',
  '',
  ...CONSUMER_LOOP,
]
const S = { OPTIONS: 2, WRITE: 7 }

const TRY_CODE = [
  'var channel = Channel.CreateBounded<Message>(3);',
  '',
  ...PRODUCER_LOOP,
  '    channel.Writer.TryWrite(msg);  // result ignored',
  '',
  ...CONSUMER_LOOP,
]
const T = { WRITE: 4 }

const READ_ALL_CODE = [
  'var channel = Channel.CreateUnbounded<Message>();',
  '',
  ...PRODUCER_LOOP,
  '    await channel.Writer.WriteAsync(msg, ct);',
  '',
  ...CONSUMER_LOOP,
]
const R = { WRITE: 4, READ: 7 }

const SOCKET: RowDef = { id: 'socket', name: 'Socket', sub: 'not read yet', tone: 'io' }
const PRODUCER: RowDef = { id: 'producer', name: 'Producer', sub: 'reads, then writes', tone: 'ui' }
const BOUNDED: RowDef = { id: 'channel', name: 'Channel', sub: 'capacity 3', tone: 'pool', slots: 3, ends: ['read next', 'newest'] }
const UNBOUNDED: RowDef = { id: 'channel', name: 'Channel', sub: 'unbounded', tone: 'pool' }
const CONSUMER: RowDef = { id: 'consumer', name: 'Consumer', sub: 'saves one at a time', tone: 'ui' }
const LOST: RowDef = { id: 'lost', name: 'Lost', sub: 'never written', tone: 'bad' }

const m = (n: number, kind: ChipKind = 'item'): Chip => ({ key: `m${n}`, label: `m${n}`, kind })
/** The socket's unread messages, from `first` on. */
const socket = (first: number): Chip[] => [...[0, 1, 2].map((i) => m(first + i)), { key: 'more', label: '…', kind: 'item' }]
const range = (from: number, to: number, kind: ChipKind = 'item'): Chip[] => Array.from({ length: to - from + 1 }, (_, i) => m(from + i, kind))
const op = (key: string, label: string, kind: ChipKind): Chip => ({ key, label, kind })
const saving = (n: number, saved?: number): Chip[] => [...(saved ? [op(`saved${saved}`, `m${saved} saved`, 'ok')] : []), op(`saving${n}`, `saving m${n}`, 'wait')]

const spec = (rows: RowDef[], code: string[] | undefined, steps: Record<string, RowStep>): RowSpec => ({ rows, code, steps })

const WAIT_ROWS = [SOCKET, PRODUCER, BOUNDED, CONSUMER]
const UNBOUNDED_ROWS = [SOCKET, PRODUCER, UNBOUNDED, CONSUMER]

const SPECS: Record<string, RowSpec> = {
  setup: spec([SOCKET, PRODUCER, { id: 'channel', name: 'Channel', sub: 'which setup?', tone: 'pool' }, CONSUMER], undefined, {
    fast: { rows: { socket: socket(1), producer: [op('fast', 'reads fast', 'run')] } },
    slow: { rows: { socket: socket(1), producer: [op('fast', 'reads fast', 'run')], consumer: [op('slow', 'saves slowly', 'wait')] } },
    between: { rows: { socket: socket(1), producer: [op('fast', 'reads fast', 'run')], channel: [op('q', '?', 'gone')], consumer: [op('slow', 'saves slowly', 'wait')] } },
  }),

  'bounded-wait': spec(WAIT_ROWS, WAIT_CODE, {
    fill: { rows: { socket: socket(5), producer: [op('w', 'wrote m2 m3 m4', 'run')], channel: range(2, 4), consumer: saving(1) }, line: W.WRITE },
    full: {
      rows: { socket: socket(6), producer: [op('w5', 'await WriteAsync(m5)', 'wait'), op('thread', 'no thread blocked', 'ok')], channel: range(2, 4), consumer: saving(1) },
      line: W.WRITE,
    },
    slot: { rows: { socket: socket(6), producer: [op('w5', 'WriteAsync(m5) done', 'ok')], channel: range(3, 5), consumer: saving(2, 1) }, line: W.READ },
    pace: { rows: { socket: socket(7), producer: [op('w6', 'await WriteAsync(m6)', 'wait')], channel: range(3, 5), consumer: saving(2, 1) }, line: W.WRITE },
  }),

  'single-reader-claim': spec(UNBOUNDED_ROWS, SINGLE_CODE, {
    write: { rows: { socket: socket(3), producer: [op('w2', 'await WriteAsync(m2)', 'wait')], channel: [m(2)], consumer: saving(1) }, line: S.WRITE, bad: true },
    pace: { rows: { socket: socket(4), producer: [op('w3', 'await WriteAsync(m3)', 'wait')], channel: [m(3)], consumer: saving(2, 1) }, line: S.OPTIONS, bad: true },
  }),
  'single-reader-reality': spec(UNBOUNDED_ROWS, SINGLE_CODE, {
    write: { rows: { socket: socket(3), producer: [op('w2', 'WriteAsync(m2) done', 'ok')], channel: [m(2)], consumer: saving(1) }, line: S.OPTIONS },
    grows: { rows: { socket: socket(8), producer: [op('w7', 'WriteAsync(m7) done', 'ok')], channel: range(2, 7, 'bad'), consumer: saving(1) }, line: S.WRITE, bad: true },
  }),

  'try-write-claim': spec([SOCKET, PRODUCER, BOUNDED, CONSUMER], TRY_CODE, {
    full: { rows: { socket: socket(5), producer: [op('w', 'wrote m2 m3 m4', 'run')], channel: range(2, 4), consumer: saving(1) }, line: T.WRITE },
    'never-waits': {
      rows: { socket: socket(8), producer: [op('t5', 'TryWrite(m5)', 'run'), op('t6', 'TryWrite(m6)', 'run'), op('t7', 'TryWrite(m7)', 'run')], channel: range(2, 4), consumer: saving(1) },
      line: T.WRITE,
    },
  }),
  'try-write-reality': spec([SOCKET, PRODUCER, BOUNDED, LOST, CONSUMER], TRY_CODE, {
    full: { rows: { socket: socket(5), producer: [op('w', 'wrote m2 m3 m4', 'run')], channel: range(2, 4), consumer: saving(1) }, line: T.WRITE },
    'never-waits': { rows: { socket: socket(6), producer: [op('t5', 'TryWrite(m5) → false', 'bad')], channel: range(2, 4), lost: [m(5, 'dead')], consumer: saving(1) }, line: T.WRITE, bad: true },
    lost: { rows: { socket: socket(8), producer: [op('t7', 'TryWrite(m7) → false', 'bad')], channel: range(2, 4), lost: range(5, 7, 'dead'), consumer: saving(1) }, line: T.WRITE, bad: true },
  }),

  'read-all-claim': spec(UNBOUNDED_ROWS, READ_ALL_CODE, {
    read: { rows: { socket: socket(3), producer: [op('w2', 'wrote m2', 'run')], channel: [m(2)], consumer: [op('ra', 'ReadAllAsync', 'run'), ...saving(1)] }, line: R.READ },
    signal: {
      rows: { socket: socket(3), producer: [op('slowed', 'waits for the consumer', 'wait')], channel: [m(2)], consumer: [op('ra', 'ReadAllAsync', 'run'), op('tell', 'tells the writer: slow down', 'bad'), ...saving(1)] },
      line: R.READ,
      bad: true,
    },
  }),
  'read-all-reality': spec(UNBOUNDED_ROWS, READ_ALL_CODE, {
    read: { rows: { socket: socket(3), producer: [op('w2', 'wrote m2', 'run')], channel: [m(2)], consumer: [op('ra', 'ReadAllAsync', 'run'), ...saving(1)] }, line: R.READ },
    signal: { rows: { socket: socket(8), producer: [op('w7', 'WriteAsync(m7) done', 'ok')], channel: range(2, 7, 'bad'), consumer: [op('ra', 'ReadAllAsync', 'run'), ...saving(1)] }, line: R.WRITE, bad: true },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
