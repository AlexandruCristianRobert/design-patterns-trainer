import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type ChipKind, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const ROW: Record<string, RowDef> = {
  worker: { id: 'worker', name: 'Worker', sub: 'batch thread', tone: 'ui' },
  why: { id: 'why', name: 'Reason', sub: 'for the call', tone: 'muted' },
  gc: { id: 'gc', name: 'GC', sub: 'collections', tone: 'muted' },
  gen0: { id: 'gen0', name: 'Gen 0', sub: 'new small objects', tone: 'pool' },
  gen1: { id: 'gen1', name: 'Gen 1', sub: 'survived one GC', tone: 'pool' },
  gen2: { id: 'gen2', name: 'Gen 2', sub: 'long-lived', tone: 'pool' },
  mem: { id: 'mem', name: 'Memory', sub: 'held from the OS', tone: 'io' },
  fin: { id: 'fin', name: 'Finalizer', sub: 'finalizer thread', tone: 'io' },
}
const rows = (...ids: string[]) => ids.map((id) => ROW[id])
const CODE = ['foreach (var batch in batches)', '{', '    Process(batch);', '    GC.Collect();', '}']
const NO_CALL = ['foreach (var batch in batches)', '{', '    Process(batch);', '}']
const L = { PROCESS: 2, COLLECT: 3 }
const spec = (r: RowDef[], steps: Record<string, RowStep>, code = CODE): RowSpec => ({ rows: r, code, steps })

const chip = (key: string, label: string, kind: ChipKind = 'item'): Chip => ({ key, label, kind })
const temps = (kind: ChipKind = 'item'): Chip[] => [chip('t1', 'temp', kind), chip('t2', 'temp', kind)]
const B1 = chip('b1', 'batch 1', 'run')
const B2 = chip('b2', 'batch 2', 'run')
const WAIT1 = chip('w1', 'waits', 'wait')
const full = (key: string) => chip(key, 'gen 2 GC', 'bad')
const CACHE = chip('cache', 'config')

const GENS = rows('worker', 'gc', 'gen0', 'gen1', 'gen2')

const SPECS: Record<string, RowSpec> = {
  // ---- Setup: the loop and its reason; no generations, no collection results ----
  setup: spec(rows('worker', 'why'), {
    loop: { rows: { worker: [B1, chip('c1', 'GC.Collect()', 'run'), B2, chip('c2', 'GC.Collect()', 'run'), chip('more', '…', 'run')] }, line: [L.PROCESS, L.COLLECT] },
    why: {
      rows: { worker: [B1, chip('c1', 'GC.Collect()', 'run'), B2, chip('c2', 'GC.Collect()', 'run'), chip('more', '…', 'run')], why: [chip('low', 'keep memory low')] },
      line: L.COLLECT,
    },
    ask: {
      rows: { worker: [B1, chip('c1', 'GC.Collect()', 'run'), B2, chip('c2', 'GC.Collect()', 'run'), chip('more', '…', 'run')], why: [chip('low', 'keep memory low')] },
      line: L.COLLECT,
    },
  }),

  forced: spec(GENS, {
    batch: { rows: { worker: [B1], gen0: [...temps('dead'), chip('use', 'in use')], gen1: [chip('old', 'older')], gen2: [CACHE] }, line: L.PROCESS },
    collect: {
      rows: { worker: [B1, WAIT1], gc: [full('f1')], gen0: [...temps('gone'), chip('use', 'in use')], gen1: [chip('old', 'older')], gen2: [CACHE] },
      line: L.COLLECT,
      bad: true,
    },
    promote: {
      rows: { worker: [B1, WAIT1], gc: [full('f1')], gen1: [chip('use', 'in use', 'bad')], gen2: [CACHE, chip('old', 'older', 'bad')] },
      line: L.COLLECT,
      bad: true,
    },
    repeat: {
      rows: {
        worker: [B1, WAIT1, B2, chip('w2', 'waits', 'wait'), chip('more', '…', 'run')],
        gc: [full('f1'), full('f2'), chip('f3', '…', 'bad')],
        gen1: [chip('use2', 'in use', 'bad')],
        gen2: [CACHE, chip('old', 'older', 'dead'), chip('use', 'in use', 'dead'), chip('more', '…', 'dead')],
      },
      line: L.COLLECT,
      bad: true,
    },
  }),
  default: spec(
    GENS,
    {
      budget: {
        rows: { worker: [B1, B2, chip('b3', 'batch 3', 'run')], gc: [chip('g0', 'gen 0 GC', 'ok')], gen0: [...temps('gone'), chip('use', 'in use')], gen2: [CACHE] },
        line: L.PROCESS,
      },
      tuned: {
        rows: {
          worker: [B1, B2, chip('b3', 'batch 3', 'run'), chip('more', '…', 'run')],
          gc: [chip('g0', 'gen 0 GC', 'ok'), chip('g0b', 'gen 0 GC', 'ok'), chip('g1', 'gen 1 GC', 'ok'), chip('g0c', '…', 'ok')],
          gen0: [chip('use', 'in use')],
          gen2: [CACHE],
        },
        line: L.PROCESS,
      },
    },
    NO_CALL,
  ),

  'request-claim': spec(rows('worker', 'gc'), {
    request: { rows: { worker: [B1, chip('c1', 'GC.Collect()', 'run'), B2], gc: [chip('req', 'request queued')] }, line: L.COLLECT },
    ignored: { rows: { worker: [B1, chip('c1', 'GC.Collect()', 'run'), B2], gc: [chip('req', 'ignored: no pressure')] }, line: L.COLLECT },
  }),
  'request-reality': spec(rows('worker', 'gc'), {
    sync: { rows: { worker: [B1, WAIT1], gc: [full('f1')] }, line: L.COLLECT, bad: true },
    always: { rows: { worker: [B1, WAIT1, B2, chip('w2', 'waits', 'wait')], gc: [full('f1'), full('f2')] }, line: L.COLLECT, bad: true },
  }),

  'os-claim': spec(rows('worker', 'mem'), {
    kept: { rows: { worker: [B1, chip('c1', 'GC.Collect()', 'run')], mem: [chip('m1', 'used'), chip('k1', 'freed, kept')] }, line: L.COLLECT },
    grows: {
      rows: { worker: [B1, chip('c1', 'GC.Collect()', 'run'), B2, chip('c2', 'GC.Collect()', 'run')], mem: [chip('m1', 'used'), chip('k1', 'freed, kept'), chip('k2', 'freed, kept'), chip('k3', 'growing')] },
      line: L.COLLECT,
    },
  }),
  'os-reality': spec(rows('worker', 'gc', 'mem'), {
    decommit: { rows: { worker: [B1, WAIT1], gc: [full('f1')], mem: [chip('m1', 'used'), chip('k1', 'may be given back', 'gone')] }, line: L.COLLECT },
    cost: {
      rows: { worker: [B1, WAIT1, B2, chip('w2', 'waits', 'wait')], gc: [full('f1'), full('f2'), chip('p', 'early promotion', 'bad')], mem: [chip('m1', 'used'), chip('k1', 'may be given back', 'gone')] },
      line: L.COLLECT,
      bad: true,
    },
  }),

  'fin-claim': spec(rows('worker', 'gc'), {
    run: { rows: { worker: [B1, chip('c1', 'GC.Collect()', 'run'), chip('f1', '~A()', 'run'), chip('f2', '~B()', 'run')] }, line: L.COLLECT },
    block: {
      rows: { worker: [B1, chip('c1', 'GC.Collect()', 'run'), chip('f1', '~A()', 'run'), chip('f2', '~B()', 'run'), chip('blk', 'blocked until done')] },
      line: L.COLLECT,
    },
  }),
  'fin-reality': spec(rows('worker', 'gc', 'fin'), {
    thread: { rows: { worker: [B1, WAIT1], gc: [full('g1')], fin: [chip('f1', '~A()', 'ok'), chip('f2', '~B()', 'ok')] }, line: L.COLLECT },
    wait: { rows: { worker: [B1, WAIT1, B2], gc: [full('g1')], fin: [chip('f1', '~A()', 'ok'), chip('f2', '~B()', 'ok')] }, line: L.COLLECT },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
