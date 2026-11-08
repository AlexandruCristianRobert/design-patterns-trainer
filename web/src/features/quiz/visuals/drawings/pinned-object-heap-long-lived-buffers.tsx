import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const CODE = [
  '// version 1: a normal array, pinned with a handle',
  'var buffer = new byte[size];',
  'var handle = GCHandle.Alloc(',
  '    buffer, GCHandleType.Pinned);',
  '',
  '// version 2: allocated pinned',
  'var buffer = GC.AllocateArray<byte>(',
  '    size, pinned: true);',
]
const V1 = CODE.slice(0, 4)
const V2 = CODE.slice(5)
const L = { V1: [1, 3] as [number, number], V2: [6, 7] as [number, number], V2_ALONE: [1, 2] as [number, number] }

const ROW = {
  v1: { id: 'v1', name: 'Version 1', sub: 'normal array + handle', tone: 'ui' },
  v2: { id: 'v2', name: 'Version 2', sub: 'pinned: true', tone: 'ui' },
  gen0: { id: 'gen0', name: 'Gen 0', sub: 'in address order', tone: 'pool' },
  poh: { id: 'poh', name: 'Pinned Object Heap', sub: 'never compacted', tone: 'io' },
  native: { id: 'native', name: 'Unmanaged memory', sub: 'outside the GC heap', tone: 'muted' },
  handles: { id: 'handles', name: 'GCHandles', sub: 'freed by hand', tone: 'muted' },
  gc: { id: 'gc', name: 'Collections', sub: 'what ran', tone: 'muted' },
  freed: { id: 'freed', name: 'Freed by', tone: 'muted' },
  mistake: { id: 'mistake', name: 'FreeHGlobal', sub: 'if called by mistake', tone: 'muted' },
} satisfies Record<string, RowDef>

const c = (key: string, label: string, kind: Chip['kind'] = 'run'): Chip => ({ key, label, kind })
const obj = (n: number, kind: Chip['kind'] = 'item') => c(`o${n}`, 'obj', kind)
const buf = (n: number, kind: Chip['kind'] = 'run') => c(`b${n}`, 'buffer', kind)
const pinned = (n: number) => c(`b${n}`, 'pinned buffer', 'wait')
const gap = (n: number) => c(`gap${n}`, 'gap', 'bad')

const spec = (rows: RowDef[], code: string[], steps: Record<string, RowStep>): RowSpec => ({ rows, code, steps })

// ---- Version 1: buffers pinned in place among ordinary objects (chips in address order) ----
const H_ALLOC = [obj(1), pinned(1), obj(2), obj(3), pinned(2)]
const H_DEAD = [obj(1, 'dead'), pinned(1), obj(2, 'dead'), obj(3), pinned(2)]
const H_GC = [gap(0), pinned(1), obj(3), gap(3), pinned(2)]
const HANDLES = [c('h1', 'handle 1', 'wait'), c('h2', 'handle 2', 'wait')]

// ---- Version 2: buffers on the POH, gen 0 holds only ordinary objects ----
const P_ALLOC = [obj(1), obj(2), obj(3), obj(4), obj(5)]
const P_DEAD = [obj(1, 'dead'), obj(2), obj(3, 'dead'), obj(4, 'dead'), obj(5)]
const P_GC = [obj(2), obj(5), c('free', 'free space in one piece', 'ok')]
const POH = [buf(1), buf(2)]

const SPECS: Record<string, RowSpec> = {
  setup: spec([ROW.v1, ROW.v2], CODE, {
    handle: { rows: { v1: [c('a', 'buffer'), c('h', 'pinned by a GCHandle')] }, line: L.V1 },
    pinned: { rows: { v1: [c('a', 'buffer'), c('h', 'pinned by a GCHandle')], v2: [c('a', 'buffer'), c('p', 'pinned: true')] }, line: L.V2 },
    question: {
      rows: { v1: [c('a', 'buffer'), c('h', 'pinned by a GCHandle'), c('life', 'for the process life', 'run')], v2: [c('a', 'buffer'), c('p', 'pinned: true'), c('life', 'for the process life', 'run')] },
      line: { each: [L.V1, L.V2] },
    },
  }),

  handle: spec([ROW.gen0, ROW.poh, ROW.handles, ROW.gc], V1, {
    alloc: { rows: { gen0: H_ALLOC, handles: HANDLES }, line: L.V1 },
    dead: { rows: { gen0: H_DEAD, handles: HANDLES }, line: L.V1 },
    gc: { rows: { gen0: H_GC, handles: HANDLES, gc: [c('gc', 'compaction blocked by pins', 'bad')] }, line: L.V1, bad: true },
    forever: { rows: { gen0: H_GC, handles: [c('h1', 'handle 1', 'bad'), c('h2', 'handle 2', 'bad')], gc: [c('gc', 'every GC works around them', 'bad')] }, line: L.V1, bad: true },
  }),
  poh: spec([ROW.gen0, ROW.poh, ROW.handles, ROW.gc], V2, {
    alloc: { rows: { gen0: P_ALLOC, poh: POH }, line: L.V2_ALONE },
    dead: { rows: { gen0: P_DEAD, poh: POH }, line: L.V2_ALONE },
    gc: { rows: { gen0: P_GC, poh: [buf(1, 'ok'), buf(2, 'ok')], handles: [c('none', 'none needed', 'ok')], gc: [c('gc', 'gen 0 compacts freely', 'ok')] }, line: L.V2_ALONE },
  }),

  'copy-claim': spec([ROW.gen0, ROW.native, ROW.gc], V1, {
    pin: { rows: { gen0: H_DEAD }, line: L.V1 },
    gc: { rows: { gen0: H_DEAD, native: [c('copy1', 'copy of buffer', 'bad'), c('copy2', 'copy of buffer', 'bad')], gc: [c('gc', 'full copy per GC', 'bad')] }, line: L.V1, bad: true },
  }),
  'copy-reality': spec([ROW.gen0, ROW.native, ROW.gc], V1, {
    pin: { rows: { gen0: H_DEAD }, line: L.V1 },
    gc: { rows: { gen0: H_GC, native: [c('none', 'nothing copied', 'ok')], gc: [c('gc', 'buffers not moved, gaps left', 'bad')] }, line: L.V1 },
  }),

  'gen0-claim': spec([ROW.poh, ROW.gc], V2, {
    dropped: { rows: { poh: [buf(1), buf(2, 'dead')] }, line: L.V2_ALONE },
    gen0: { rows: { poh: [buf(1), c('b2', 'reclaimed', 'bad')], gc: [c('g0', 'gen 0 GC, also the POH', 'bad')] }, line: L.V2_ALONE, bad: true },
  }),
  'gen0-reality': spec([ROW.poh, ROW.gc], V2, {
    dropped: { rows: { poh: [buf(1), buf(2, 'dead')] }, line: L.V2_ALONE },
    gen0: { rows: { poh: [buf(1), c('b2', 'buffer, untouched', 'dead')], gc: [c('g0', 'gen 0 GC: POH not part of it')] }, line: L.V2_ALONE },
    gen2: { rows: { poh: [buf(1), c('b2', 'reclaimed', 'gone')], gc: [c('g0', 'gen 0 GC: POH not part of it'), c('g2', 'gen 2 GC: reclaims it', 'ok')] }, line: L.V2_ALONE },
  }),

  'free-claim': spec([ROW.poh, ROW.freed], V2, {
    alloc: { rows: { poh: [buf(1)] }, line: L.V2_ALONE },
    free: { rows: { poh: [buf(1, 'gone')], freed: [c('f', 'Marshal.FreeHGlobal, no GC', 'bad')] }, line: L.V2_ALONE, bad: true },
  }),
  'free-reality': spec([ROW.poh, ROW.freed, ROW.mistake], V2, {
    alloc: { rows: { poh: [c('b1', 'managed buffer', 'ok')] }, line: L.V2_ALONE },
    free: { rows: { poh: [c('b1', 'unreachable', 'dead')], freed: [c('f', 'the GC', 'ok')], mistake: [c('x', 'corrupts memory', 'bad')] }, line: L.V2_ALONE },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
