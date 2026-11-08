import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const NAIVE_CODE = [
  '// in the Order type',
  'public async Task<Customer> GetCustomerAsync(',
  '    [Parent] Order order, AppDbContext db)',
  '    => await db.Customers.SingleAsync(c => c.Id == order.CustomerId);',
]
const LOADER_CODE = [
  'public class CustomerByIdDataLoader : BatchDataLoader<int, Customer>',
  '{',
  '    // constructor: IBatchScheduler, DataLoaderOptions, IDbContextFactory<AppDbContext>',
  '    protected override async Task<IReadOnlyDictionary<int, Customer>> LoadBatchAsync(',
  '        IReadOnlyList<int> ids, CancellationToken ct)',
  '    {',
  '        await using var db = await _factory.CreateDbContextAsync(ct);',
  '        return await db.Customers.Where(c => ids.Contains(c.Id))',
  '                                 .ToDictionaryAsync(c => c.Id, ct);',
  '    }',
  '}',
  '',
  '// in the Order type',
  'public Task<Customer> GetCustomerAsync([Parent] Order order, CustomerByIdDataLoader loader)',
  '    => loader.LoadAsync(order.CustomerId);',
]
const LD = { BATCH: [3, 9] as [number, number], RESOLVE: [12, 14] as [number, number] }

const actors: SeqSpec['actors'] = [
  { id: 'client', name: 'Client', tone: 'ui' },
  { id: 'server', name: 'Hot Chocolate', sub: 'resolvers', tone: 'pool' },
  { id: 'db', name: 'Database', tone: 'io' },
]
const spec = (steps: Record<string, SeqStep>, code?: string[]): SeqSpec => ({ actors, code, outputName: 'Totals', steps })

const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind'], both = false): SeqRow => ({ key, from, to, label, kind, both })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const sql = (key: string, label: string, kind?: SeqRow['kind']): SeqRow => msg(key, 'server', 'db', label, kind, true)
const count = (text: string, kind: OutLine['kind'] = 'plain'): OutLine[] => [{ label: 'Queries', text, kind }]

const QUERY = msg('query', 'client', 'server', 'orders { customer { name } }')
const ORDERS = sql('orders', 'SELECT … FROM Orders')
const ONE = sql('c1', 'SELECT … FROM Customers WHERE Id = 7')
const TWO = sql('c2', '… WHERE Id = 3')
const REST = sql('cmid', '… 97 more, one per order', 'muted')
const LAST = sql('c100', '… WHERE Id = 12')
const PER_ORDER = [ONE, TWO, REST, LAST]
const N1 = [QUERY, ORDERS, ...PER_ORDER]
const N1_COUNT = count('101 = 1 + 100', 'bad')

// ---- DataLoader ----
const LOADS = [note('l1', 'server', 'LoadAsync(7)'), note('l2', 'server', 'LoadAsync(3)'), note('lmid', 'server', '… 100 keys', 'muted')]
const BATCH = sql('batch', 'SELECT … FROM Customers WHERE Id IN (7, 3, …)', 'ok')

// ---- Claims ----
const DEPTH = note('depth', 'server', 'max depth 2')
const HASH = msg('query', 'client', 'server', 'query id: a1b2…')
const SPLIT = [msg('q1', 'client', 'server', 'orders { customerId }', undefined, true), msg('q2', 'client', 'server', 'customers(ids) { id name }', undefined, true)]
const JOIN = note('join', 'client', 'joins on customerId')

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    query: { rows: [QUERY] },
    logs: { rows: N1 },
  }),

  naive: spec(
    {
      orders: { rows: [QUERY, ORDERS, note('rows', 'server', '100 orders')], line: null, output: count('1') },
      'per-field': { rows: [QUERY, ORDERS, note('rows', 'server', '100 orders'), ONE, TWO], line: [1, 3], output: count('3') },
      total: { rows: [QUERY, ORDERS, note('rows', 'server', '100 orders'), ...PER_ORDER], line: [1, 3], output: N1_COUNT },
    },
    NAIVE_CODE,
  ),
  loader: spec(
    {
      orders: { rows: [QUERY, ORDERS], line: null, output: count('1') },
      collect: { rows: [QUERY, ORDERS, ...LOADS], line: LD.RESOLVE, output: count('1') },
      batch: { rows: [QUERY, ORDERS, ...LOADS, BATCH], line: LD.BATCH, output: count('2', 'ok') },
      cache: { rows: [QUERY, ORDERS, ...LOADS, BATCH, note('cache', 'server', 'same id: cached', 'ok')], line: LD.BATCH, output: count('2 = 1 + 1', 'ok') },
    },
    LOADER_CODE,
  ),

  'depth-claim': spec({
    limit: { rows: [DEPTH] },
    resolve: { rows: [DEPTH, QUERY, note('per', 'server', 'customer: not per order')] },
  }),
  'depth-reality': spec({
    limit: { rows: [DEPTH, QUERY, note('check', 'server', 'checks the document only')] },
    resolve: { rows: [DEPTH, QUERY, note('check', 'server', 'within the limit'), ORDERS, ...PER_ORDER], output: N1_COUNT },
  }),

  'persisted-claim': spec({
    hash: { rows: [HASH] },
    plan: { rows: [HASH, note('plan', 'server', 'plan cached')] },
  }),
  'persisted-reality': spec({
    hash: { rows: [HASH, note('plan', 'server', 'no parse, known query', 'ok')] },
    runs: { rows: [HASH, note('plan', 'server', 'no parse, known query', 'ok'), ORDERS, ...PER_ORDER], output: N1_COUNT },
  }),

  'split-claim': spec({
    split: { rows: SPLIT },
    join: { rows: [...SPLIT, JOIN] },
  }),
  'split-reality': spec({
    trips: { rows: [SPLIT[0], note('wait', 'client', 'ids, then call 2', 'bad'), SPLIT[1]], output: [{ label: 'HTTP round trips', text: '2', kind: 'bad' }] },
    every: {
      rows: [SPLIT[0], note('wait', 'client', 'ids, then call 2', 'bad'), SPLIT[1], note('join', 'client', 'every client joins', 'bad')],
      output: [{ label: 'HTTP round trips', text: '2', kind: 'bad' }],
    },
    server: {
      rows: [QUERY, ORDERS, note('dl', 'server', 'DataLoader'), BATCH],
      output: [
        { label: 'HTTP round trips', text: '1', kind: 'ok' },
        { label: 'Queries', text: '2', kind: 'ok' },
      ],
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
