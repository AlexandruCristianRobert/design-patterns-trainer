import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type ChipKind, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const ROW: Record<string, RowDef> = {
  query: { id: 'query', name: 'Query', sub: 'expensiveOrders', tone: 'muted' },
  src: { id: 'src', name: 'Orders', sub: 'Total, large source', tone: 'pool' },
  calls: { id: 'calls', name: 'Predicate', sub: 'Total > 1000', tone: 'muted' },
  list: { id: 'list', name: 'Copy', sub: 'of matches', tone: 'io' },
  counter: { id: 'counter', name: 'Counter', sub: 'inside Count()', tone: 'io' },
  later: { id: 'later', name: 'foreach', sub: 'later loop', tone: 'ui' },
  result: { id: 'result', name: 'Result', tone: 'ok' },
}
const rows = (...ids: string[]) => ids.map((id) => ROW[id])
const CODE = ['var expensiveOrders = orders.Where(o => o.Total > 1000);', '', 'if (expensiveOrders.Any()) { … }', 'if (expensiveOrders.Count() > 0) { … }']
const CACHE_CODE = ['var expensiveOrders = orders.Where(o => o.Total > 1000);', 'if (expensiveOrders.Count() > 0) { … }', 'orders.Add(new Order(5000));', 'foreach (var o in expensiveOrders) { … }']
const L = { QUERY: 0, ANY: 2, COUNT: 3 }
const spec = (r: RowDef[], steps: Record<string, RowStep>, code = CODE): RowSpec => ({ rows: r, code, steps })

const chip = (key: string, label: string, kind: ChipKind = 'item'): Chip => ({ key, label, kind })
const TOTALS = ['40', '75', '1500', '20', '2300', '60']
/** The source: the first `read` elements have been tested by the predicate. */
const source = (read: number, rest?: string, restKind: ChipKind = 'wait'): Chip[] => [
  ...TOTALS.map((t, i) => chip(`e${i}`, t, i >= read ? 'wait' : Number(t) > 1000 ? 'ok' : 'gone')),
  chip('more', rest ?? '…', restKind),
]
const LAZY = chip('q', 'lazy Where')

const SPECS: Record<string, RowSpec> = {
  // ---- Setup: the query and the source; nothing evaluated, nothing stored or not stored ----
  setup: spec(rows('query', 'src'), {
    query: { rows: { query: [LAZY], src: source(0) }, line: L.QUERY },
    forms: { rows: { query: [LAZY, chip('a', 'Any()', 'run'), chip('c', 'Count() > 0', 'run')], src: source(0) }, line: [L.ANY, L.COUNT] },
    ask: { rows: { query: [LAZY, chip('a', 'Any()', 'run'), chip('c', 'Count() > 0', 'run')], src: source(0) }, line: L.ANY },
  }),

  any: spec(rows('query', 'src', 'calls', 'result'), {
    start: { rows: { query: [chip('q', 'no elements, no count')], src: source(0) }, line: L.ANY },
    walk: { rows: { query: [chip('q', 'no elements, no count')], src: source(3), calls: [chip('n', '3 calls', 'run')] }, line: L.ANY },
    stop: {
      rows: { query: [chip('q', 'no elements, no count')], src: source(3, 'rest not read', 'wait'), calls: [chip('n', '3 calls', 'run')], result: [chip('r', 'true', 'ok')] },
      line: L.ANY,
    },
  }),
  count: spec(rows('query', 'src', 'calls', 'result'), {
    walk: { rows: { query: [chip('q', 'no elements, no count')], src: source(6, '… all read', 'gone'), calls: [chip('n', 'one per element', 'bad')] }, line: L.COUNT },
    result: {
      rows: { query: [chip('q', 'no elements, no count')], src: source(6, '… all read', 'gone'), calls: [chip('n', 'one per element', 'bad')], result: [chip('r', 'count > 0: true', 'ok')] },
      line: L.COUNT,
    },
  }),

  'list-claim': spec(rows('src', 'list'), {
    copy: { rows: { src: source(0), list: [chip('h', 'hidden list')] }, line: L.COUNT },
    memory: { rows: { src: source(0), list: [chip('h', 'hidden list'), chip('m1', '1500'), chip('m2', '2300'), chip('m3', '…')] }, line: L.COUNT },
  }),
  'list-reality': spec(rows('src', 'counter', 'list'), {
    counter: { rows: { src: source(6, '… all read', 'gone'), counter: [chip('c1', '1', 'run'), chip('c2', '2', 'run'), chip('c3', '…', 'run')] }, line: L.COUNT },
    cost: {
      rows: { src: source(6, '… all read', 'gone'), counter: [chip('c1', '1', 'run'), chip('c2', '2', 'run'), chip('c3', '…', 'run')], list: [chip('none', 'no copy', 'ok')] },
      line: L.COUNT,
    },
  }),

  'cache-claim': spec(
    rows('query', 'src', 'later'),
    {
      cache: { rows: { query: [chip('q', 'count cached: 2')], src: source(0) }, line: 1 },
      stale: {
        rows: { query: [chip('q', 'count cached: 2')], src: [...source(0), chip('new', '5000')], later: [chip('f', 'sees count 2')] },
        line: [2, 3],
      },
    },
    CACHE_CODE,
  ),
  'cache-reality': spec(
    rows('query', 'src', 'later'),
    {
      nothing: { rows: { query: [chip('q', 'no result stored', 'ok')], src: source(0) }, line: 1 },
      rerun: {
        rows: { query: [chip('q', 'no result stored', 'ok')], src: [...source(6, '… all read', 'gone'), chip('new', '5000', 'ok')], later: [chip('f', 'runs Where again', 'run'), chip('m', 'sees 5000', 'ok')] },
        line: 3,
      },
    },
    CACHE_CODE,
  ),

  'kept-claim': spec(rows('query', 'src'), {
    kept: { rows: { query: [chip('q', 'count kept: 2')], src: source(0) }, line: L.QUERY },
    read: { rows: { query: [chip('q', 'count kept: 2'), chip('a', 'Any() reads it')], src: source(0) }, line: L.ANY },
  }),
  'kept-reality': spec(rows('query', 'src', 'calls', 'result'), {
    unknown: { rows: { query: [chip('q', 'no count', 'bad')], src: source(0) }, line: L.QUERY },
    walk: { rows: { query: [chip('q', 'no count', 'bad')], src: source(3, 'rest not read', 'wait'), calls: [chip('n', '3 calls', 'run')], result: [chip('r', 'true', 'ok')] }, line: L.ANY },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
