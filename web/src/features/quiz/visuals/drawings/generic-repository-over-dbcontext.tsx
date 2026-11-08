import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const GENERIC = [
  'public interface IRepository<T>',
  '{',
  '    Task<T?> GetById(int id);',
  '    Task<List<T>> GetAll();',
  '    void Add(T entity);',
  '    void Update(T entity);',
  '    void Delete(T entity);',
  '}',
]
const DIRECT = [
  'var summaries = await db.Orders',
  '    .Where(o => o.CustomerId == id)',
  '    .Select(o => new OrderSummary(o.Id, o.Total, o.Customer.Name))',
  '    .ToListAsync();',
  '',
  'var order = await db.Orders.FindAsync(orderId);',
  'order.Status = OrderStatus.Paid;',
  'await db.SaveChangesAsync();',
  '',
  'var toShip = await orders.GetForShipping(orderId);',
]
const PARAMS = [
  'Task<List<T>> GetAll(Expression<Func<T, bool>> filter,',
  '                     params string[] includes);',
  '',
  'var list = await repo.GetAll(o => o.CustomerId == id,',
  '                             "Lines", "Customer");',
]
const VIRTUAL = [
  'public class Repository<T> : IRepository<T>',
  '{',
  '    public virtual Task<List<T>> GetAll() => …;',
  '}',
  '',
  'public class OrderRepository : Repository<Order>',
  '{',
  '    public override Task<List<Order>> GetAll() =>',
  '        db.Orders.Include(o => o.Lines).ToListAsync();',
  '}',
]
/** The Reality's listing: the subclass grows its own entity-specific method again. */
const VIRTUAL_REAL = [
  ...VIRTUAL.slice(0, 9),
  '    public Task<List<Order>> GetAllWithLinesAndCustomer() => …;',
  '}',
]
const DAPPER = [
  'public class Repository<T> : IRepository<T>',
  '{',
  '    public Task<List<T>> GetAll() =>',
  '        conn.QueryAsync<T>($"SELECT * FROM {Table}");',
  '    public void Update(T entity) => conn.Execute(UpdateAllColumnsSql, entity);',
  '}',
]

const CALLERS: Region = { id: 'callers', name: 'Handlers', tone: 'ui' }
const REPO: Region = { id: 'repo', name: 'Repositories', tone: 'pool' }
const DATA: Region = { id: 'data', name: 'Data access', tone: 'io' }
const REGIONS = [CALLERS, REPO, DATA]
type K = Field['kind']

const CRUD: Field[] = ['GetById', 'GetAll', 'Add', 'Update', 'Delete'].map((m) => ({ name: m }))
const repo = (fields: Field[], kind?: Box['kind'], still?: boolean): Box => ({ id: 'repo', region: 'repo', title: 'IRepository<T>', sub: 'generic', fields, kind, still })
const CTX: Box = { id: 'ctx', region: 'data', title: 'DbContext', sub: 'EF Core' }
const wraps: Field = { name: 'wraps', ref: 'ctx' }
const handler = (id: string, title: string, fields: Field[], kind?: Box['kind']): Box => ({ id, region: 'callers', title, fields, kind })
const graph = (code: string[], steps: Record<string, GraphStep>, regions = REGIONS): GraphSpec => ({ regions, code, outputName: 'SQL', steps })
const sql = (text: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'SQL', text, kind }]
const GROWN: Field[] = [...CRUD, { name: 'extra', value: 'GetAllWith…' }, { name: 'more', value: '…' }]
const updateAll = (kind?: K): Field => ({ name: 'Update', value: 'all columns', kind })

const SPECS: Record<string, GraphSpec> = {
  // ---- Setup: the stem's three facts ----
  setup: graph(GENERIC, {
    wrap: { boxes: [repo([...CRUD, wraps]), CTX], line: [2, 6] },
    grow: { boxes: [repo([...GROWN, wraps]), { ...CTX, still: true }], line: 3 },
    update: { boxes: [repo([...GROWN.filter((f) => f.name !== 'Update'), updateAll(), wraps]), { ...CTX, still: true }], line: 5 },
    ask: { boxes: [repo([...GROWN.filter((f) => f.name !== 'Update'), updateAll(), wraps], undefined, true), { ...CTX, still: true }], line: null },
 }, [REPO, DATA]),

  direct: graph(DIRECT, {
    query: {
      boxes: [handler('list', 'OrderListHandler', [{ name: 'queries', value: 'Select(…)', ref: 'ctx', kind: 'ok' }]), CTX],
      line: [0, 3],
      output: sql('SELECT o.Id, o.Total, c.Name FROM Orders o JOIN Customers c …', 'ok'),
    },
    update: {
      boxes: [handler('list', 'OrderListHandler', [{ name: 'queries', value: 'Select(…)', ref: 'ctx' }]), handler('pay', 'PayOrderHandler', [{ name: 'changes', value: 'Status', ref: 'ctx', kind: 'ok' }, { name: 'Update()', value: 'not needed', kind: 'ok' }]), CTX],
      line: [5, 7],
      output: sql('UPDATE Orders SET Status = @p0 WHERE Id = @p1', 'ok'),
    },
    aggregate: {
      boxes: [
        handler('list', 'OrderListHandler', [{ name: 'queries', value: 'db directly', kind: 'muted' }]),
        handler('pay', 'PayOrderHandler', [{ name: 'changes', value: 'db directly', kind: 'muted' }]),
        handler('ship', 'ShipHandler', [{ name: 'calls', value: 'GetForShipping', ref: 'orepo' }]),
        { id: 'orepo', region: 'repo', title: 'IOrderRepository', sub: 'aggregate', fields: [{ name: 'GetForShipping', value: 'domain meaning', kind: 'ok' }, { name: 'uses', ref: 'ctx' }] },
        CTX,
      ],
      line: 9,
    },
  }),

  'params-claim': graph(PARAMS, {
    signature: { boxes: [repo([{ name: 'GetAll', value: '(filter, includes)' }, wraps]), CTX], line: [0, 1] },
    choose: { boxes: [handler('list', 'OrderListHandler', [{ name: 'chooses', value: 'what to load', ref: 'repo' }]), repo([{ name: 'GetAll', value: '(filter, includes)' }, wraps]), CTX], line: [3, 4] },
  }),
  'params-reality': graph(PARAMS, {
    leak: {
      boxes: [handler('list', 'OrderListHandler', [{ name: 'passes', value: '"Lines", "Customer"', ref: 'repo', kind: 'bad' }]), repo([{ name: 'GetAll', value: '(filter, includes)' }, wraps]), CTX],
      line: 4,
      bad: true,
    },
    whole: {
      boxes: [
        handler('list', 'OrderListHandler', [{ name: 'passes', value: '"Lines", "Customer"', ref: 'repo', kind: 'bad' }]),
        repo([{ name: 'GetAll', value: 'whole entities', kind: 'bad' }, updateAll('bad'), wraps]),
        CTX,
      ],
      line: 0,
      bad: true,
      output: sql('SELECT o.*, l.*, c.* FROM Orders o JOIN OrderLines l … JOIN Customers c …', 'bad'),
    },
  }),

  'virtual-claim': graph(VIRTUAL, {
    virtual: { boxes: [repo([{ name: 'GetAll', value: 'virtual' }, wraps]), CTX], line: 2 },
    override: {
      boxes: [repo([{ name: 'GetAll', value: 'virtual' }, wraps]), { id: 'orepo', region: 'repo', title: 'OrderRepository', fields: [{ name: 'GetAll', value: 'override' }, { name: 'base', ref: 'repo' }] }, CTX],
      line: [7, 8],
    },
  }),
  'virtual-reality': graph(VIRTUAL_REAL, {
    signature: {
      boxes: [
        handler('list', 'OrderListHandler', [{ name: 'needs', value: 'a summary', kind: 'bad' }, { name: 'calls', value: 'GetAll()', ref: 'orepo' }]),
        handler('count', 'OrderCountHandler', [{ name: 'calls', value: 'GetAll()', ref: 'orepo' }, { name: 'gets', value: 'lines too', kind: 'bad' }]),
        { id: 'orepo', region: 'repo', title: 'OrderRepository', fields: [{ name: 'GetAll()', value: 'one signature', kind: 'bad' }] },
        CTX,
      ],
      line: 7,
      bad: true,
    },
    back: {
      boxes: [
        handler('list', 'OrderListHandler', [{ name: 'calls', value: 'GetAllWith…', ref: 'orepo' }]),
        handler('count', 'OrderCountHandler', [{ name: 'calls', value: 'GetAll()', ref: 'orepo' }]),
        { id: 'orepo', region: 'repo', title: 'OrderRepository', fields: [{ name: 'GetAll()', value: 'override' }, { name: 'new', value: 'GetAllWith…', kind: 'bad' }, { name: 'wraps', ref: 'ctx' }], kind: 'bad' },
        CTX,
      ],
      line: 9,
      bad: true,
    },
  }),

  'dapper-claim': graph(
    DAPPER,
    {
      sql: { boxes: [repo([{ name: 'GetAll', value: 'hand-written SQL' }, { name: 'runs on', ref: 'dap' }]), { id: 'dap', region: 'data', title: 'Dapper', sub: 'SQL connection' }], line: [2, 3] },
      tracked: {
        boxes: [repo([{ name: 'GetAll', value: 'hand-written SQL' }, { name: 'tracking', value: 'none' }, { name: 'runs on', ref: 'dap' }]), { id: 'dap', region: 'data', title: 'Dapper', sub: 'SQL connection' }],
        line: [2, 3],
      },
    },
  ),
  'dapper-reality': graph(DAPPER, {
    same: {
      boxes: [
        repo([...CRUD.slice(0, 2), { name: 'extra', value: 'GetAllWith…', kind: 'bad' }, { name: 'projections', value: 'none', kind: 'bad' }, { name: 'runs on', ref: 'dap' }], 'bad'),
        { id: 'dap', region: 'data', title: 'Dapper', sub: 'SQL connection' },
      ],
      line: [2, 3],
      bad: true,
    },
    write: {
      boxes: [repo([{ name: 'Update', value: 'every column by hand', kind: 'bad' }, { name: 'tracking', value: 'lost', kind: 'bad' }, { name: 'runs on', ref: 'dap' }], 'bad'), { id: 'dap', region: 'data', title: 'Dapper', sub: 'SQL connection' }],
      line: 4,
      bad: true,
      output: sql('UPDATE Orders SET CustomerId = @p0, Total = @p1, Status = @p2, … WHERE Id = @pN', 'bad'),
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
