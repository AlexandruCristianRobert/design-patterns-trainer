import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type ChipKind, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const CODE = [
  '// cache lives in gen 2',
  'var order = new Order();  // gen 0',
  '// a reference store runs the write barrier',
  'cache.Latest = order;',
]
const L = { NEW: 1, STORE: [2, 3] as [number, number] }

const ROW: Record<string, RowDef> = {
  app: { id: 'app', name: 'App threads', tone: 'ui' },
  gc: { id: 'gc', name: 'Gen 0 GC', sub: 'what it does', tone: 'muted' },
  roots: { id: 'roots', name: 'Roots', sub: 'stacks, statics', tone: 'ui' },
  gen2: { id: 'gen2', name: 'Gen 2', sub: '6 GB, long-lived', tone: 'pool' },
  cards: { id: 'cards', name: 'Card table', sub: 'simplified: 5 cards', tone: 'io', slots: 5, ends: ['card 0', 'card 4'] },
  gen1: { id: 'gen1', name: 'Gen 1', tone: 'pool' },
  gen0: { id: 'gen0', name: 'Gen 0', sub: 'young objects', tone: 'pool' },
}
const rows = (...ids: string[]) => ids.map((id) => ROW[id])
const CARD_ROWS = rows('gc', 'roots', 'gen2', 'cards', 'gen1', 'gen0')
const spec = (steps: Record<string, RowStep>, r = CARD_ROWS, code: string[] | undefined = CODE): RowSpec => ({ rows: r, code, steps })

const chip = (key: string, label: string, kind: ChipKind = 'item'): Chip => ({ key, label, kind })
const gen2 = (cache: Chip | null = chip('cache', 'cache → order')): Chip[] => [
  chip('o1', 'obj'),
  chip('o2', 'obj'),
  ...(cache ? [cache] : [chip('cache', 'cache')]),
  chip('o3', 'obj'),
  chip('rest', '… 6 GB'),
]
/** Card bits; `marked` is the card that covers `cache`. */
const cards = (marked: ChipKind | null): Chip[] => Array.from({ length: 5 }, (_, i) => (i === 2 && marked ? chip(`k${i}`, '1', marked) : chip(`k${i}`, '0', 'gone')))
const young = (order: ChipKind = 'item', temps: ChipKind = 'item'): Chip[] => [chip('order', 'order', order), chip('t1', 'temp', temps), chip('t2', 'temp', temps), chip('t3', 'temp', temps)]
const ROOTS: Chip[] = [chip('stack', 'stack'), chip('statics', 'statics')]

const STORE: RowStep = { rows: { roots: ROOTS, gen2: gen2(), cards: cards('run'), gen0: young() }, line: L.STORE }
const SCAN_ROOTS: RowStep = { rows: { ...STORE.rows, gc: [chip('roots', 'scan roots', 'run')] }, line: L.STORE }
const SCAN_CARDS: RowStep = {
  rows: {
    roots: ROOTS,
    gen2: gen2(chip('cache', 'cache → order', 'ok')),
    cards: cards('ok'),
    gen0: young('ok'),
    gc: [chip('roots', 'scan roots', 'run'), chip('card', 'scan card 2 only', 'run'), chip('skip', 'clean cards: skipped', 'gone')],
  },
  line: L.STORE,
}
const COPIED: RowStep = {
  rows: {
    ...SCAN_CARDS.rows,
    gen0: [chip('t1', 'temp', 'gone'), chip('t2', 'temp', 'gone'), chip('t3', 'temp', 'gone')],
    gen1: [chip('order', 'order', 'ok')],
    gc: [chip('roots', 'scan roots', 'run'), chip('card', 'scan card 2 only', 'run'), chip('copy', 'copy 1 survivor', 'run')],
  },
  line: L.STORE,
}

const SPECS: Record<string, RowSpec> = {
  setup: spec(
    {
      heap: { rows: { gen2: gen2(chip('cache', 'obj')), gen0: [chip('n1', 'new'), chip('n2', 'new'), chip('n3', 'new')] } },
      fast: { rows: { gen2: gen2(chip('cache', 'obj')), gen0: [chip('n1', 'new'), chip('n2', 'new'), chip('n3', 'new')], gc: [chip('ms', 'well under 1 ms', 'ok')] } },
    },
    rows('gc', 'gen2', 'gen0'),
    undefined,
  ),

  'card-table': spec({
    store: STORE,
    roots: SCAN_ROOTS,
    cards: SCAN_CARDS,
    copy: COPIED,
    cost: { rows: { ...COPIED.rows, gc: [...COPIED.rows.gc!, chip('ms', 'well under 1 ms', 'ok')] }, line: L.STORE },
  }),

  'background-claim': spec(
    {
      collect: { rows: { gc: [chip('bg', 'on a background thread', 'bad')], app: [chip('run', 'running')], gen0: young() } },
      hidden: { rows: { gc: [chip('bg', 'on a background thread', 'bad')], app: [chip('run', 'running, never paused', 'bad')], gen0: young('item', 'gone') } },
    },
    rows('gc', 'app', 'gen0'),
    undefined,
  ),
  'background-reality': spec(
    {
      collect: { rows: { gc: [chip('bg', 'blocking: always for gen 0', 'ok')], app: [chip('run', 'paused', 'wait')], gen0: young() } },
      hidden: {
        rows: {
          gc: [chip('bg', 'blocking: always for gen 0', 'ok'), chip('card', 'roots + marked cards', 'run'), chip('ms', 'well under 1 ms', 'ok')],
          app: [chip('run', 'paused, briefly', 'wait')],
          cards: cards('ok'),
          gen0: young('ok', 'gone'),
        },
      },
    },
    rows('gc', 'app', 'cards', 'gen0'),
    undefined,
  ),

  'process-claim': spec(
    {
      apart: { rows: { gen2: [chip('proc', 'in a separate process', 'bad'), ...gen2(chip('cache', 'obj'))], gen0: young() } },
      skip: { rows: { gen2: [chip('proc', 'in a separate process', 'bad'), ...gen2(chip('cache', 'obj'))], gen0: young(), gc: [chip('never', 'never looks at gen 2')] } },
    },
    rows('gc', 'gen2', 'gen0'),
    undefined,
  ),
  'process-reality': spec({
    apart: { rows: { gen2: [chip('proc', 'same process', 'ok'), ...gen2()], gen0: young() }, line: L.STORE },
    skip: { rows: { ...SCAN_CARDS.rows, gen2: [chip('proc', 'same process', 'ok'), ...gen2(chip('cache', 'cache → order', 'ok'))] }, line: L.STORE },
  }),

  'refcount-claim': spec(
    {
      count: { rows: { gen0: [chip('order', 'order: refs 1'), chip('t1', 'temp: refs 0'), chip('t2', 'temp: refs 0'), chip('t3', 'temp: refs 0')] } },
      free: {
        rows: {
          gen0: [chip('order', 'order: refs 1'), chip('t1', 'freed at 0', 'gone'), chip('t2', 'freed at 0', 'gone'), chip('t3', 'freed at 0', 'gone')],
          gc: [chip('one', 'one by one, no heap scan', 'bad')],
        },
      },
    },
    rows('gc', 'gen0'),
    undefined,
  ),
  'refcount-reality': spec({
    count: { rows: { roots: ROOTS, gen2: gen2(), cards: cards('run'), gen0: young(), gc: [chip('trace', 'tracing, no counts', 'ok')] }, line: L.STORE },
    free: { rows: { ...COPIED.rows, gc: [chip('trace', 'tracing, no counts', 'ok'), ...COPIED.rows.gc!] }, line: L.STORE },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
