import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type ChipKind, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const CODE = [
  'List<int> blockedIds = LoadBlockedIds();',
  '',
  'var allowed = orders',
  '    .Where(o => !blockedIds.Contains(o.CustomerId))',
  '    .ToList();',
]
const L = { LIST: 0, WHERE: 3, QUERY: [2, 4] as [number, number] }
const SET_CODE = [
  'var blocked = blockedIds.ToHashSet();',
  '',
  'var allowed = orders',
  '    .Where(o => !blocked.Contains(o.CustomerId))',
  '    .ToList();',
]
const H = { BUILD: 0, WHERE: 3 }

const ORDERS: RowDef = { id: 'orders', name: 'orders', sub: '1,000,000', tone: 'io' }
const LIST: RowDef = { id: 'list', name: 'blockedIds', sub: 'List<int>, 20,000 ids', tone: 'pool' }
const SET: RowDef = { id: 'set', name: 'blocked', sub: 'HashSet<int>', tone: 'pool' }
const WHERE: RowDef = { id: 'where', name: 'Where', sub: 'holds', tone: 'ui' }
const CLOSURE: RowDef = { id: 'closure', name: 'Closure', sub: 'captured variables', tone: 'ui' }
const MEMORY: RowDef = { id: 'memory', name: 'Lists in memory', tone: 'pool' }
const COST: RowDef = { id: 'cost', name: 'Comparisons', tone: 'muted' }
const TIME: RowDef = { id: 'time', name: 'Run time', tone: 'muted' }

const chip = (key: string, label: string, kind: ChipKind = 'item'): Chip => ({ key, label, kind })
const IDS = ['17', '5', '93', '28', '61', '40', '12']
/** The list in its built order; `read` ids were compared (all of them, the rest included, when read is 'all'). */
const list = (read: number | 'all' = 0, kind: ChipKind = 'gone'): Chip[] => [
  ...IDS.map((id, i) => chip(`id${id}`, id, read === 'all' || i < read ? kind : 'item')),
  chip('rest', '… 20,000 ids', read === 'all' ? kind : 'item'),
]
const order = (n: number, cust: number, kind: ChipKind = 'run') => chip(`o${n}`, `order ${n}: cust ${cust}`, kind)
const orderRow = (cur: Chip[]) => [...cur, chip('more', '… 1,000,000', 'item')]
const cost = (label: string, kind: ChipKind = 'bad') => [chip('c', label, kind)]

const spec = (rows: RowDef[], code: string[], steps: Record<string, RowStep>): RowSpec => ({ rows, code, steps })

const SCAN = {
  'first-order': { rows: { orders: orderRow([order(1, 42)]), list: list(), cost: cost('0', 'item') }, line: L.WHERE },
  scan: { rows: { orders: orderRow([order(1, 42)]), list: list('all'), cost: cost('20,000 so far') }, line: L.WHERE },
  'next-order': { rows: { orders: orderRow([order(1, 42, 'ok'), order(2, 7)]), list: list('all'), cost: cost('40,000 so far') }, line: L.WHERE },
  total: { rows: { orders: [chip('all', 'all 1,000,000 orders', 'run')], list: list('all'), cost: cost('≈ 20,000,000,000') }, line: L.QUERY, bad: true },
} satisfies Record<string, RowStep>

const hashed = [chip('set', '20,000 ids, hashed', 'item')]
const HASH = {
  build: { rows: { list: list('all'), set: hashed, cost: cost('20,000, once', 'item') }, line: H.BUILD },
  lookup: { rows: { orders: orderRow([order(1, 42)]), list: list(), set: [...hashed, chip('b', 'bucket for 42: no match', 'ok')], cost: cost('20,000 + about 1', 'ok') }, line: H.WHERE },
  total: { rows: { orders: [chip('all', 'all 1,000,000 orders', 'run')], list: list(), set: [...hashed, chip('b', 'one bucket per order', 'ok')], cost: cost('≈ 1,000,000 + 20,000', 'ok') }, line: H.WHERE },
} satisfies Record<string, RowStep>

const one = [chip('list', 'the List<int>, 20,000 ids', 'item')]

const SPECS: Record<string, RowSpec> = {
  setup: spec([ORDERS, LIST, TIME], CODE, {
    orders: { rows: { orders: orderRow([order(1, 42, 'item'), order(2, 7, 'item')]) }, line: null },
    blocked: { rows: { orders: orderRow([order(1, 42, 'item'), order(2, 7, 'item')]), list: list() }, line: L.LIST },
    query: { rows: { orders: orderRow([order(1, 42, 'item'), order(2, 7, 'item')]), list: list(), time: [chip('t', 'minutes', 'bad')] }, line: L.QUERY },
  }),
  'list-scan': spec([ORDERS, LIST, COST], CODE, SCAN),
  'hash-set': spec([ORDERS, LIST, SET, COST], SET_CODE, HASH),

  'copy-claim': spec([ORDERS, WHERE, LIST], CODE, {
    copy: { rows: { orders: orderRow([]), where: [chip('copy', 'a copy of all 1,000,000 orders', 'bad')], list: list() }, line: L.WHERE, bad: true },
    filter: { rows: { orders: orderRow([]), where: [chip('copy', 'a copy of all 1,000,000 orders', 'bad'), chip('f', 'now filtering the copy', 'bad')], list: list() }, line: L.WHERE, bad: true },
  }),
  'copy-reality': spec([ORDERS, WHERE, LIST, COST], CODE, {
    copy: { rows: { orders: orderRow([order(1, 42)]), where: [chip('cur', 'order 1 only', 'ok')], list: list() }, line: L.WHERE },
    filter: { rows: { orders: orderRow([order(1, 42, 'ok'), order(2, 7)]), where: [chip('cur', 'order 2 only', 'ok')], list: list('all'), cost: cost('up to 20,000 per order') }, line: L.WHERE },
  }),

  'capture-claim': spec([CLOSURE, MEMORY], CODE, {
    capture: { rows: { closure: [chip('ref', 'blockedIds: reference to the list')], memory: one }, line: L.WHERE },
    copy: {
      rows: { closure: [chip('ref', 'blockedIds: reference to the list')], memory: [...one, chip('c1', 'copy for order 1', 'bad'), chip('c2', 'copy for order 2', 'bad'), chip('c3', '… one per order', 'bad')] },
      line: L.WHERE,
      bad: true,
    },
  }),
  'capture-reality': spec([CLOSURE, MEMORY, LIST], CODE, {
    capture: { rows: { closure: [chip('ref', 'blockedIds: reference to the list', 'ok')], memory: one, list: list() }, line: L.WHERE },
    copy: { rows: { closure: [chip('ref', 'blockedIds: reference to the list', 'ok')], memory: [...one, chip('none', 'no copies', 'ok')], list: list('all') }, line: L.WHERE },
  }),

  'sort-claim': spec([ORDERS, LIST], CODE, {
    call: { rows: { orders: orderRow([order(1, 42)]), list: list() }, line: L.WHERE },
    sort: {
      rows: { orders: orderRow([order(1, 42)]), list: [...[...IDS].sort((a, b) => Number(a) - Number(b)).map((id) => chip(`id${id}`, id, 'dead')), chip('rest', '… sorted', 'dead')] },
      line: L.WHERE,
      bad: true,
    },
    search: {
      rows: {
        orders: orderRow([order(1, 42)]),
        list: [...[...IDS].sort((a, b) => Number(a) - Number(b)).map((id) => chip(`id${id}`, id, ['28', '40', '61'].includes(id) ? 'bad' : 'dead')), chip('rest', '… sorted', 'dead')],
      },
      line: L.WHERE,
      bad: true,
    },
  }),
  'sort-reality': spec([ORDERS, LIST], CODE, {
    call: { rows: { orders: orderRow([order(1, 42)]), list: list() }, line: L.WHERE },
    sort: { rows: { orders: orderRow([order(1, 42)]), list: [...list(), chip('note', 'unsorted, as built', 'ok')] }, line: L.WHERE },
    search: { rows: { orders: orderRow([order(1, 42)]), list: list('all') }, line: L.WHERE },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
