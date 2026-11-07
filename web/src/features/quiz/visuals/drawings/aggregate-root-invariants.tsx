import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'class Order // aggregate root',
  '{',
  '    readonly List<OrderLine> _lines = new();',
  '    public void AddLine(ProductId product, int qty) { … }',
  '}',
  '',
  'var order = await orders.GetAsync(7);',
  'order.AddLine(P3, 1);',
  'await orders.SaveAsync(order);',
]
const L = { CLASS: [0, 4] as [number, number], ADD: 3, LOAD: 6, CALL: 7, SAVE: 8 }
/** The D Reality's code: the same, plus the handler that updates the other aggregate in its own transaction. */
const D_CODE = [...CODE, '', 'class StockHandler : INotificationHandler<LineAdded>', '    // loads Product P-3, calls ReduceStock(1), saves: transaction 2']
const D = { HANDLER: [10, 11] as [number, number] }
/** The D claim's code: the product is loaded alongside the order and saved in the same transaction. */
const D_CLAIM_CODE = [
  ...CODE.slice(0, L.LOAD + 1),
  'var p3 = await products.GetAsync(P3); // loaded alongside order',
  ...CODE.slice(L.LOAD + 1),
  'await products.SaveAsync(p3); // same transaction',
]
const DC = { CALL: L.CALL + 1, SAVE: [L.SAVE + 1, L.SAVE + 2] as [number, number] }

const OUT: Region = { id: 'out', name: 'Outside code', sub: 'application layer', tone: 'muted' }
const AGG: Region = { id: 'agg', name: 'Order aggregate', sub: 'one consistency boundary', tone: 'pool' }
/** The Setup's name for the same region: no word about what the boundary is for. */
const AGG_SETUP: Region = { ...AGG, sub: 'the root and its entities' }
const PROD: Region = { id: 'prod', name: 'Product aggregate', sub: 'another aggregate', tone: 'io' }
const DB: Region = { id: 'db', name: 'Database', sub: 'how it is stored', tone: 'muted' }

// ---- Boxes ----
const order = (fields: Field[] = [], kind?: Box['kind']): Box => ({ id: 'order', region: 'agg', title: 'Order 7', sub: 'aggregate root', kind, fields })
const line = (n: number, qty: number, price: number, kind?: Box['kind'], priceKind?: Field['kind']): Box => ({
  id: `line-${n}`,
  region: 'agg',
  title: `OrderLine #${n}`,
  sub: 'entity',
  kind,
  fields: [{ name: 'qty × price', value: `${qty} × ${price}`, kind: priceKind }],
})
const lines = [line(1, 2, 100), line(2, 1, 260)]
const product = (fields: Field[] = []): Box => ({ id: 'product', region: 'prod', title: 'Product P-3', sub: 'Keyboard', fields: [{ name: 'price', value: '30' }, ...fields] })
const handler = (fields: Field[] = [], title = 'CheckoutHandler'): Box => ({ id: 'handler', region: 'out', title, fields })

const total = (v: string, kind?: Field['kind']): Field => ({ name: 'total', value: v, kind })
const rule: Field = { name: 'invariant', value: 'total ≤ 500' }
const check = (text: string, kind: OutLine['kind'] = 'plain'): OutLine[] => [{ label: 'Root check', text, kind }]

// ---- Reality: outside code, the aggregate, another aggregate ----
/** null: the stage has no code panel. */
const three = (steps: Record<string, GraphStep>, outputName = 'Invariant', code: string[] | null = CODE): GraphSpec => ({ regions: [OUT, AGG, PROD], code: code ?? undefined, outputName, steps })
const holdsRoot: Field = { name: 'order', value: 'Order 7', ref: 'order' }
const noLines: Field = { name: 'OrderLine refs', value: 'none', kind: 'muted' }

const R = {
  refs: { boxes: [handler([holdsRoot, noLines]), order([total('460'), rule]), ...lines, product()], line: L.LOAD },
  add: {
    boxes: [handler([holdsRoot, { name: 'calls', value: 'AddLine(P-3, 1)' }]), order([total('490'), rule]), ...lines, line(3, 1, 30), product()],
    line: L.CALL,
    output: check('460 + 30 = 490 ≤ 500: line added', 'ok'),
  },
  reject: {
    boxes: [handler([holdsRoot, { name: 'calls', value: 'AddLine(P-3, 2)', kind: 'bad' }]), order([total('490'), rule], 'bad'), ...lines, line(3, 1, 30), product()],
    line: L.ADD,
    bad: true,
    output: check('490 + 60 = 550 > 500: throws, nothing changed', 'bad'),
  },
  save: {
    boxes: [handler([holdsRoot, { name: 'saves', value: 'orders.SaveAsync(order)' }]), order([total('490', 'ok'), rule], 'ok'), ...lines, line(3, 1, 30), product()],
    line: L.SAVE,
    output: [{ label: 'Saved', text: 'order 7 and lines #1 to #3, one transaction', kind: 'ok' } satisfies OutLine],
  },
} satisfies Record<string, GraphStep>

// ---- The Setup: no rule, no path in, the outcome unknown ----
const setup: GraphSpec = {
  regions: [OUT, AGG_SETUP, PROD],
  steps: {
    order: { boxes: [order([total('460')]), ...lines] },
    others: { boxes: [handler(), order([total('460')]), ...lines, product()] },
    change: { boxes: [handler([{ name: 'needs', value: 'add P-3 to order 7' }, { name: 'how', value: '?', kind: 'muted' }]), order([total('460')]), ...lines, product()] },
  },
}

// ---- Claim B: storage ----
const two = (regions: Region[], steps: Record<string, GraphStep>): GraphSpec => ({ regions, steps })
const aggOnly = { boxes: [order([total('460')]), ...lines] }

// ---- Claim C: a reference into the aggregate ----
const reachIn = (price: number, changed = false): Box[] => [
  order([{ name: 'lines', value: '#1, #2' }]),
  line(1, 2, 100),
  line(2, 1, price),
  product([{ name: 'line', value: 'OrderLine #2', ref: 'line-2' }, ...(changed ? [{ name: 'loads Order 7', value: 'no' }] : [])]),
]

// ---- Claim D: transactions ----
const stock = (v: string, kind?: Field['kind']): Field => ({ name: 'stock', value: v, kind })

const SPECS: Record<string, GraphSpec> = {
  setup,
  'through-root': three({ refs: R.refs, add: R.add, reject: R.reject, save: R.save }),

  'one-table-claim': two([AGG, DB], {
    aggregate: aggOnly,
    table: {
      boxes: [
        ...aggOnly.boxes,
        {
          id: 'orders',
          region: 'db',
          title: 'Orders table',
          sub: 'one row per order',
          fields: [{ name: 'Id', value: '7' }, { name: 'Line1', value: '2 × 100' }, { name: 'Line2', value: '1 × 260' }],
        },
      ],
    },
  }),
  'one-table-reality': two([AGG, DB], {
    aggregate: aggOnly,
    tables: {
      boxes: [
        ...aggOnly.boxes,
        { id: 'orders', region: 'db', title: 'Orders table', fields: [{ name: 'Id', value: '7' }, { name: 'Total', value: '460' }] },
        { id: 'order-lines', region: 'db', title: 'OrderLines table', fields: [{ name: 'row 1', value: '7: 2 × 100' }, { name: 'row 2', value: '7: 1 × 260' }] },
      ],
    },
    job: {
      boxes: [
        order([total('460'), { name: 'guards', value: 'total ≤ 500', kind: 'ok' }], 'ok'),
        ...lines,
        { id: 'orders', region: 'db', title: 'Orders table', fields: [{ name: 'Id', value: '7' }, { name: 'Total', value: '460' }] },
        { id: 'order-lines', region: 'db', title: 'OrderLines table', fields: [{ name: 'row 1', value: '7: 2 × 100' }, { name: 'row 2', value: '7: 1 × 260' }] },
      ],
    },
  }),

  'direct-refs-claim': two([AGG, PROD], {
    ref: { boxes: reachIn(260) },
    change: { boxes: reachIn(360, true) },
  }),
  'direct-refs-reality': three({
    ref: {
      boxes: [
        handler([], 'PriceChangeHandler'),
        order([total('460'), rule]),
        ...lines,
        product([{ name: 'refers to', value: 'order 7 by id', kind: 'ok' }]),
      ],
    },
    change: {
      boxes: [
        handler([{ name: 'order', value: 'Order 7', ref: 'order' }, { name: 'calls', value: 'ChangeLinePrice(#2, 360)' }], 'PriceChangeHandler'),
        order([total('460'), rule]),
        ...lines,
        product([{ name: 'refers to', value: 'order 7 by id', kind: 'ok' }]),
      ],
    },
    check: {
      boxes: [
        handler([{ name: 'order', value: 'Order 7', ref: 'order' }, { name: 'calls', value: 'ChangeLinePrice(#2, 360)', kind: 'bad' }], 'PriceChangeHandler'),
        order([total('460'), rule], 'bad'),
        ...lines,
        product([{ name: 'refers to', value: 'order 7 by id', kind: 'ok' }]),
      ],
      output: check('200 + 360 = 560 > 500: refused', 'bad'),
    },
  }, 'Invariant', null),

  'one-transaction-claim': three({
    add: {
      boxes: [handler([holdsRoot, { name: 'calls', value: 'AddLine(P-3, 1)' }]), order([total('490')]), ...lines, line(3, 1, 30), product([stock('12')])],
      line: DC.CALL,
    },
    both: {
      boxes: [
        handler([holdsRoot, { name: 'calls', value: 'AddLine(P-3, 1)' }]),
        order([total('490'), { name: 'also changes', value: 'P-3 stock', ref: 'product' }]),
        ...lines,
        line(3, 1, 30),
        product([stock('11')]),
      ],
      line: DC.SAVE,
      output: [{ label: 'Transaction 1', text: 'order 7 and product P-3 together' }],
    },
  }, 'Transactions', D_CLAIM_CODE),
  'one-transaction-reality': three({
    add: {
      boxes: [
        handler([holdsRoot, { name: 'calls', value: 'AddLine(P-3, 1)' }]),
        order([total('490'), { name: 'raises', value: 'LineAdded', kind: 'ok' }]),
        ...lines,
        line(3, 1, 30),
        product([stock('12')]),
      ],
      line: L.SAVE,
      output: [{ label: 'Transaction 1', text: 'order 7 only', kind: 'ok' }],
    },
    event: {
      boxes: [
        handler([{ name: 'handles', value: 'LineAdded' }, { name: 'changes', value: 'P-3 stock' }], 'StockHandler'),
        order([total('490'), { name: 'raises', value: 'LineAdded', kind: 'ok' }]),
        ...lines,
        line(3, 1, 30),
        product([stock('11', 'ok')]),
      ],
      line: D.HANDLER,
      output: [
        { label: 'Transaction 1', text: 'order 7 only', kind: 'ok' },
        { label: 'Transaction 2', text: 'product P-3 only', kind: 'ok' },
      ],
    },
  }, 'Transactions', D_CODE),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, spec]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={spec} {...p} />]),
)
export default drawing
