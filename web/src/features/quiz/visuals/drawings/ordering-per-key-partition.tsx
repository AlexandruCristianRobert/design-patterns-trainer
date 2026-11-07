import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const SEND = ['// sender', 'await sender.SendMessageAsync(new ServiceBusMessage(json));', '']
const CODE = [...SEND, '// each of the 8 instances', 'var processor = client.CreateProcessor("orders");']
const SESSION = [
  '// sender',
  'await sender.SendMessageAsync(new ServiceBusMessage(json)',
  '    { SessionId = order.Id });',
  '',
  '// each of the 8 instances, queue is session-enabled',
  'var processor = client.CreateSessionProcessor("orders");',
]
const PREFETCH = [...SEND, '// each of the 8 instances', 'var processor = client.CreateProcessor("orders",', '    new ServiceBusProcessorOptions { PrefetchCount = 0 });']
const SINGLE = [...SEND, '// one instance only', 'var processor = client.CreateProcessor("orders",', '    new ServiceBusProcessorOptions { MaxConcurrentCalls = 1 });']

const rows: RowDef[] = [
  { id: 'queue', name: 'Queue', sub: 'Service Bus', tone: 'io' },
  { id: 'c1', name: 'Consumer 1', tone: 'pool' },
  { id: 'c2', name: 'Consumer 2', tone: 'pool' },
  { id: 'c3', name: 'Consumer 3', sub: '… up to 8', tone: 'pool' },
  { id: 'db', name: 'Database', sub: 'writes, in time order', tone: 'ui' },
]
const spec = (code: string[], steps: Record<string, RowStep>): RowSpec => ({ rows, code, steps })
const c = (key: string, label: string, kind: Chip['kind'] = 'run'): Chip => ({ key, label, kind })

const A2 = c('a2', '41 v2')
const A3 = c('a3', '41 v3')
const B1 = c('b1', '42 v1')
const QUEUE = [A2, A3, B1]
const wrote = (key: string, label: string, kind?: Chip['kind']) => c(`w-${key}`, label, kind)
const W3 = wrote('a3', '41 = v3', 'ok')
const W2_STALE = wrote('a2', '41 = v2, older wins', 'bad')

/** Without sessions: 41 v2 and 41 v3 on two consumers at once. */
const RACE = {
  receive: { rows: { queue: [B1], c1: [c('a2', '41 v2', 'run')], c2: [c('a3', '41 v3', 'run')] }, line: 4 },
  race: { rows: { queue: [B1], c1: [c('a2', '41 v2', 'run')], c2: [c('a3', '41 v3', 'ok')], db: [W3] }, line: 4 },
  stale: { rows: { queue: [B1], c1: [c('a2', '41 v2', 'ok')], c2: [c('a3', '41 v3', 'ok')], db: [W3, W2_STALE] }, line: 4, bad: true },
} satisfies Record<string, RowStep>
const NONE = { c2: [c('none', 'no instance', 'gone')], c3: [c('none', 'no instance', 'gone')] }

const SPECS: Record<string, RowSpec> = {
  setup: spec(CODE, {
    queue: { rows: { queue: QUEUE, db: [wrote('a1', '41 = v1')] }, line: { each: [1, 4] } },
    stale: { rows: { queue: QUEUE, db: [wrote('a1', '41 = v1'), wrote('a3', '41 = v3'), wrote('a2', '41 = v2, older wins', 'bad')] }, line: null },
  }),

  competing: spec(CODE, RACE),
  sessions: spec(SESSION, {
    session: { rows: { queue: [c('a2', '41 v2 · session 41'), c('a3', '41 v3 · session 41'), c('b1', '42 v1 · session 42')], c1: [c('lock', 'lock: session 41')], c2: [c('lock', 'lock: session 42')] }, line: [1, 5] },
    'in-order': {
      rows: { queue: [c('a3', '41 v3 · session 41')], c1: [c('lock', 'lock: session 41'), c('a2', '41 v2', 'run')], c2: [c('lock', 'lock: session 42'), c('b1', '42 v1', 'run')] },
      line: 5,
    },
    next: {
      rows: {
        queue: [],
        c1: [c('lock', 'lock: session 41'), c('a2', '41 v2', 'ok'), c('a3', '41 v3', 'ok')],
        c2: [c('lock', 'lock: session 42'), c('b1', '42 v1', 'ok')],
        db: [wrote('a2', '41 = v2'), wrote('b1', '42 = v1'), wrote('a3', '41 = v3', 'ok')],
      },
      line: 5,
    },
  }),

  'prefetch-claim': spec(PREFETCH, {
    prefetch: { rows: { queue: [A3, B1], c1: [c('a2', '41 v2', 'run'), c('max', 'holds max 1')] }, line: [4, 5] },
    applied: { rows: { queue: [B1], c1: [c('a2', '41 v2', 'ok'), c('max', 'holds max 1')], db: [wrote('a2', '41 = v2'), wrote('a3', '41 = v3', 'ok')] }, line: [4, 5] },
  }),
  'prefetch-reality': spec(PREFETCH, {
    prefetch: { rows: { queue: [], c1: [c('a2', '41 v2', 'run')], c2: [c('a3', '41 v3', 'run')], c3: [c('b1', '42 v1', 'run')] }, line: [4, 5] },
    applied: { rows: { queue: [], c1: [c('a2', '41 v2', 'ok')], c2: [c('a3', '41 v3', 'ok')], c3: [c('b1', '42 v1', 'ok')], db: [W3, W2_STALE] }, line: [4, 5], bad: true },
  }),

  'fifo-claim': spec(CODE, {
    deliver: { rows: { queue: [B1], c1: [c('a2', '41 v2 · 1st', 'run')], c2: [c('a3', '41 v3 · 2nd', 'run')] }, line: 4 },
    applied: { rows: { queue: [B1], c1: [c('a2', '41 v2 · 1st', 'ok')], c2: [c('a3', '41 v3 · 2nd', 'ok')], db: [wrote('a2', '41 = v2'), wrote('a3', '41 = v3', 'ok')] }, line: 4 },
  }),
  'fifo-reality': spec(CODE, { deliver: RACE.receive, applied: RACE.stale }),

  'single-claim': spec(SINGLE, {
    single: { rows: { queue: [A3, B1], c1: [c('a2', '41 v2', 'run')], ...NONE }, line: [3, 5] },
    ordered: { rows: { queue: [], c1: [c('a2', '41 v2', 'ok'), c('a3', '41 v3', 'ok'), c('b1', '42 v1', 'ok')], ...NONE, db: [wrote('a2', '41 = v2'), wrote('a3', '41 = v3'), wrote('b1', '42 = v1', 'ok')] }, line: [3, 5] },
  }),
  'single-reality': spec(SINGLE, {
    single: {
      rows: {
        queue: [c('a2', '41 v2 retried: may land after v3', 'bad'), A3, B1],
        c1: [c('a2x', '41 v2 abandoned', 'bad')],
        ...NONE,
        db: [wrote('may', 'no order guarantee', 'bad')],
      },
      line: [3, 5],
      bad: true,
    },
    ordered: {
      rows: { queue: [c('a3', '41 v3 waits'), c('b1', '42 v1 waits')], c1: [c('a2x', '41 v2 abandoned', 'bad'), c('a2', '41 v2 retry')], ...NONE },
      line: [3, 5],
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
