import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const LIST_CODE = [
  'var orders = await _orders.ListAsync(); // IOrderRepository',
  'return orders',
  '    .Select(o => new OrderSummaryDto(o.Number, o.Customer.Name, o.Status, o.Total))',
  '    .ToList();',
]
const L = { LOAD: 0, MAP: [1, 3] as [number, number], CUSTOMER: 2 }
const PROJ_CODE = [
  'return await db.Orders',
  '    .Select(o => new OrderSummaryDto(o.Number, o.Customer.Name, o.Status, o.Total))',
  '    .ToListAsync();',
]
const CMD_CODE = ['var order = await _orders.GetAsync(id);', 'order.Cancel(); // checks: not shipped yet', 'await _orders.SaveAsync(order);']
const LAZY_CODE = ['// options: …UseLazyLoadingProxies()', ...LIST_CODE]
const LZ = { LOAD: 1, CUSTOMER: 3 }
const SUM_CODE = [
  'var orders = await _orders.GetSummaries(); // no child collections',
  'return orders',
  '    .Select(o => new OrderSummaryDto(o.Number, o.Customer.Name, o.Status, o.Total))',
  '    .ToList();',
  '',
  '// later, elsewhere, with one of those orders:',
  'if (order.Lines.Count == 0) …',
]
const SM = { LOAD: 0, MAP: [1, 3] as [number, number], LATER: [5, 6] as [number, number] }

const HANDLER: Region = { id: 'h', name: 'Query handler', sub: 'order list page', tone: 'ui' }
const CMD: Region = { id: 'h', name: 'Command handler', sub: 'cancel order', tone: 'ui' }
const MEM: Region = { id: 'mem', name: 'Loaded into memory', sub: 'for each order', tone: 'pool' }
const DB: Region = { id: 'db', name: 'Database', tone: 'io' }
const OUT: Region = { id: 'out', name: 'Returned to the page', tone: 'muted' }
const CACHE: Region = { id: 'mem', name: 'Repository cache', sub: 'in memory', tone: 'pool' }

const f = (name: string, value: string, kind?: Field['kind'], ref?: string): Field => ({ name, value, kind, ref })

// ---- Boxes ----
const handler = (title: string, fields: Field[], kind?: Box['kind']): Box => ({ id: 'handler', region: 'h', title, fields, kind })
const listHandler = (fields: Field[]) => handler('GetOrderListHandler', fields)
const viaRepo = f('via', 'IOrderRepository')
const order = (fields: Field[], kind?: Box['kind'], title = 'Order'): Box => ({ id: 'order', region: 'mem', title, sub: 'aggregate', fields, kind })
const scalars = [f('Number', 'A-1042'), f('Status', 'Placed'), f('Total', '120.00')]
const fullOrder = (kind?: Box['kind']) =>
  order([...scalars, f('Customer', 'loaded', undefined, 'customer'), f('Lines', '12 loaded', undefined, 'lines'), f('Payments', '2 loaded', undefined, 'payments')], kind)
const customer = (kind?: Box['kind']): Box => ({ id: 'customer', region: 'mem', title: 'Customer', fields: [f('Name', 'Ana'), f('Email, Address, …', '…')], kind })
const lines: Box = { id: 'lines', region: 'mem', title: 'OrderLine × 12', sub: 'with products' }
const payments: Box = { id: 'payments', region: 'mem', title: 'Payment × 2' }
const fullGraph = (kind?: Box['kind']) => [fullOrder(kind), customer(), lines, payments]
const dto = (kind?: Box['kind']): Box => ({
  id: 'dto',
  region: 'out',
  title: 'OrderSummaryDto',
  sub: 'four fields',
  kind,
  fields: [f('Number', 'A-1042'), f('CustomerName', 'Ana'), f('Status', 'Placed'), f('Total', '120.00')],
})

const per = (read: string, kind: OutLine['kind'] = 'plain', returned = '4 fields'): OutLine[] => [
  { label: 'Read', text: read, kind },
  { label: 'Returned', text: returned, kind: returned === '?' ? 'muted' : 'plain' },
]
const FULL = 'Order + Customer + 12 lines + 2 payments'
/** The handler's "maps to" link is drawn from the Order to the DTO next to it, so the arrow does not cross the Order box. */
const mapFromOrder = (step: GraphStep): GraphStep => {
  if (!step.boxes.some((b) => b.id === 'dto') || !step.boxes.some((b) => b.id === 'order')) return step
  return {
    ...step,
    boxes: step.boxes.map((b) =>
      b.id === 'handler'
        ? { ...b, fields: b.fields?.filter((x) => x.name !== 'maps to') }
        : b.id === 'order'
          ? { ...b, fields: [f('mapped to', 'DTO', undefined, 'dto'), ...(b.fields ?? [])] }
          : b,
    ),
  }
}
const graph = (regions: Region[], code: string[] | null, steps: Record<string, GraphStep>, outputName = 'Per order'): GraphSpec => ({
  regions,
  code: code ?? undefined,
  outputName,
  steps: Object.fromEntries(Object.entries(steps).map(([id, st]) => [id, mapFromOrder(st)])),
})

// ---- Setup ----
const S = {
  handler: { boxes: [listHandler([viaRepo])], line: L.LOAD, output: per('?', 'muted', '?') },
  load: { boxes: [listHandler([viaRepo, f('loads', 'Order', undefined, 'order')]), ...fullGraph()], line: L.LOAD, output: per(FULL, 'plain', '?') },
  map: {
    boxes: [listHandler([viaRepo, f('loads', 'Order', undefined, 'order'), f('maps to', 'DTO', undefined, 'dto')]), ...fullGraph(), dto()],
    line: L.MAP,
    output: per(FULL),
  },
} satisfies Record<string, GraphStep>

// ---- Query side ----
const projHandler = (fields: Field[] = []) => listHandler([f('projects', 'Select(…)', 'ok', 'tables'), ...fields])
const tables = (kind?: Box['kind'], toDto = false): Box => ({
  id: 'tables',
  region: 'db',
  title: 'Orders ⋈ Customers',
  sub: 'four columns',
  kind,
  fields: [f('Number', '✓', 'ok'), f('Customers.Name', '✓', 'ok'), f('Status', '✓', 'ok'), f('Total', '✓', 'ok'), ...(toDto ? [f('rows', 'as DTOs', 'ok', 'dto')] : [])],
})
const unread: Box = { id: 'unread', region: 'db', title: 'OrderLines, Payments', sub: 'not read', kind: 'muted' }

// ---- Command side ----
const cmdHandler = (fields: Field[]) => handler('CancelOrderHandler', [viaRepo, ...fields])
const cmdOrder = (status: string, kind?: Field['kind'], extra: Field[] = []) =>
  order([f('Number', 'A-1042'), f('Status', status, kind), f('Lines', '12 loaded'), ...extra])
const ordersRow = (status: string, kind?: Box['kind']): Box => ({ id: 'row', region: 'db', title: 'Orders row', fields: [f('Status', status)], kind })

const SPECS: Record<string, GraphSpec> = {
  setup: graph([HANDLER, MEM, OUT], LIST_CODE, S),

  'query-side': graph([HANDLER, DB, OUT], PROJ_CODE, {
    select: { boxes: [projHandler(), tables()], line: 0, output: per('?', 'muted', '?') },
    columns: { boxes: [projHandler(), tables('ok'), unread], line: 1, output: per('4 columns', 'ok', '?') },
    dto: { boxes: [projHandler(), tables(undefined, true), unread, dto('ok')], line: [0, 2], output: per('4 columns', 'ok') },
  }),
  'command-side': graph([CMD, MEM, DB], CMD_CODE, {
    load: { boxes: [cmdHandler([f('loads', 'Order', undefined, 'order')]), cmdOrder('Placed'), ordersRow('Placed')], line: 0, output: [{ label: 'Model', text: 'aggregate via the repository' }] },
    change: {
      boxes: [cmdHandler([f('loads', 'Order', undefined, 'order')]), cmdOrder('Cancelled', 'ok', [f('check', 'not shipped ✓', 'ok')]), ordersRow('Placed')],
      line: 1,
      output: [{ label: 'Model', text: 'invariant checked by the aggregate', kind: 'ok' }],
    },
    save: {
      boxes: [cmdHandler([f('loads', 'Order', undefined, 'order')]), cmdOrder('Cancelled', undefined, [f('check', 'not shipped ✓')]), ordersRow('Cancelled', 'ok')],
      line: 2,
      output: [{ label: 'Model', text: 'saved through the repository', kind: 'ok' }],
    },
  }, 'Result'),
  'cache-claim': graph([HANDLER, CACHE, DB], LIST_CODE, {
    first: {
      boxes: [
        listHandler([viaRepo, f('gets', 'orders', undefined, 'cached')]),
        { id: 'cached', region: 'mem', title: 'Cached Orders', sub: 'full aggregates', fields: [f('filled from', 'database', undefined, 'db')] },
        { id: 'db', region: 'db', title: 'Orders + includes', sub: 'queried once' },
      ],
      line: L.LOAD,
      output: [{ label: 'Database', text: 'queried for the first request' }],
    },
    later: {
      boxes: [
        listHandler([viaRepo, f('gets', 'orders', undefined, 'cached')]),
        { id: 'cached', region: 'mem', title: 'Cached Orders', sub: 'reused', kind: 'ok', fields: [f('filled from', 'database', undefined, 'db')] },
        { id: 'db', region: 'db', title: 'Orders + includes', sub: 'not queried again', kind: 'muted' },
      ],
      line: L.LOAD,
      output: [{ label: 'Database', text: 'not queried for later requests' }],
    },
  }, 'Result'),
  'cache-reality': graph([HANDLER, CACHE, DB], LIST_CODE, {
    miss: {
      boxes: [
        listHandler([viaRepo, f('gets', 'orders', undefined, 'cached')]),
        { id: 'cached', region: 'mem', title: 'Cached Orders', sub: 'miss', kind: 'bad', fields: [f('filled from', 'database', 'bad', 'db')] },
        { id: 'db', region: 'db', title: 'Orders + includes', sub: 'full aggregates loaded', kind: 'bad' },
      ],
      line: L.LOAD,
      output: per(FULL, 'bad'),
    },
    hit: {
      boxes: [
        listHandler([viaRepo, f('gets', 'orders', undefined, 'cached'), f('maps', 'whole aggregates', 'bad')]),
        { id: 'cached', region: 'mem', title: 'Cached Orders', sub: 'hit', fields: [f('A-1042', 'Placed')] },
        { id: 'db', region: 'db', title: 'Orders + includes', sub: 'not queried', kind: 'muted' },
      ],
      line: L.MAP,
      output: per('cached ' + FULL),
    },
    stale: {
      boxes: [
        listHandler([viaRepo, f('gets', 'orders', undefined, 'cached'), f('maps', 'whole aggregates')]),
        { id: 'cached', region: 'mem', title: 'Cached Orders', sub: 'stale', kind: 'bad', fields: [f('A-1042', 'Placed', 'bad')] },
        { id: 'db', region: 'db', title: 'Orders + includes', sub: 'order changed', fields: [f('A-1042', 'Shipped', 'ok')] },
      ],
      line: L.LOAD,
      output: [{ label: 'Page shows', text: 'Placed, really Shipped', kind: 'bad' }],
    },
  }, 'Result'),
  'lazy-claim': graph([HANDLER, MEM, OUT], LAZY_CODE, {
    load: {
      boxes: [listHandler([viaRepo, f('loads', 'Order', undefined, 'order')]), order([...scalars, f('Customer', 'not loaded', 'muted'), f('Lines', 'not loaded', 'muted'), f('Payments', 'not loaded', 'muted')])],
      line: LZ.LOAD,
      output: per('Order only', 'plain', '?'),
    },
    map: {
      boxes: [
        listHandler([viaRepo, f('loads', 'Order', undefined, 'order'), f('maps to', 'DTO', undefined, 'dto')]),
        order([...scalars, f('Customer', 'on read', undefined, 'customer'), f('Lines', 'not loaded', 'muted'), f('Payments', 'not loaded', 'muted')]),
        customer(),
        dto(),
      ],
      line: LZ.CUSTOMER,
      output: per('Order + what the mapping reads'),
    },
  }),
  'lazy-reality': graph([HANDLER, MEM, OUT], LAZY_CODE, {
    load: {
      boxes: [listHandler([viaRepo, f('loads', 'Order', undefined, 'order')]), order([...scalars, f('Customer', 'not loaded', 'muted'), f('Lines', 'not loaded', 'muted'), f('Payments', 'not loaded', 'muted')], 'bad', 'Order (full entity)')],
      line: LZ.LOAD,
      output: [{ label: 'Queries', text: '1' }],
    },
    map: {
      boxes: [
        listHandler([viaRepo, f('loads', 'Order', undefined, 'order'), f('maps to', 'DTO', undefined, 'dto')]),
        order([...scalars, f('Customer', 'one more query', 'bad', 'customer'), f('Lines', 'not loaded', 'muted'), f('Payments', 'not loaded', 'muted')], undefined, 'Order (full entity)'),
        customer('bad'),
        dto(),
      ],
      line: LZ.CUSTOMER,
      output: [{ label: 'Queries', text: '1 + 1 for this order', kind: 'bad' }],
    },
    total: {
      boxes: [
        listHandler([viaRepo, f('loads', 'Order', undefined, 'order'), f('maps to', 'DTO', undefined, 'dto')]),
        order([...scalars, f('Customer', 'one more query', 'bad', 'customer'), f('Lines', 'not loaded', 'muted'), f('Payments', 'not loaded', 'muted')], 'bad', 'Order (full entity)'),
        customer(),
        dto(),
      ],
      line: [LZ.LOAD, LZ.CUSTOMER],
      output: [{ label: 'Queries', text: '1 + N (one per order)', kind: 'bad' }],
    },
  }),

  'summaries-claim': graph([HANDLER, MEM, OUT], SUM_CODE, {
    method: {
      boxes: [
        listHandler([f('via', 'GetSummaries()'), f('loads', 'Order', undefined, 'order')]),
        order([...scalars, f('Customer', 'loaded', undefined, 'customer'), f('Lines', 'not loaded', 'muted'), f('Payments', 'not loaded', 'muted')]),
        customer(),
      ],
      line: SM.LOAD,
      output: per('Order + Customer, no collections', 'plain', '?'),
    },
    map: {
      boxes: [
        listHandler([f('via', 'GetSummaries()'), f('loads', 'Order', undefined, 'order'), f('maps to', 'DTO', undefined, 'dto')]),
        order([...scalars, f('Customer', 'loaded', undefined, 'customer'), f('Lines', 'not loaded', 'muted'), f('Payments', 'not loaded', 'muted')]),
        customer(),
        dto(),
      ],
      line: SM.MAP,
      output: per('Order + Customer, no collections'),
    },
  }),
  'summaries-reality': graph([HANDLER, MEM, OUT], SUM_CODE, {
    method: {
      boxes: [
        listHandler([f('via', 'GetSummaries()'), f('loads', 'Order', undefined, 'order')]),
        order([...scalars, f('Customer', 'loaded', undefined, 'customer'), f('Lines', 'looks empty', 'bad'), f('Payments', 'looks empty', 'bad')], 'bad'),
        customer(),
      ],
      line: SM.LOAD,
      output: per('Order + Customer, no collections', 'plain', '?'),
    },
    trap: {
      boxes: [
        listHandler([f('via', 'GetSummaries()'), f('loads', 'Order', undefined, 'order')]),
        order([...scalars, f('Customer', 'loaded', undefined, 'customer'), f('Lines', 'looks empty', 'bad'), f('Payments', 'looks empty', 'bad')]),
        customer(),
        { id: 'later', region: 'out', title: 'Later code', sub: 'trusts the aggregate', kind: 'bad', fields: [f('Lines.Count', '0, really 12', 'bad'), f('Total vs lines', '120.00 vs 0', 'bad')] },
      ],
      line: SM.LATER,
      bad: true,
      output: [{ label: 'Later code', text: 'sees an order with no lines', kind: 'bad' }],
    },
    still: {
      boxes: [
        listHandler([f('via', 'GetSummaries()'), f('loads', 'Order', undefined, 'order'), f('maps to', 'DTO', undefined, 'dto')]),
        order([...scalars, f('Customer', 'loaded', undefined, 'customer'), f('Lines', 'looks empty'), f('Payments', 'looks empty')], 'bad', 'Order (entity)'),
        customer('bad'),
        dto(),
      ],
      line: SM.MAP,
      output: per('entities, not just 4 columns', 'bad'),
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
