import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const CODE = [
  'var customers = new[] { (Id: 1, Name: "Ana"),',
  '                        (Id: 2, Name: "Ben") };',
  'var orders = new[] { (CustomerId: 1, Total: 10),',
  '                     (CustomerId: 1, Total: 5),',
  '                     (CustomerId: 3, Total: 7) };',
  '',
  'var joined = customers.Join(orders,',
  '    c => c.Id, o => o.CustomerId, (c, o) => c.Name);',
  'Console.WriteLine(joined.Count());',
  '',
  'var grouped = customers.GroupJoin(orders,',
  '    c => c.Id, o => o.CustomerId,',
  '    (c, os) => $"{c.Name}:{os.Count()}");',
  'foreach (var line in grouped) Console.WriteLine(line);',
]
const L = { DATA: [0, 4] as [number, number], JOIN: [6, 7] as [number, number], COUNT: 8, JOIN_ALL: [6, 8] as [number, number], GROUP: [10, 12] as [number, number], PRINT: 13, GROUP_ALL: [10, 13] as [number, number] }

const CUST: RowDef = { id: 'cust', name: 'customers', sub: 'outer', tone: 'ui' }
const ORD: RowDef = { id: 'ord', name: 'orders', sub: 'inner', tone: 'pool' }
const JOIN: RowDef = { id: 'join', name: 'Join yields', sub: 'c.Name', tone: 'ok' }
const GROUP: RowDef = { id: 'group', name: 'GroupJoin yields', sub: 'customer + group', tone: 'ok' }
const CONSOLE: RowDef = { id: 'console', name: 'Console', sub: 'lines in order', tone: 'io' }

type K = Chip['kind']
/** Each source element: plain, matched (ok), dropped (dead) or the claim's failure (bad). */
const cust = (ana: K = 'run', ben: K = 'run'): Chip[] => [
  { key: 'ana', label: ana === 'dead' ? 'Ana · 1: no match' : 'Ana · Id 1', kind: ana },
  { key: 'ben', label: ben === 'dead' ? 'Ben · 2: no match' : ben === 'bad' ? 'Ben · 2: dropped' : 'Ben · Id 2', kind: ben },
]
const ord = (o1: K = 'run', o2: K = 'run', o3: K = 'run'): Chip[] => [
  { key: 'o1', label: 'cust 1 · 10', kind: o1 },
  { key: 'o2', label: 'cust 1 · 5', kind: o2 },
  { key: 'o3', label: o3 === 'dead' ? 'cust 3 · 7: no match' : 'cust 3 · 7', kind: o3 },
]
const yields = (...items: [string, string, K?][]): Chip[] => items.map(([key, label, kind]) => ({ key, label, kind: kind ?? 'run' }))
const out = (...lines: string[]): Chip[] => lines.map((t, i) => ({ key: `c${i}`, label: t, kind: t.startsWith('?') ? 'wait' : 'item' }))

const ANA_PAIRS = yields(['a1', '"Ana" (order 10)'], ['a2', '"Ana" (order 5)'])
const ANA_GROUP: [string, string, K?] = ['ga', 'Ana + [10, 5]']
const BEN_GROUP: [string, string, K?] = ['gb', 'Ben + [ ]']

const spec = (rows: RowDef[], steps: Record<string, RowStep>): RowSpec => ({ rows, code: CODE, steps })
const J = [CUST, ORD, JOIN, CONSOLE]
const G = [CUST, ORD, GROUP, CONSOLE]

/** The real Join, step by step. */
const RJ = {
  ana: { rows: { cust: cust('ok'), ord: ord('ok', 'ok'), join: ANA_PAIRS, console: [] }, line: L.JOIN },
  ben: { rows: { cust: cust('ok', 'dead'), ord: ord('ok', 'ok'), join: ANA_PAIRS, console: [] }, line: L.JOIN },
  orphan: { rows: { cust: cust('ok', 'dead'), ord: ord('ok', 'ok', 'dead'), join: ANA_PAIRS, console: [] }, line: L.JOIN },
  count: { rows: { cust: cust('ok', 'dead'), ord: ord('ok', 'ok', 'dead'), join: ANA_PAIRS, console: out('2') }, line: L.COUNT },
} satisfies Record<string, RowStep>
const ALL_OUT = out('2', 'Ana:2', 'Ben:0')

const SPECS: Record<string, RowSpec> = {
  setup: spec([CUST, ORD, JOIN, GROUP, CONSOLE], {
    data: { rows: { cust: cust(), ord: ord() }, line: L.DATA },
    join: { rows: { cust: cust(), ord: ord(), join: out('?'), console: out('?') }, line: L.JOIN_ALL },
    groupjoin: { rows: { cust: cust(), ord: ord(), join: out('? …'), group: out('? …'), console: out('?') }, line: L.GROUP_ALL },
  }),
  join: spec(J, RJ),
  groupjoin: spec(G, {
    ana: { rows: { cust: cust('ok'), ord: ord('ok', 'ok'), group: yields(ANA_GROUP), console: out('2') }, line: L.GROUP },
    ben: { rows: { cust: cust('ok', 'ok'), ord: ord('ok', 'ok'), group: yields(ANA_GROUP, BEN_GROUP), console: out('2') }, line: L.GROUP },
    orphan: { rows: { cust: cust('ok', 'ok'), ord: ord('ok', 'ok', 'dead'), group: yields(ANA_GROUP, BEN_GROUP), console: out('2') }, line: L.GROUP },
    print: { rows: { cust: cust('ok', 'ok'), ord: ord('ok', 'ok', 'dead'), group: yields(ANA_GROUP, BEN_GROUP), console: ALL_OUT }, line: L.PRINT },
  }),

  'keeps-orphan-claim': spec(J, {
    ana: RJ.ana,
    orphan: { rows: { cust: cust('ok'), ord: ord('ok', 'ok', 'bad'), join: [...ANA_PAIRS, ...yields(['o3', '(no customer) (order 7)', 'bad'])], console: [] }, line: L.JOIN, bad: true },
    count: {
      rows: { cust: cust('ok'), ord: ord('ok', 'ok', 'bad'), join: [...ANA_PAIRS, ...yields(['o3', '(no customer) (order 7)', 'bad'])], console: out('3', 'Ana:2', 'Ben:0') },
      line: L.COUNT,
      bad: true,
    },
  }),
  'keeps-orphan-reality': spec(J, {
    ana: RJ.ana,
    orphan: RJ.orphan,
    count: { ...RJ.count, rows: { ...RJ.count.rows, console: ALL_OUT } },
  }),

  'one-per-customer-claim': spec(J, {
    ana: { rows: { cust: cust('ok'), ord: ord('ok', 'ok'), join: yields(['a', '"Ana"', 'bad']), console: [] }, line: L.JOIN, bad: true },
    ben: { rows: { cust: cust('ok', 'dead'), ord: ord('ok', 'ok'), join: yields(['a', '"Ana"', 'bad']), console: [] }, line: L.JOIN },
    count: { rows: { cust: cust('ok', 'dead'), ord: ord('ok', 'ok'), join: yields(['a', '"Ana"', 'bad']), console: out('1', 'Ana:2', 'Ben:0') }, line: L.COUNT, bad: true },
  }),
  'one-per-customer-reality': spec(J, {
    ana: RJ.ana,
    ben: RJ.ben,
    count: { ...RJ.ben, rows: { ...RJ.ben.rows, console: ALL_OUT }, line: L.COUNT },
  }),

  'groupjoin-drops-claim': spec([CUST, ORD, JOIN, GROUP, CONSOLE], {
    join: { rows: { ...RJ.count.rows, cust: cust('ok'), ord: ord('ok', 'ok') }, line: L.JOIN_ALL },
    ana: { rows: { cust: cust('ok'), ord: ord('ok', 'ok'), join: ANA_PAIRS, group: yields(ANA_GROUP), console: out('2') }, line: L.GROUP },
    ben: { rows: { cust: cust('ok', 'bad'), ord: ord('ok', 'ok'), join: ANA_PAIRS, group: yields(ANA_GROUP), console: out('2', 'Ana:2') }, line: L.PRINT, bad: true },
  }),
  'groupjoin-drops-reality': spec([CUST, ORD, JOIN, GROUP, CONSOLE], {
    join: { rows: { ...RJ.count.rows, cust: cust('ok'), ord: ord('ok', 'ok') }, line: L.JOIN_ALL },
    ana: { rows: { cust: cust('ok'), ord: ord('ok', 'ok'), join: ANA_PAIRS, group: yields(ANA_GROUP), console: out('2') }, line: L.GROUP },
    ben: { rows: { cust: cust('ok', 'ok'), ord: ord('ok', 'ok'), join: ANA_PAIRS, group: yields(ANA_GROUP, BEN_GROUP), console: ALL_OUT }, line: L.PRINT },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
