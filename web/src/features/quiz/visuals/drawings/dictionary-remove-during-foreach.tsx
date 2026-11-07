import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { TableStage, type TableDef, type TableSpec, type TableStep, type TChip, type TRow } from '../TableStage'

const CODE = [
  'var stock = new Dictionary<string, int> { ["a"] = 0, ["b"] = 5, ["c"] = 0 };',
  'foreach (var (key, qty) in stock)',
  '    if (qty == 0) stock.Remove(key);',
  'Console.WriteLine(stock.Count);',
  '',
  'var list = new List<int> { 1, 2, 3 };',
  'try',
  '{',
  '    foreach (var n in list)',
  '        if (n == 1) list.Remove(n);',
  '    Console.WriteLine("no error");',
  '}',
  'catch (InvalidOperationException)',
  '{',
  '    Console.WriteLine("threw");',
  '}',
]
const L = {
  DICT: [0, 3] as [number, number],
  DICT_FOREACH: 1,
  DICT_REMOVE: 2,
  COUNT: 3,
  LIST: [5, 15] as [number, number],
  LIST_FOREACH: 8,
  LIST_REMOVE: 9,
  NO_ERROR: 10,
  THREW: 14,
}

const STOCK: TableDef = { id: 'stock', name: 'stock', sub: 'Dictionary<string, int>', tone: 'ui', columns: ['Key', 'Qty'] }
const LIST: TableDef = { id: 'list', name: 'list', sub: 'List<int>', tone: 'pool', columns: ['Item'] }

/** What the step says about an entry: untouched, being looked at, kept, removed, or (claimed) skipped. */
type St = 'plain' | 'cur' | 'kept' | 'removed' | 'gone' | 'skipped'
const look = (st: St): Pick<TRow, 'kind' | 'mark' | 'markKind'> =>
  ({
    plain: {},
    cur: { kind: 'read', mark: 'enumerator here' },
    kept: { kind: 'hit', mark: 'kept', markKind: 'ok' },
    removed: { kind: 'skip', mark: 'removed', markKind: 'ok' },
    gone: { kind: 'skip', mark: 'removed', markKind: 'ok' },
    skipped: { kind: 'bad', mark: 'skipped', markKind: 'bad' },
  })[st] as Pick<TRow, 'kind' | 'mark' | 'markKind'>
const QTY: Record<string, string> = { a: '0', b: '5', c: '0' }
const stock = (a: St, b: St, c: St): TRow[] => Object.entries({ a, b, c }).map(([key, st]) => ({ key, cells: [`"${key}"`, QTY[key]], ...look(st) }))
const list = (one: St, two: St = 'plain', three: St = 'plain'): TRow[] => [one, two, three].map((st, i) => ({ key: `${i + 1}`, cells: [`${i + 1}`], ...look(st) }))

const chip = (key: string, label: string, kind: TChip['kind'] = 'run'): TChip => ({ key, label, kind })
/** Console lines in order; '?' is unknown, '…' not printed yet. */
const out = (...lines: string[]): OutLine[] =>
  lines.map((t, i) => ({ label: `line ${i + 1}`, text: t, kind: t === '?' ? 'muted' : t === '…' ? 'muted' : 'plain' }))
const mark = (lines: OutLine[], kind: OutLine['kind']): OutLine[] => lines.map((o) => (o.kind === 'muted' ? o : { ...o, kind }))
const spec = (steps: Record<string, TableStep>): TableSpec => ({ tables: [STOCK, LIST], code: CODE, outputName: 'Console', steps })

const VALID = chip('valid', 'enumerator still valid', 'ok')
const VERSION = chip('ver', 'list version changed')
const THROWS = chip('throw', 'MoveNext: InvalidOperationException', 'bad')
const DONE = out('1', 'threw')

/** The real runs. */
const D = {
  a: { tables: { stock: stock('removed', 'plain', 'plain') }, line: L.DICT_REMOVE, output: out('…') },
  b: { tables: { stock: stock('gone', 'kept', 'plain') }, chips: [VALID], line: L.DICT_FOREACH, output: out('…') },
  c: { tables: { stock: stock('gone', 'kept', 'removed') }, chips: [VALID], line: L.DICT_REMOVE, output: out('…') },
  count: { tables: { stock: stock('gone', 'kept', 'gone') }, line: L.COUNT, output: mark(out('1'), 'ok') },
} satisfies Record<string, TableStep>
const Li = {
  remove: { tables: { list: list('removed') }, chips: [VERSION], line: L.LIST_REMOVE, output: out('1', '…') },
  next: { tables: { list: list('gone') }, chips: [VERSION, THROWS], line: L.LIST_FOREACH, bad: true, output: out('1', '…') },
  catch: { tables: { list: list('gone') }, chips: [VERSION, THROWS], line: L.THREW, output: mark(DONE, 'ok') },
} satisfies Record<string, TableStep>

const SPECS: Record<string, TableSpec> = {
  setup: spec({
    dict: { tables: { stock: stock('plain', 'plain', 'plain') }, line: L.DICT, output: out('?') },
    list: { tables: { stock: stock('plain', 'plain', 'plain'), list: list('plain') }, line: L.LIST, output: out('?', '?') },
    print: { tables: { stock: stock('plain', 'plain', 'plain'), list: list('plain') }, line: null, output: out('?', '?') },
  }),
  'dict-loop': spec(D),
  'list-loop': spec(Li),

  'dict-throws-claim': spec({
    a: D.a,
    next: { tables: { stock: stock('gone', 'plain', 'plain') }, chips: [THROWS], line: L.DICT_FOREACH, bad: true, output: out('…') },
    print: {
      tables: { stock: stock('gone', 'plain', 'plain') },
      chips: [THROWS],
      line: L.DICT_FOREACH,
      bad: true,
      output: [{ label: 'printed', text: 'nothing: unhandled exception', kind: 'bad' }],
    },
  }),
  'dict-throws-reality': spec({
    a: D.a,
    next: { tables: { stock: stock('gone', 'kept', 'plain') }, chips: [VALID], line: L.DICT_FOREACH, output: out('…') },
    print: { tables: { stock: stock('gone', 'kept', 'gone') }, chips: [VALID], line: L.THREW, output: mark(DONE, 'ok') },
  }),

  'list-ok-claim': spec({
    remove: { tables: { list: list('removed') }, line: L.LIST_REMOVE, output: out('1', '…') },
    next: { tables: { list: list('gone') }, chips: [chip('on', 'loop carries on', 'bad')], line: L.LIST_FOREACH, bad: true, output: out('1', '…') },
    print: { tables: { list: list('gone') }, chips: [chip('on', 'loop carries on', 'bad')], line: L.NO_ERROR, bad: true, output: mark(out('1', 'no error'), 'bad') },
  }),
  'list-ok-reality': spec({ remove: Li.remove, next: Li.next, print: Li.catch }),

  'skip-claim': spec({
    a: D.a,
    skip: { tables: { stock: stock('gone', 'kept', 'skipped') }, line: L.DICT_FOREACH, bad: true, output: out('…') },
    print: { tables: { stock: stock('gone', 'kept', 'skipped') }, line: L.COUNT, bad: true, output: mark(out('2', 'threw'), 'bad') },
  }),
  'skip-reality': spec({
    a: D.a,
    skip: { tables: { stock: stock('gone', 'kept', 'removed') }, chips: [VALID], line: L.DICT_REMOVE, output: out('…') },
    print: { tables: { stock: stock('gone', 'kept', 'gone') }, line: L.THREW, output: mark(DONE, 'ok') },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <TableStage spec={s} {...p} />]),
)
export default drawing
