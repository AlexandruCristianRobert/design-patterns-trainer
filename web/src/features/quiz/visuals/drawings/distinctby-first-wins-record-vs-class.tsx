import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { TableStage, type TableDef, type TableSpec, type TableStep, type TChip, type TRow } from '../TableStage'

const CODE = [
  'var orders = new[] { new Order(1, "Ana"), new Order(2, "Ben"), new Order(3, "Ana") };',
  'Console.WriteLine(string.Join(",", orders.DistinctBy(o => o.Customer).Select(o => o.Id)));',
  '',
  'var tags = new[] { new Tag("x"), new Tag("x") };',
  'Console.WriteLine(tags.Distinct().Count());',
  '',
  'var items = new[] { new Item("x"), new Item("x") };',
  'Console.WriteLine(items.Distinct().Count());',
  '',
  'record Order(int Id, string Customer);',
  'record Tag(string Name);',
  'class Item(string name) { public string Name { get; } = name; }',
]
const L = { ORDERS: 0, BY: 1, TAGS: 3, TAG_D: 4, ITEMS: 6, ITEM_D: 7 }

const ORDERS: TableDef = { id: 'orders', name: 'orders', sub: 'record Order', tone: 'ui', columns: ['Id', 'Customer'] }
const TAGS: TableDef = { id: 'tags', name: 'tags', sub: 'record Tag', tone: 'pool', columns: ['Index', 'Name'] }
const ITEMS: TableDef = { id: 'items', name: 'items', sub: 'class Item', tone: 'io', columns: ['Index', 'Name'] }

const spec = (tables: TableDef[], steps: Record<string, TableStep>): TableSpec => ({ tables, code: CODE, outputName: 'Console', steps })

/** The three printed lines; '?' for a line not printed yet. */
const out = (texts: string[], kinds: OutLine['kind'][] = []): OutLine[] =>
  ['line 1', 'line 2', 'line 3'].map((label, i) => {
    const text = texts[i] ?? '?'
    return { label, text, kind: kinds[i] ?? (text === '?' ? 'muted' : 'plain') }
  })

type Mark = Pick<TRow, 'kind' | 'mark' | 'markKind'>
const order = (id: number, customer: string, m: Mark = {}): TRow => ({ key: `o${id}`, cells: [String(id), `"${customer}"`], ...m })
const el = (prefix: string, i: number, m: Mark = {}): TRow => ({ key: `${prefix}${i}`, cells: [`[${i}]`, '"x"'], ...m })
const KEPT: Mark = { kind: 'hit', mark: 'kept', markKind: 'ok' }
const SKIPPED: Mark = { kind: 'skip', mark: 'skipped', markKind: 'bad' }
const keys = (label: string): TChip[] => [{ key: 'keys', label }]

const ORDER_ROWS = [order(1, 'Ana'), order(2, 'Ben'), order(3, 'Ana')]
const TAG_ROWS = [el('t', 0), el('t', 1)]
const ITEM_ROWS = [el('i', 0), el('i', 1)]

// ---- Reality: DistinctBy ----
const BY1 = [order(1, 'Ana', KEPT), order(2, 'Ben'), order(3, 'Ana')]
const BY2 = [order(1, 'Ana', KEPT), order(2, 'Ben', KEPT), order(3, 'Ana')]
const BY3 = [order(1, 'Ana', KEPT), order(2, 'Ben', KEPT), order(3, 'Ana', { ...SKIPPED, mark: '"Ana" seen' })]

// ---- Reality: Distinct ----
const TAG1 = [el('t', 0, KEPT), el('t', 1)]
const TAG2 = [el('t', 0, KEPT), el('t', 1, { ...SKIPPED, mark: 'equal' })]
const ITEM1 = [el('i', 0, KEPT), el('i', 1)]
const ITEM2 = [el('i', 0, KEPT), el('i', 1, { ...KEPT, mark: 'other object' })]

const SPECS: Record<string, TableSpec> = {
  setup: spec([ORDERS, TAGS, ITEMS], {
    orders: { tables: { orders: ORDER_ROWS }, line: [L.ORDERS, L.BY] },
    'tags-items': { tables: { orders: ORDER_ROWS, tags: TAG_ROWS, items: ITEM_ROWS }, line: { each: [[L.TAGS, L.TAG_D], [L.ITEMS, L.ITEM_D]] } },
    print: { tables: { orders: ORDER_ROWS, tags: TAG_ROWS, items: ITEM_ROWS }, line: { each: [L.BY, L.TAG_D, L.ITEM_D] }, output: out([]) },
  }),

  'distinct-by': spec([ORDERS], {
    first: { tables: { orders: BY1 }, chips: keys('keys seen: "Ana"'), line: L.BY },
    second: { tables: { orders: BY2 }, chips: keys('keys seen: "Ana", "Ben"'), line: L.BY },
    third: { tables: { orders: BY3 }, chips: keys('keys seen: "Ana", "Ben"'), line: L.BY },
    print: { tables: { orders: BY3 }, chips: keys('keys seen: "Ana", "Ben"'), line: L.BY, output: out(['1,2'], ['ok']) },
  }),
  distinct: spec([TAGS, ITEMS], {
    'tag-1': { tables: { tags: TAG1, items: ITEM_ROWS }, line: L.TAG_D },
    'tag-2': { tables: { tags: TAG2, items: ITEM_ROWS }, chips: [{ key: 'eq', label: 'Tag: record, value equality' }], line: L.TAG_D, output: out(['1,2', '1'], [undefined, 'ok']) },
    'item-1': { tables: { tags: TAG2, items: ITEM1 }, chips: [{ key: 'eq', label: 'Tag: record, value equality' }], line: L.ITEM_D, output: out(['1,2', '1']) },
    'item-2': {
      tables: { tags: TAG2, items: ITEM2 },
      chips: [{ key: 'eq', label: 'Tag: record, value equality' }, { key: 'ref', label: 'Item: class, reference equality' }],
      line: L.ITEM_D,
      output: out(['1,2', '1', '2'], [undefined, undefined, 'ok']),
    },
  }),

  'last-claim': spec([ORDERS], {
    keep: { tables: { orders: [order(1, 'Ana', { mark: 'replaced' }), order(2, 'Ben', { mark: 'kept' }), order(3, 'Ana', { mark: 'kept' })] }, line: L.BY },
    print: {
      tables: { orders: [order(1, 'Ana', { mark: 'replaced' }), order(2, 'Ben', { mark: 'printed' }), order(3, 'Ana', { mark: 'printed' })] },
      line: L.BY,
      output: out(['2,3', '1', '2']),
    },
  }),
  'last-reality': spec([ORDERS], {
    first: { tables: { orders: BY1 }, chips: keys('keys seen: "Ana"'), line: L.BY },
    skip: { tables: { orders: BY3 }, chips: keys('keys seen: "Ana", "Ben"'), line: L.BY, output: out(['1,2'], ['ok']) },
  }),

  'class-claim': spec([ITEMS], {
    compare: { tables: { items: [el('i', 0), el('i', 1, { mark: 'equal: Name' })] }, line: L.ITEM_D },
    print: { tables: { items: [el('i', 0, { mark: 'kept' }), el('i', 1, { mark: 'dropped' })] }, line: L.ITEM_D, output: out(['1,2', '1', '1']) },
  }),
  'class-reality': spec([ITEMS], {
    reference: { tables: { items: [el('i', 0), el('i', 1, { kind: 'read', mark: 'other object' })] }, chips: [{ key: 'ref', label: 'Item: class, reference equality' }], line: 11 },
    count: { tables: { items: ITEM2 }, chips: [{ key: 'ref', label: 'Item: class, reference equality' }], line: L.ITEM_D, output: out(['1,2', '1', '2'], [undefined, undefined, 'ok']) },
  }),

  'record-claim': spec([TAGS], {
    compare: { tables: { tags: [el('t', 0), el('t', 1, { mark: 'other object' })] }, line: L.TAG_D },
    print: { tables: { tags: [el('t', 0, { mark: 'kept' }), el('t', 1, { mark: 'kept' })] }, line: L.TAG_D, output: out(['1,2', '2', '2']) },
  }),
  'record-reality': spec([TAGS], {
    equals: { tables: { tags: [el('t', 0), el('t', 1, { kind: 'read', mark: 'equal' })] }, chips: [{ key: 'eq', label: 'Tag: record, value equality' }], line: 10 },
    count: { tables: { tags: TAG2 }, chips: [{ key: 'eq', label: 'Tag: record, value equality' }], line: L.TAG_D, output: out(['1,2', '1'], [undefined, 'ok']) },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <TableStage spec={s} {...p} />]),
)
export default drawing
