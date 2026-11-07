import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const CODE = [
  'var queue = new PriorityQueue<Job, int>();',
  'queue.Enqueue(jobX, 2);',
  'queue.Enqueue(jobY, 2);',
  'queue.Enqueue(jobZ, 2);',
  '',
  'while (queue.TryDequeue(out var job, out _))',
  '    Run(job);',
]
const TUPLE = [
  'var queue = new PriorityQueue<Job, (int, long)>();',
  'long seq = 0;',
  'queue.Enqueue(jobX, (2, seq++));',
  'queue.Enqueue(jobY, (2, seq++));',
  'queue.Enqueue(jobZ, (2, seq++));',
  '',
  'while (queue.TryDequeue(out var job, out _))',
  '    Run(job);',
]
const L = { ENQUEUE: [1, 3] as [number, number], DEQUEUE: [5, 6] as [number, number] }
const T = { ENQUEUE: [2, 4] as [number, number], DEQUEUE: [6, 7] as [number, number] }

const CALLS: RowDef = { id: 'calls', name: 'Enqueued', sub: 'in call order', tone: 'ui' }
const HEAP: RowDef = { id: 'heap', name: 'Heap array', sub: 'index 0 is the root', tone: 'pool', slots: 3, ends: ['[0]', '[2]'] }
const OUT: RowDef = { id: 'out', name: 'Dequeued', sub: 'in order', tone: 'io' }

const c = (key: string, label: string, kind: Chip['kind'] = 'item'): Chip => ({ key, label, kind })
const job = (j: string, kind?: Chip['kind']) => c(j, j, kind)
const calls = (prio: (j: string, i: number) => string) => ['X', 'Y', 'Z'].map((j, i) => c(j, `${j}, ${prio(j, i)}`, 'run'))
const P2 = calls(() => '2')
const SEQ = calls((_, i) => `(2, ${i})`)
const HASH: Record<string, number> = { X: 31, Y: 12, Z: 27 }
const HASHED = calls((j) => `2 · hash ${HASH[j]}`)

const heap = (...jobs: string[]) => jobs.map((j) => job(j))
const out = (...jobs: string[]) => jobs.map((j) => job(j))
const spec = (code: string[], rows: RowDef[], steps: Record<string, RowStep>): RowSpec => ({ rows, code, steps })

/** The real run on .NET 10 (verified): X, Y, Z all with priority 2 come out X, Z, Y. */
const R = {
  enqueue: { rows: { calls: P2, heap: heap('X', 'Y', 'Z') }, line: L.ENQUEUE },
  first: { rows: { calls: P2, heap: [job('Z', 'run'), job('Y')], out: out('X') }, line: L.DEQUEUE },
  second: { rows: { calls: P2, heap: heap('Y'), out: [job('X'), job('Z')] }, line: L.DEQUEUE },
  third: { rows: { calls: P2, heap: [], out: [job('X'), job('Z'), job('Y')] }, line: L.DEQUEUE },
} satisfies Record<string, RowStep>
const withCalls = (s: RowStep, list: Chip[]): RowStep => ({ ...s, rows: { ...s.rows, calls: list } })

const SPECS: Record<string, RowSpec> = {
  setup: spec(CODE, [CALLS, OUT], {
    enqueue: { rows: { calls: P2 }, line: L.ENQUEUE },
    dequeue: { rows: { calls: P2, out: [c('q1', '?', 'wait'), c('q2', '?', 'wait'), c('q3', '?', 'wait')] }, line: L.DEQUEUE },
  }),
  heap: spec(CODE, [CALLS, HEAP, OUT], R),
  'tie-breaker': spec(TUPLE, [CALLS, HEAP, OUT], {
    enqueue: { rows: { calls: SEQ, heap: heap('X', 'Y', 'Z') }, line: T.ENQUEUE },
    first: { rows: { calls: SEQ, heap: [job('Y', 'run'), job('Z', 'run')], out: out('X') }, line: T.DEQUEUE },
    all: { rows: { calls: SEQ, heap: [], out: [job('X'), job('Y'), job('Z')] }, line: T.DEQUEUE },
  }),

  'fifo-claim': spec(CODE, [CALLS, HEAP, OUT], {
    enqueue: { rows: { calls: calls((_, i) => `2 · ${['1st', '2nd', '3rd'][i]}`), heap: heap('X', 'Y', 'Z') }, line: L.ENQUEUE },
    dequeue: { rows: { calls: calls((_, i) => `2 · ${['1st', '2nd', '3rd'][i]}`), heap: [], out: out('X', 'Y', 'Z') }, line: L.DEQUEUE },
  }),
  'fifo-reality': spec(CODE, [CALLS, HEAP, OUT], { enqueue: R.enqueue, dequeue: R.third }),

  'lifo-claim': spec(CODE, [CALLS, HEAP, OUT], {
    enqueue: { rows: { calls: P2, heap: [job('Z', 'run'), job('Y'), job('X')] }, line: L.ENQUEUE },
    dequeue: { rows: { calls: P2, heap: [], out: out('Z', 'Y', 'X') }, line: L.DEQUEUE },
  }),
  'lifo-reality': spec(CODE, [CALLS, HEAP, OUT], { enqueue: { ...R.enqueue, rows: { calls: P2, heap: [job('X'), job('Y'), job('Z', 'run')] } }, dequeue: R.third }),

  'hash-claim': spec(CODE, [CALLS, HEAP, OUT], {
    enqueue: { rows: { calls: HASHED, heap: heap('Y', 'Z', 'X') }, line: L.ENQUEUE },
    dequeue: { rows: { calls: HASHED, heap: [], out: out('Y', 'Z', 'X') }, line: L.DEQUEUE },
  }),
  'hash-reality': spec(CODE, [CALLS, HEAP, OUT], { enqueue: withCalls(R.enqueue, HASHED), dequeue: withCalls(R.third, HASHED) }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
