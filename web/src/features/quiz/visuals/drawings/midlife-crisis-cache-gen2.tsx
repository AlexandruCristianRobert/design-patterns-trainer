import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type ChipKind, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const ROW: Record<string, RowDef> = {
  cache: { id: 'cache', name: 'Cache', sub: 'entries expire after 5 min', tone: 'io' },
  profiler: { id: 'profiler', name: 'Profiler', sub: 'what it shows', tone: 'muted' },
  gc: { id: 'gc', name: 'GC', sub: 'collections', tone: 'muted' },
  gen0: { id: 'gen0', name: 'Gen 0', sub: 'new small objects', tone: 'pool' },
  gen1: { id: 'gen1', name: 'Gen 1', sub: 'survived one GC', tone: 'pool' },
  gen2: { id: 'gen2', name: 'Gen 2', sub: 'survived two GCs', tone: 'pool' },
}
const rows = (...ids: string[]) => ids.map((id) => ROW[id])
const GENS = rows('gc', 'gen0', 'gen1', 'gen2')
const spec = (steps: Record<string, RowStep>, r = GENS): RowSpec => ({ rows: r, steps })

const chip = (key: string, label: string, kind: ChipKind = 'item'): Chip => ({ key, label, kind })
const entry = (kind: ChipKind = 'item', n = 1): Chip => chip(`entry${n}`, kind === 'dead' ? 'expired entry' : 'entry', kind)
const temps = (kind: ChipKind = 'item'): Chip[] => [chip('t1', 'temp', kind), chip('t2', 'temp', kind)]
const deadEntries: Chip[] = [entry('dead', 1), entry('dead', 2), entry('dead', 3), chip('more', '…', 'dead')]
const gc = (key: string, label: string, kind: ChipKind = 'run'): Chip => chip(key, label, kind)
const GC0 = gc('gc0', 'gen 0 GC')
const GC1 = gc('gc1', 'gen 1 GC')
const GC2 = gc('gc2', 'gen 2 GC', 'bad')

const M = {
  alloc: { rows: { gen0: [entry(), ...temps()] } },
  'gen0-gc': { rows: { gc: [GC0], gen0: temps('gone'), gen1: [entry()] } },
  'gen1-gc': { rows: { gc: [GC1], gen2: [entry()] } },
  expire: { rows: { gc: [gc('gc01', 'gen 0 and 1 GCs')], gen2: [entry('dead')] } },
  full: { rows: { gc: [GC2, gc('gc2b', 'gen 2 GC', 'bad'), gc('gc2c', '…', 'bad')], gen2: deadEntries } },
} satisfies Record<string, RowStep>

const SPECS: Record<string, RowSpec> = {
  setup: spec(
    {
      cache: { rows: { cache: [chip('r1', 'result'), chip('r2', 'result'), chip('r3', 'result'), chip('r4', '…')] } },
      profile: {
        rows: {
          cache: [chip('r1', 'result'), chip('r2', 'result'), chip('r3', 'result'), chip('r4', '…')],
          profiler: [chip('p1', 'gen 2 GCs: frequent', 'run'), chip('p2', 'time in GC: high', 'run'), chip('p3', 'cause: ?', 'wait')],
        },
      },
    },
    rows('cache', 'profiler'),
  ),
  midlife: spec(M),
  cheap: spec({
    young: { rows: { gc: [GC0], gen0: [chip('temp', 'temp', 'gone')] } },
    forever: { rows: { gc: [GC0], gen0: [chip('temp', 'temp', 'gone')], gen2: [chip('config', 'app config', 'ok')] } },
    midlife: { rows: { gc: [GC2], gen0: [chip('temp', 'temp', 'gone')], gen2: [chip('config', 'app config', 'ok'), ...deadEntries] } },
  }),

  'direct-claim': spec({
    alloc: { rows: { gen0: temps(), gen2: [entry('bad')] } },
    bypass: { rows: { gc: [GC0], gen0: temps('gone'), gen2: [chip('entry1', 'entry: skips gen 0', 'bad')] } },
  }),
  'direct-reality': spec({
    alloc: M.alloc,
    bypass: { rows: { gc: [GC0, GC1], gen0: temps('gone'), gen2: [chip('entry1', 'entry: promoted twice', 'ok')] } },
  }),

  'pinned-claim': spec({
    pin: { rows: { gen0: [chip('entry1', 'entry: pinned', 'bad'), ...temps()] } },
    full: { rows: { gc: [gc('full', 'full blocking GC', 'bad')], gen0: [chip('entry1', 'entry: pinned', 'bad'), ...temps()] } },
  }),
  'pinned-reality': spec({
    pin: { rows: { gen0: [chip('entry1', 'entry: not pinned', 'ok'), ...temps()] } },
    full: { rows: { gc: [GC0, GC1, GC2], gen0: temps('gone'), gen2: deadEntries } },
  }),

  'suspended-claim': spec(
    {
      suspend: { rows: { cache: [entry('item', 1), entry('item', 2), chip('grow', 'growing…', 'run')], gc: [gc('gc1', 'gen 1 GC: suspended', 'bad')] } },
      every: {
        rows: { cache: [entry('item', 1), entry('item', 2), chip('grow', 'growing…', 'run')], gc: [gc('gc1', 'gen 1 GC: suspended', 'bad'), GC2, gc('gc2b', 'gen 2 GC', 'bad')] },
      },
    },
    rows('cache', 'gc', 'gen0', 'gen1', 'gen2'),
  ),
  'suspended-reality': spec(
    {
      suspend: {
        rows: { cache: [entry('item', 1), entry('item', 2), chip('grow', 'growing…', 'run')], gc: [GC0, gc('gc1', 'gen 1 GC', 'ok')], gen1: [entry('item', 2)], gen2: [entry('item', 1)] },
      },
      every: { rows: { cache: [chip('grow', 'newer entries…', 'run')], gc: [GC0, gc('gc1', 'gen 1 GC', 'ok'), GC2], gen2: deadEntries } },
    },
    rows('cache', 'gc', 'gen0', 'gen1', 'gen2'),
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
