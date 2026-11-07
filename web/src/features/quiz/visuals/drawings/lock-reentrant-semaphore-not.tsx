import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'var gate = new object();',
  'lock (gate)',
  '{',
  '    lock (gate) { Console.WriteLine("nested"); }',
  '}',
  '',
  'using var semaphore = new SemaphoreSlim(1, 1);',
  'semaphore.Wait();',
  'Console.WriteLine(semaphore.Wait(0));',
  'semaphore.Release();',
]
const L = { OUTER: 1, INNER: 3, EXIT: [1, 4] as [number, number], WAIT: 7, WAIT0: 8, RELEASE: 9 }

const REGIONS: Region[] = [
  { id: 'thread', name: 'Main thread', sub: 'the only thread', tone: 'ui' },
  { id: 'sync', name: 'Synchronization objects', tone: 'pool' },
]

const thread = (doing: string, kind?: Field['kind']): Box => ({ id: 'thread', region: 'thread', title: 'Main thread', fields: [{ name: 'doing', value: doing, kind }] })
/** The lock object; the Setup shows only whether it is taken, the plays show what Monitor records. */
const gate = (fields: Field[], kind?: Box['kind']): Box => ({ id: 'gate', region: 'sync', title: 'gate', sub: 'object used by lock', fields, kind })
const held = (entries: number, kind?: Field['kind']): Field[] => [
  { name: 'owner', value: entries ? 'main thread' : 'none' },
  { name: 'entries', value: String(entries), kind },
]
const sem = (count: number | string, extra: Field[] = [], kind?: Field['kind']): Box => ({
  id: 'sem',
  region: 'sync',
  title: 'semaphore',
  sub: 'SemaphoreSlim(1, 1)',
  fields: [{ name: 'CurrentCount', value: String(count), kind: count === '?' ? 'muted' : kind }, ...extra],
})
const NO_OWNER: Field = { name: 'owner', value: 'not tracked', kind: 'muted' }

const out = (...lines: [string, OutLine['kind']?][]): OutLine[] =>
  lines.length ? lines.map(([text, kind], i) => ({ label: `line ${i + 1}`, text, kind: text === '?' ? 'muted' : kind })) : [{ label: 'output', text: 'nothing yet', kind: 'muted' }]
const spec = (steps: Record<string, GraphStep>): GraphSpec => ({ regions: REGIONS, code: CODE, outputName: 'Console', steps })

const UNKNOWN: OutLine[] = [{ label: 'output', text: '?', kind: 'muted' }]
const taken = (state: string, kind?: Field['kind']) => gate([{ name: 'state', value: state, kind }])

/** The real run. */
const R = {
  outer: { boxes: [thread('inside lock (gate)'), gate(held(1)), sem(1, [NO_OWNER])], line: L.OUTER, output: out() },
  inner: { boxes: [thread('inside nested lock'), gate(held(2, 'ok')), sem(1, [NO_OWNER])], line: L.INNER, output: out(['nested', 'ok']) },
  exit: { boxes: [thread('after the locks'), gate(held(0)), sem(1, [NO_OWNER])], line: L.EXIT, output: out(['nested']) },
  wait: { boxes: [thread('holds 1 slot'), gate(held(0)), sem(0, [NO_OWNER])], line: L.WAIT, output: out(['nested']) },
  waitZero: { boxes: [thread('Wait(0) returned false', 'ok'), gate(held(0)), sem(0, [NO_OWNER])], line: L.WAIT0, output: out(['nested'], ['False', 'ok']) },
  release: { boxes: [thread('done'), gate(held(0)), sem(1, [NO_OWNER])], line: L.RELEASE, output: out(['nested'], ['False']) },
} satisfies Record<string, GraphStep>

/** The plays that start after the locks: gate is free, only the semaphore matters. */
const NESTED = { ...R.exit, line: L.INNER }

const SPECS: Record<string, GraphSpec> = {
  setup: spec({
    'outer-lock': { boxes: [thread('inside lock (gate)'), taken('taken'), sem(1)], line: L.OUTER, output: UNKNOWN },
    'inner-lock': { boxes: [thread('?', 'muted'), taken('?', 'muted'), sem(1)], line: L.INNER, output: UNKNOWN },
    wait: { boxes: [thread('?', 'muted'), taken('?', 'muted'), sem('0 after Wait()')], line: L.WAIT, output: UNKNOWN },
    'wait-zero': { boxes: [thread('?', 'muted'), taken('?', 'muted'), sem('0 after Wait()')], line: L.WAIT0, output: UNKNOWN },
  }),
  'lock-then-semaphore': spec({ 'outer-lock': R.outer, 'inner-lock': R.inner, exit: R.exit, wait: R.wait, 'wait-zero': R.waitZero, release: R.release }),

  'semaphore-reenters-claim': spec({
    nested: { boxes: [thread('after the locks'), gate([], 'muted'), sem(1)], line: L.INNER, output: out(['nested']) },
    wait: { boxes: [thread('holds 1 slot'), gate([], 'muted'), sem(0)], line: L.WAIT, output: out(['nested']) },
    'wait-zero': {
      boxes: [thread('Wait(0) returned true', 'bad'), gate([], 'muted'), sem(0, [{ name: 'lets back in', value: 'main thread', kind: 'bad' }])],
      line: L.WAIT0,
      bad: true,
      output: out(['nested'], ['True', 'bad']),
    },
  }),
  'semaphore-reenters-reality': spec({ nested: NESTED, wait: R.wait, 'wait-zero': R.waitZero }),

  'nested-lock-deadlocks-claim': spec({
    'outer-lock': { boxes: [thread('inside lock (gate)'), taken('taken'), { ...sem(1), kind: 'muted' as const }], line: L.OUTER, output: out() },
    'inner-lock': { boxes: [thread('waits for gate', 'bad'), gate([{ name: 'state', value: 'taken' }, { name: 'waiting', value: 'main thread', kind: 'bad' }]), { ...sem(1), kind: 'muted' as const }], line: L.INNER, bad: true, output: out() },
    stuck: {
      boxes: [thread('blocked forever', 'bad'), gate([{ name: 'state', value: 'taken' }, { name: 'waiting', value: 'main thread', kind: 'bad' }]), { ...sem(1), kind: 'muted' as const }],
      line: L.INNER,
      bad: true,
      output: [{ label: 'output', text: 'nothing', kind: 'bad' }],
    },
  }),
  'nested-lock-deadlocks-reality': spec({ 'outer-lock': R.outer, 'inner-lock': { ...R.inner, output: out() }, stuck: { ...R.inner, boxes: [thread('carries on'), gate(held(2)), sem(1, [NO_OWNER])] } }),

  'wait-throws-claim': spec({
    nested: { boxes: [thread('after the locks'), gate([], 'muted'), sem(1)], line: L.INNER, output: out(['nested']) },
    wait: { boxes: [thread('holds 1 slot'), gate([], 'muted'), sem(0)], line: L.WAIT, output: out(['nested']) },
    'wait-zero': {
      boxes: [thread('throws', 'bad'), gate([], 'muted'), sem(0)],
      line: L.WAIT0,
      bad: true,
      output: [...out(['nested']), { label: 'error', text: 'Unhandled SynchronizationLockException', kind: 'bad' }],
    },
  }),
  'wait-throws-reality': spec({ nested: NESTED, wait: R.wait, 'wait-zero': R.waitZero }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
