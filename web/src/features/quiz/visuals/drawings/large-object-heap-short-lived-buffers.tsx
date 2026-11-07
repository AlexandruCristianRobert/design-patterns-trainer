import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const BOTH = [
  '// version 1: one array per request',
  'var buffer = new byte[100 * 1024];',
  '',
  '// version 2: the same bytes in 4 KB arrays',
  'var chunks = new byte[25][];',
  'for (int i = 0; i < 25; i++)',
  '    chunks[i] = new byte[4 * 1024];',
]
const LARGE = [BOTH[1]]
const L = { LARGE: 1, SMALL: [4, 6] as [number, number], CHUNK: 6 }

const row = (id: string, name: string, sub: string, tone: RowDef['tone']): RowDef => ({ id, name, sub, tone })
const G0 = row('g0', 'Gen 0', 'new small objects', 'pool')
const G1 = row('g1', 'Gen 1', 'survived one GC', 'pool')
const G2 = row('g2', 'Gen 2', 'long-lived objects', 'ui')
const LOH = row('loh', 'Large Object Heap', '85,000 bytes or more', 'io')
const GC = row('gc', 'Collections', 'what ran', 'muted')
const HEAP = [G0, G1, G2, LOH, GC]

const c = (key: string, label: string, kind: Chip['kind'] = 'run'): Chip => ({ key, label, kind })
const many = (label: string, n: number, kind: Chip['kind'], more?: string) => [
  ...Array.from({ length: n }, (_, i) => c(`${label}-${i}`, label, kind)),
  ...(more ? [c(`${label}-more`, more, kind === 'run' ? 'run' : kind)] : []),
]
const smallArrays = (kind: Chip['kind']) => many('4 KB', 4, kind, '… 25 per request')
const bigArrays = (kind: Chip['kind']) => many('100 KB', 3, kind)
const OLD = [c('old', 'long-lived objects', 'item')]

const spec = (rows: RowDef[], code: string[], steps: Record<string, RowStep>): RowSpec => ({ rows, code, steps })

const SPECS: Record<string, RowSpec> = {
  setup: spec(
    [row('v1', 'Version 1', '100 KB per request', 'ui'), row('v2', 'Version 2', '25 × 4 KB per request', 'ui'), row('tp', 'Throughput', 'under load', 'muted')],
    BOTH,
    {
      large: { rows: { v1: [c('r1', 'request 1: 100 KB'), c('r2', 'request 2: 100 KB'), c('r3', '…')] }, line: L.LARGE },
      small: { rows: { v1: [c('r1', 'request 1: 100 KB'), c('r2', 'request 2: 100 KB'), c('r3', '…')], v2: [c('r1', 'request 1: 25 × 4 KB'), c('r2', 'request 2: 25 × 4 KB'), c('r3', '…')] }, line: L.SMALL },
      question: {
        rows: {
          v1: [c('r1', 'request 1: 100 KB'), c('r2', 'request 2: 100 KB'), c('r3', '…')],
          v2: [c('r1', 'request 1: 25 × 4 KB'), c('r2', 'request 2: 25 × 4 KB'), c('r3', '…')],
          tp: [c('v1', 'version 1: lower', 'bad'), c('v2', 'version 2: higher', 'ok'), c('why', 'why?', 'wait')],
        },
        line: { each: [L.LARGE, L.CHUNK] },
      },
    },
  ),

  'small-arrays': spec(HEAP, BOTH, {
    alloc: { rows: { g0: smallArrays('run'), g2: OLD }, line: L.CHUNK },
    dead: { rows: { g0: smallArrays('dead'), g2: OLD }, line: L.CHUNK },
    gen0: { rows: { g0: [c('empty', 'reclaimed', 'gone')], g2: OLD, gc: [c('gc0', 'gen 0 GC: cheap', 'ok')] }, line: L.CHUNK },
  }),
  'large-arrays': spec(HEAP, BOTH, {
    alloc: { rows: { loh: bigArrays('run'), g2: OLD }, line: L.LARGE },
    dead: { rows: { loh: bigArrays('dead'), g2: OLD, gc: [c('gc0', 'gen 0 GC: LOH untouched')] }, line: L.LARGE },
    gen2: {
      rows: { loh: [c('empty', 'reclaimed', 'gone')], g2: [c('old', 'all scanned', 'bad')], g1: [c('scan', 'scanned', 'bad')], g0: [c('scan', 'scanned', 'bad')], gc: [c('gc0', 'gen 0 GC: LOH untouched'), c('gc2', 'full gen 2 GC: expensive', 'bad')] },
      line: L.LARGE,
      bad: true,
    },
  }),

  'unmanaged-claim': spec([row('heap', 'GC heap', 'managed objects', 'pool'), row('native', 'Unmanaged memory', 'outside the GC heap', 'io'), row('fq', 'Finalization queue', 'objects to finalize', 'muted')], LARGE, {
    alloc: { rows: { native: [c('big', '100 KB byte[]')] }, line: 0 },
    free: { rows: { native: [c('big', '100 KB byte[]', 'dead')], fq: [c('fin', 'finalizer for byte[]', 'wait')] }, line: 0 },
  }),
  'unmanaged-reality': spec([row('heap', 'GC heap', 'managed objects', 'pool'), row('native', 'Unmanaged memory', 'outside the GC heap', 'io'), row('fq', 'Finalization queue', 'objects to finalize', 'muted')], LARGE, {
    alloc: { rows: { heap: [c('big', '100 KB byte[] on the LOH', 'ok')], native: [c('none', 'nothing here', 'gone')] }, line: 0 },
    free: { rows: { heap: [c('big', '100 KB byte[]', 'dead')], native: [c('none', 'nothing here', 'gone')], fq: [c('none', 'empty: no finalizer', 'gone')] }, line: 0 },
  }),

  'pinned-claim': spec([G0, LOH, GC], LARGE, {
    pin: { rows: { g0: [c('o1', 'obj', 'item'), c('big', '100 KB · pinned'), c('o2', 'obj', 'item')] }, line: 0 },
    compact: { rows: { g0: [c('o1', 'obj', 'item'), c('gap', 'gap', 'gone'), c('big', '100 KB · pinned'), c('o2', 'obj', 'item')], gc: [c('gc0', 'gen 0 GC: cannot compact around it')] }, line: 0 },
  }),
  'pinned-reality': spec([G0, LOH, GC], LARGE, {
    pin: { rows: { g0: [c('o1', 'obj', 'item'), c('o2', 'obj', 'item')], loh: [c('big', '100 KB · not pinned', 'ok')] }, line: 0 },
    compact: { rows: { g0: [c('o2', 'obj', 'item')], loh: [c('big', '100 KB · dead, waits for gen 2', 'dead')], gc: [c('gc0', 'gen 0 GC: compacts normally', 'ok')] }, line: 0 },
  }),

  'gen1-claim': spec([G0, G1, LOH, GC], BOTH, {
    alloc: { rows: { g1: [c('big', '100 KB')] }, line: L.LARGE },
    survive: { rows: { g1: [c('big', '100 KB · survives', 'wait')], gc: [c('gc0', 'gen 0 GC: it survives')] }, line: L.LARGE },
  }),
  'gen1-reality': spec([G0, G1, LOH, GC], BOTH, {
    alloc: { rows: { g0: smallArrays('run'), loh: [c('big', '100 KB')] }, line: { each: [L.LARGE, L.CHUNK] } },
    survive: { rows: { g0: [c('empty', 'reclaimed', 'gone')], loh: [c('big', '100 KB · dead, waits for gen 2', 'dead')], gc: [c('gc0', 'gen 0 GC: cheap', 'ok')] }, line: { each: [L.LARGE, L.CHUNK] } },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
