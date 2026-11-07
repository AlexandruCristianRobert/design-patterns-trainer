import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type ChipKind, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const code = (finalizer: boolean) => [
  'class Item',
  '{',
  ...(finalizer ? ['    ~Item() => Release();'] : ['    // no finalizer']),
  '}',
  '',
  'void Handle() // per request',
  '{',
  '    var item = new Item();',
  '    Use(item);',
  '} // item unreachable now',
]
const L = { NEW: 7, END: 9, FIN: 2 }

const ROW: Record<string, RowDef> = {
  thread: { id: 'thread', name: 'Request thread', sub: 'runs Handle()', tone: 'ui' },
  gc: { id: 'gc', name: 'GC', sub: 'collections', tone: 'muted' },
  gen0: { id: 'gen0', name: 'Gen 0', sub: 'new small objects', tone: 'pool' },
  gen1: { id: 'gen1', name: 'Gen 1', sub: 'survived one GC', tone: 'pool' },
  loh: { id: 'loh', name: 'Large Object Heap', sub: 'collected with gen 2', tone: 'pool' },
  finq: { id: 'finq', name: 'Finalization queue', sub: 'registered at new', tone: 'io' },
  freach: { id: 'freach', name: 'F-reachable queue', sub: 'waiting for the finalizer', tone: 'io' },
  finalizer: { id: 'finalizer', name: 'Finalizer thread', sub: 'runs finalizers', tone: 'ui' },
  freed: { id: 'freed', name: 'Freed', sub: 'memory reclaimed', tone: 'muted' },
}
const rows = (...ids: string[]) => ids.map((id) => ROW[id])

const item = (kind: ChipKind = 'item', n = 1): Chip => ({ key: `item${n}`, label: 'Item', kind })
const items = (kind: ChipKind = 'item'): Chip[] => [item(kind, 1), item(kind, 2), item(kind, 3), { key: 'more', label: '…', kind }]
const run = (key: string, label: string, kind: ChipKind = 'run'): Chip => ({ key, label, kind })
const fin = (n = 1): Chip => run(`fin${n}`, '~Item()')

const handle = run('handle', 'Handle()')
const nextRequest = run('next', 'next request')
const gc0 = run('gc0', 'gen 0 GC')
const gc1 = run('gc1', 'gen 1 GC')

const FULL = rows('thread', 'gc', 'gen0', 'gen1', 'finq', 'freach', 'finalizer', 'freed')

const withFinalizer: Record<string, RowStep> = {
  alloc: { rows: { thread: [handle], gen0: [item()], finq: [item()] }, line: L.NEW },
  dropped: { rows: { thread: [nextRequest], gen0: [item('dead')], finq: [item()] }, line: L.END },
  gc: { rows: { thread: [nextRequest], gc: [gc0], gen1: [item('wait')], freach: [item()] }, line: L.END },
  'finalizer-runs': { rows: { thread: [nextRequest], gen1: [item('dead')], finalizer: [fin()] }, line: L.FIN },
  'later-gc': { rows: { thread: [nextRequest], gc: [gc1], freed: [item('gone')] }, line: L.END },
}

const SPECS: Record<string, RowSpec> = {
  setup: {
    rows: rows('thread', 'gen0'),
    code: code(true),
    steps: {
      alloc: { rows: { thread: [handle], gen0: [item()] }, line: L.NEW },
      dropped: { rows: { thread: [nextRequest], gen0: [item('dead')] }, line: L.END },
      many: { rows: { thread: [run('many', 'thousands of requests a second')], gen0: items('dead') }, line: L.END },
    },
  },
  'no-finalizer': {
    rows: FULL,
    code: code(false),
    steps: {
      alloc: { rows: { thread: [handle], gen0: [item()] }, line: L.NEW },
      dropped: { rows: { thread: [nextRequest], gen0: [item('dead')] }, line: L.END },
      gc: { rows: { thread: [nextRequest], gc: [gc0], freed: [item('gone')] }, line: L.END },
    },
  },
  'with-finalizer': { rows: FULL, code: code(true), steps: withFinalizer },
  'loh-claim': {
    rows: rows('thread', 'gc', 'gen0', 'gen1', 'loh', 'freed'),
    code: code(true),
    steps: {
      alloc: { rows: { thread: [handle], loh: [item()] }, line: L.NEW },
      dropped: { rows: { thread: [nextRequest], loh: [item('dead')] }, line: L.END },
      'gen0-gc': { rows: { thread: [nextRequest], gc: [gc0], loh: [item('dead')] }, line: L.END },
    },
  },
  'loh-reality': {
    rows: rows('thread', 'gc', 'gen0', 'gen1', 'loh', 'finq', 'freach', 'finalizer', 'freed'),
    code: code(true),
    steps: {
      alloc: withFinalizer.alloc,
      dropped: withFinalizer.dropped,
      'gen0-gc': withFinalizer.gc,
      'later-gc': { rows: { thread: [nextRequest], gc: [gc1], finalizer: [run('fin1', '~Item() ran', 'ok')], freed: [item('gone')] }, line: L.END },
    },
  },
  'request-thread-claim': {
    rows: rows('thread', 'gc', 'gen0', 'finalizer'),
    code: code(true),
    steps: {
      alloc: { rows: { thread: [handle], gen0: [item('dead')] }, line: L.END },
      gc: { rows: { thread: [handle], gc: [gc0], gen0: [item('dead')] }, line: L.END },
      'runs-here': { rows: { thread: [run('fin1', '~Item() runs here', 'bad'), run('stall', 'request stalls', 'bad')], gc: [gc0], gen0: [item('dead')] }, line: L.FIN },
    },
  },
  'request-thread-reality': {
    rows: rows('thread', 'gc', 'gen0', 'gen1', 'freach', 'finalizer'),
    code: code(true),
    steps: {
      alloc: { rows: { thread: [handle], gen0: [item('dead')] }, line: L.END },
      gc: { rows: { thread: [handle], gc: [gc0], gen1: [item('wait')], freach: [item()] }, line: L.END },
      'finalizer-thread': { rows: { thread: [run('keeps', 'request carries on', 'ok')], gen1: [item('dead')], finalizer: [fin()] }, line: L.FIN },
    },
  },
  'full-gc-claim': {
    rows: rows('gc', 'gen0', 'freach', 'finalizer'),
    code: code(true),
    steps: {
      dropped: { rows: { gen0: items('dead') }, line: L.END },
      'gen0-gc': { rows: { gc: [gc0], gen0: items('dead'), freach: items() }, line: L.END },
      'finalizers-run': { rows: { gc: [gc0], gen0: items('dead'), finalizer: [fin(1), fin(2), fin(3)] }, line: L.FIN },
      'full-gcs': {
        rows: { gc: [gc0, run('g2a', 'gen 2 GC', 'bad'), run('g2b', 'gen 2 GC', 'bad'), run('g2c', 'gen 2 GC', 'bad'), run('g2more', '…', 'bad')], gen0: items('dead'), finalizer: [fin(1), fin(2), fin(3)] },
        line: L.FIN,
      },
    },
  },
  'full-gc-reality': {
    rows: rows('gc', 'gen0', 'gen1', 'freach', 'finalizer', 'freed'),
    code: code(true),
    steps: {
      dropped: { rows: { gen0: items('dead') }, line: L.END },
      'gen0-gc': { rows: { gc: [gc0], gen1: items('wait'), freach: items() }, line: L.END },
      'finalizers-run': { rows: { gen1: items('dead'), finalizer: [fin(1), fin(2), fin(3)] }, line: L.FIN },
      'later-gc': { rows: { gc: [gc1], freed: items('gone') }, line: L.END },
    },
  },
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, spec]) => [stage, (p: StageDrawingProps) => <RowStage spec={spec} {...p} />]),
)
export default drawing
