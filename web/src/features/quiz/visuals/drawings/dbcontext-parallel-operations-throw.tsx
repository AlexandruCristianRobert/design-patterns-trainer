import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'var ordersTask = db.Orders.Where(o => o.CustomerId == id).ToListAsync();',
  'var invoicesTask = db.Invoices.Where(i => i.CustomerId == id).ToListAsync();',
  'await Task.WhenAll(ordersTask, invoicesTask);',
]
const MARS_CODE = ['// connection string: …;MultipleActiveResultSets=True', '', ...CODE]
const FACTORY_CODE = [
  'await using var db1 = await factory.CreateDbContextAsync();',
  'await using var db2 = await factory.CreateDbContextAsync();',
  '',
  'var ordersTask = db1.Orders.Where(o => o.CustomerId == id).ToListAsync();',
  'var invoicesTask = db2.Invoices.Where(i => i.CustomerId == id).ToListAsync();',
  'await Task.WhenAll(ordersTask, invoicesTask);',
]
const L = { ORDERS: 0, INVOICES: 1, WHENALL: 2 }

const A = {
  page: { id: 'page', name: 'Page', tone: 'ui' },
  ctx: { id: 'ctx', name: 'db', sub: 'DbContext', tone: 'pool' },
  conn: { id: 'conn', name: 'Conn', sub: 'connection', tone: 'io' },
  db: { id: 'db', name: 'Database', tone: 'io' },
} satisfies Record<string, SeqActor>
const SETUP_ACTORS = [A.page, A.ctx, A.db]
const ACTORS = [A.page, A.ctx, A.conn, A.db]
const FACTORY_ACTORS: SeqActor[] = [A.page, { id: 'c1', name: 'db1', sub: 'DbContext', tone: 'pool' }, { id: 'c2', name: 'db2', sub: 'DbContext', tone: 'pool' }, A.db]

const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const spec = (actors: SeqActor[], steps: Record<string, SeqStep>, code = CODE): SeqSpec => ({ actors, code, steps })

const Q1 = row('q1', 'page', 'Orders', 'ctx')
const Q2 = row('q2', 'page', 'Invoices', 'ctx')
const FIRST = [Q1, row('sql1', 'ctx', 'SQL', 'db'), row('busy', 'ctx', 'op 1 in flight')]
const DETECT = [Q2, row('det', 'ctx', 'overlap', undefined, 'bad'), row('ex', 'ctx', 'throws', 'page', 'bad')]

const SPECS: Record<string, SeqSpec> = {
  // ---- Setup: the two starts and the await; nothing about connections, locks or the outcome ----
  setup: spec(SETUP_ACTORS, {
    orders: { rows: [Q1], line: L.ORDERS },
    invoices: { rows: [Q1, Q2], line: L.INVOICES },
    ask: { rows: [Q1, Q2, row('wa', 'page', 'await WhenAll'), row('q', 'ctx', '?', undefined, 'muted')], line: L.WHENALL },
  }),

  detect: spec(ACTORS, {
    first: { rows: FIRST, line: L.ORDERS },
    second: { rows: [...FIRST, ...DETECT], line: L.INVOICES, bad: true },
    whenall: { rows: [...FIRST, ...DETECT, row('wa', 'page', 'WhenAll throws', undefined, 'bad')], line: L.WHENALL, bad: true },
  }),
  factory: spec(
    FACTORY_ACTORS,
    {
      create: { rows: [row('o', 'page', 'Orders', 'c1'), row('i', 'page', 'Invoices', 'c2'), row('s1', 'c1', 'SQL', 'db'), row('s2', 'c2', 'SQL', 'db')], line: [0, 4] },
      done: {
        rows: [
          row('o', 'page', 'Orders', 'c1'),
          row('i', 'page', 'Invoices', 'c2'),
          row('s1', 'c1', 'SQL', 'db'),
          row('s2', 'c2', 'SQL', 'db'),
          row('r1', 'c1', 'orders', 'page', 'ok'),
          row('r2', 'c2', 'invoices', 'page', 'ok'),
        ],
        line: 5,
      },
    },
    FACTORY_CODE,
  ),

  'lock-claim': spec(ACTORS, {
    lock: { rows: [Q1, Q2, row('lock', 'ctx', 'Invoices queued')], line: L.INVOICES },
    serial: {
      rows: [Q1, Q2, row('lock', 'ctx', 'Invoices queued'), row('r1', 'ctx', 'orders', 'page'), row('r2', 'ctx', 'invoices', 'page')],
      line: L.WHENALL,
    },
  }),
  'lock-reality': spec(ACTORS, {
    nolock: { rows: [...FIRST, Q2, row('nolock', 'ctx', 'no lock', undefined, 'bad')], line: L.INVOICES },
    throws: { rows: [...FIRST, Q2, row('nolock', 'ctx', 'no lock', undefined, 'bad'), row('det', 'ctx', 'overlap', undefined, 'bad'), row('ex', 'ctx', 'throws', 'page', 'bad')], line: L.INVOICES, bad: true },
  }),

  'pool-claim': spec(ACTORS, {
    two: { rows: [Q1, Q2, row('c1', 'ctx', 'conn 1', 'conn'), row('c2', 'ctx', 'conn 2', 'conn')], line: [L.ORDERS, L.INVOICES] },
    parallel: { rows: [Q1, Q2, row('c1', 'ctx', 'conn 1', 'conn'), row('c2', 'ctx', 'conn 2', 'conn'), row('par', 'conn', 'two queries', 'db')], line: L.WHENALL },
  }),
  'pool-reality': spec(ACTORS, {
    one: { rows: [Q1, row('c1', 'ctx', 'its one conn', 'conn'), row('sql1', 'conn', 'SQL', 'db')], line: L.ORDERS },
    throws: { rows: [Q1, row('c1', 'ctx', 'its one conn', 'conn'), row('sql1', 'conn', 'SQL', 'db'), ...DETECT], line: L.INVOICES, bad: true },
  }),

  'mars-claim': spec(
    ACTORS,
    {
      mars: { rows: [row('mars', 'conn', 'MARS on')], line: 0 },
      parallel: { rows: [row('mars', 'conn', 'MARS on'), Q1, Q2, row('par', 'ctx', 'both', 'conn'), row('sql', 'conn', 'two queries', 'db')], line: [2, 4] },
    },
    MARS_CODE,
  ),
  'mars-reality': spec(
    ACTORS,
    {
      mars: { rows: [row('mars', 'conn', 'MARS on'), row('sets', 'conn', 'many result sets', undefined, 'ok'), row('ctx', 'ctx', 'not safe', undefined, 'bad')], line: 0 },
      throws: {
        rows: [row('mars', 'conn', 'MARS on'), row('sets', 'conn', 'many result sets', undefined, 'ok'), row('ctx', 'ctx', 'not safe', undefined, 'bad'), Q1, row('sql1', 'ctx', 'SQL', 'conn'), ...DETECT],
        line: 3,
        bad: true,
      },
    },
    MARS_CODE,
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
