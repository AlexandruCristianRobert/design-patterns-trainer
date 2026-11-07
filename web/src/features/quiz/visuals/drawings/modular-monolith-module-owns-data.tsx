import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const JOIN_CODE = [
  '// Shipping module, ShippingDbContext',
  'modelBuilder.Entity<Invoice>()',
  '    .ToTable("invoices", "billing");',
  '',
  'from s in db.Shipments',
  'join i in db.Invoices on s.OrderId equals i.OrderId',
  'select new { s.Id, i.Amount };',
]
const J = { MAP: [1, 2] as [number, number], QUERY: [4, 6] as [number, number] }
const CONTRACT_CODE = [
  '// Billing module: its public contract',
  'public interface IBillingApi',
  '{',
  '    Task<InvoiceDto> GetInvoiceAsync(Guid orderId);',
  '}',
  '',
  '// Shipping module',
  'var invoice = await billing.GetInvoiceAsync(s.OrderId);',
]
const K = { API: [1, 4] as [number, number], CALL: 7 }
const SHARED_CODE = [
  '// one AppDbContext for every module',
  'public DbSet<Shipment> Shipments => Set<Shipment>();',
  'public DbSet<Invoice> Invoices => Set<Invoice>();',
  '',
  '// Shipping module',
  'select new { s.Id, i.Amount };',
]
const S = { SETS: [1, 2] as [number, number], SELECT: 5 }
const TEST_CODE = [
  '[Fact] // runs before each deployment',
  'public Task Shipping_query_runs_on_billing_schema()',
  '    => shipping.LoadDueShipmentsAsync();',
]

const SHIPPING: Region = { id: 'ship', name: 'Shipping', sub: 'module', tone: 'ui' }
const BILLING: Region = { id: 'bill', name: 'Billing', sub: 'module', tone: 'pool' }
const SHARED: Region = { id: 'shared', name: 'Shared model', sub: 'one context', tone: 'io' }
const MERGED: Region = { id: 'merged', name: 'Billing + Shipping', sub: 'one module', tone: 'pool' }
const OTHERS: Region = { id: 'others', name: 'Other modules', tone: 'ui' }

/** billing.invoices; `col` is the amount column's current name. */
const invoices = (col: 'amount' | 'total', kind?: Box['kind'], region = 'bill', colKind?: Field['kind']): Box => ({
  id: 'inv',
  region,
  title: 'billing.invoices',
  sub: 'table',
  kind,
  fields: [
    { name: 'order_id', value: 'uuid' },
    { name: col, value: 'numeric', kind: colKind },
  ],
})
const shipments = (region = 'ship'): Box => ({ id: 'shp', region, title: 'shipping.shipments', sub: 'table', fields: [{ name: 'order_id', value: 'uuid' }] })
const shipCtx = (invoicesField: Field | null, kind?: Box['kind']): Box => ({
  id: 'shipCtx',
  region: 'ship',
  title: 'ShippingDbContext',
  kind,
  fields: [{ name: 'Shipments', ref: 'shp', value: 'table' }, ...(invoicesField ? [invoicesField] : [])],
})
const MAPS_INVOICES: Field = { name: 'Invoices', ref: 'inv', value: 'amount' }
const billCtx = (col: 'amount' | 'total', kind?: Field['kind']): Box => ({
  id: 'billCtx',
  region: 'bill',
  title: 'BillingDbContext',
  fields: [{ name: 'Invoices', ref: 'inv', value: col, kind }],
})

const prod = (shipping: string, kind?: OutLine['kind'], billing?: string, billingKind?: OutLine['kind']): OutLine[] => [
  { label: 'Shipping', text: shipping, kind },
  ...(billing === undefined ? [] : [{ label: 'Billing', text: billing, kind: billingKind }]),
]
const graph = (regions: Region[], code: string[] | undefined, steps: Record<string, GraphStep>, outputName = 'Production'): GraphSpec => ({
  regions,
  code,
  outputName,
  steps,
})

// Shipping reads Billing's table directly.
const JOINED: GraphStep = { boxes: [shipCtx(MAPS_INVOICES), shipments(), billCtx('amount'), invoices('amount')], line: J.MAP, output: prod('query works') }
const BROKEN: GraphStep = {
  boxes: [shipCtx({ ...MAPS_INVOICES, kind: 'bad' }, 'bad'), shipments(), billCtx('total'), invoices('total', 'plain', 'bill', 'bad')],
  line: J.QUERY,
  bad: true,
  output: prod('fails: no column amount', 'bad'),
}

// The fix: Billing's tables are private, Shipping uses the contract.
const api = (kind?: Box['kind']): Box => ({ id: 'api', region: 'bill', title: 'IBillingApi', sub: 'public contract', kind, fields: [{ name: 'GetInvoiceAsync', value: 'InvoiceDto' }] })
const shipSvc = (kind?: Field['kind']): Box => ({ id: 'svc', region: 'ship', title: 'Shipping code', fields: [{ name: 'billing', ref: 'api', value: 'contract', kind }] })

// One shared model.
const appCtx = (col: 'Amount' | 'Total', kind?: Box['kind']): Box => ({
  id: 'app',
  region: 'shared',
  title: 'AppDbContext',
  sub: 'every table',
  kind,
  fields: [
    { name: 'Shipments', value: 'Shipment' },
    { name: 'Invoices', value: col === 'Amount' ? 'Invoice.Amount' : 'Invoice.Total', kind: col === 'Total' ? 'ok' : undefined },
  ],
})
const moduleCode = (id: 'shipCode' | 'billCode', field: Field, kind?: Box['kind']): Box => ({
  id,
  region: id === 'shipCode' ? 'ship' : 'bill',
  title: id === 'shipCode' ? 'Shipping query' : 'Billing code',
  kind,
  fields: [field],
})
const SHARED_REGIONS = [SHIPPING, SHARED, BILLING]
const usesApp = (kind?: Field['kind'], value = 'model'): Field => ({ name: 'uses', ref: 'app', value, kind })

// Pre-deployment tests.
const suite = (result: string, kind?: Field['kind'], boxKind?: Box['kind']): Box => ({
  id: 'tests',
  region: 'ship',
  title: 'Integration tests',
  sub: 'before each deploy',
  kind: boxKind,
  fields: [
    { name: 'runs', ref: 'shipCtx', value: 'its query' },
    { name: 'result', value: result, kind },
  ],
})

// Merged module.
const merged = (title: string, fields: Field[]): Box => ({ id: 'mctx', region: 'merged', title, fields })
const MERGED_CTX = merged('One DbContext', [
  { name: 'Shipments', ref: 'shp', value: 'table' },
  { name: 'Invoices', ref: 'inv', value: 'table' },
])
const other = (name: string, kind?: Field['kind']): Box => ({ id: name, region: 'others', title: name, fields: [{ name: 'needs', ref: 'inv', value: 'invoices', kind }] })

const SPECS: Record<string, GraphSpec> = {
  setup: graph([SHIPPING, BILLING], JOIN_CODE, {
    joins: { ...JOINED, boxes: [shipCtx(MAPS_INVOICES), shipments(), { ...billCtx('amount'), still: true }, invoices('amount')], line: { each: [J.MAP, J.QUERY] } },
    rename: BROKEN,
    question: { ...BROKEN, output: [...prod('fails: no column amount', 'bad'), { label: 'Change', text: '?', kind: 'muted' }] },
  }),

  own: graph([SHIPPING, BILLING], CONTRACT_CODE, {
    private: { boxes: [shipCtx(null, 'ok'), shipments(), billCtx('amount', 'ok'), invoices('amount')], line: null, output: prod('maps only its own tables', 'ok') },
    contract: {
      boxes: [shipCtx(null), shipments(), shipSvc('ok'), api('ok'), billCtx('amount'), invoices('amount')],
      line: { each: [K.API, K.CALL] },
      output: prod('asks IBillingApi', 'ok'),
    },
    rename: {
      boxes: [shipCtx(null), shipments(), shipSvc(), api(), billCtx('total', 'ok'), invoices('total', 'plain', 'bill', 'ok')],
      line: K.CALL,
      output: prod('keeps working', 'ok', 'deploys the rename alone', 'ok'),
    },
  }),

  'shared-claim': graph(SHARED_REGIONS, SHARED_CODE, {
    shared: { boxes: [moduleCode('shipCode', usesApp()), appCtx('Amount', 'ok'), moduleCode('billCode', usesApp())], line: S.SETS, output: prod('query works') },
    rename: {
      boxes: [moduleCode('shipCode', usesApp('bad', 'i.Amount'), 'bad'), appCtx('Total'), moduleCode('billCode', usesApp())],
      line: S.SELECT,
      bad: true,
      output: prod('compile error, never deployed', 'ok'),
    },
  }, 'Build'),
  'shared-reality': graph(SHARED_REGIONS, SHARED_CODE, {
    shared: { boxes: [moduleCode('shipCode', usesApp()), appCtx('Amount', 'ok'), moduleCode('billCode', usesApp())], line: S.SETS, output: prod('query works') },
    rename: {
      boxes: [moduleCode('shipCode', usesApp('bad', 'i.Amount'), 'bad'), appCtx('Total'), moduleCode('billCode', usesApp())],
      line: S.SELECT,
      bad: true,
      output: prod('compile error: must change too', 'bad', 'rename waits for Shipping', 'bad'),
    },
  }, 'Build'),

  'tests-claim': graph([SHIPPING, BILLING], TEST_CODE, {
    tests: { boxes: [shipCtx(MAPS_INVOICES), shipments(), suite('green'), billCtx('amount'), invoices('amount')], line: [0, 2], output: prod('query works') },
    rename: {
      boxes: [shipCtx({ ...MAPS_INVOICES, kind: 'bad' }), shipments(), suite('red: no column amount', 'bad', 'ok'), billCtx('total'), invoices('total', 'plain', 'bill', 'bad')],
      line: [0, 2],
      output: prod('break caught before production', 'ok'),
    },
  }),
  'tests-reality': graph([SHIPPING, BILLING], TEST_CODE, {
    tests: { boxes: [shipCtx(MAPS_INVOICES), shipments(), suite('green'), billCtx('amount'), invoices('amount')], line: [0, 2], output: prod('query works') },
    rename: {
      boxes: [shipCtx({ ...MAPS_INVOICES, kind: 'bad' }, 'bad'), shipments(), suite('red: no column amount', 'bad'), billCtx('total'), invoices('total', 'plain', 'bill', 'bad')],
      line: [0, 2],
      bad: true,
      output: prod('must change its query first', 'bad', 'rename blocked until then', 'bad'),
    },
  }),

  'merge-claim': graph([MERGED], undefined, {
    merge: { boxes: [MERGED_CTX, shipments('merged'), invoices('amount', 'plain', 'merged')], output: [{ label: 'Join', text: 'inside one module', kind: 'ok' }] },
    next: { boxes: [{ ...MERGED_CTX, kind: 'ok' }, shipments('merged'), invoices('amount', 'plain', 'merged')], output: [{ label: 'Boundary', text: 'fixed', kind: 'ok' }] },
  }, 'Result'),
  'merge-reality': graph([MERGED, OTHERS], undefined, {
    merge: { boxes: [MERGED_CTX, shipments('merged'), invoices('amount', 'plain', 'merged')], output: [{ label: 'Join', text: 'inside one module' }] },
    next: {
      boxes: [other('Customers', 'bad'), other('Orders', 'bad'), MERGED_CTX, shipments('merged'), invoices('amount', 'bad', 'merged')],
      output: [{ label: 'Join', text: 'inside one module' }, { label: 'Next', text: 'merge Customers and Orders too?', kind: 'bad' }],
    },
  }, 'Result'),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
