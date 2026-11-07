import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'builder.Services.AddDbContextPool<AppDbContext>(…);',
  '',
  'class AppDbContext : DbContext',
  '{',
  '    public string TenantId { get; set; }',
  '',
  '    public AppDbContext(DbContextOptions<AppDbContext> o) : base(o)',
  '        => TenantId = TenantAccessor.Current; // from the request',
  '}',
]
const L = { REG: 0, CTOR: [6, 7] as [number, number] }

const FIX_CODE = [
  'builder.Services.AddPooledDbContextFactory<AppDbContext>(…);',
  'builder.Services.AddScoped(sp =>',
  '{',
  '    var db = sp.GetRequiredService<IDbContextFactory<AppDbContext>>()',
  '               .CreateDbContext(); // rents from the pool',
  '    db.TenantId = sp.GetRequiredService<ITenant>().Id;',
  '    return db;',
  '});',
]
const F = { RENT: [3, 4] as [number, number], SET: 5 }

const REQ_A: Region = { id: 'a', name: 'Request 1', sub: 'tenant acme', tone: 'ui' }
const POOL: Region = { id: 'pool', name: 'DbContext pool', tone: 'pool' }
const REQ_B: Region = { id: 'b', name: 'Request 2', sub: 'tenant globex', tone: 'ui' }
const ADO: Region = { id: 'ado', name: 'ADO.NET connection pool', tone: 'io' }

const spec = (regions: Region[], steps: Record<string, GraphStep>, code: string[] | null = CODE): GraphSpec => ({ regions, code: code ?? undefined, outputName: 'Outcome', steps })

type Where = 'a' | 'b' | 'pool'
/** A request's handler; `uses` points at the context it was given. */
const handler = (r: 'a' | 'b', uses?: string, kind?: Box['kind']): Box => ({
  id: `h${r}`,
  region: r,
  title: 'Handler',
  kind,
  fields: uses ? [{ name: 'db', value: uses === 'ctx2' ? '#2' : '#1', ref: uses }] : [],
})
const ctx = (where: Where, fields: Field[], kind?: Box['kind'], id = 'ctx', title = 'AppDbContext #1'): Box => ({ id, region: where, title, kind, fields })
const tenant = (value: string, kind?: Field['kind']): Field => ({ name: 'TenantId', value, kind })
const tracked = (value: string, kind?: Field['kind']): Field => ({ name: 'tracked', value, kind })
const out = (label: string, text: string, kind?: OutLine['kind']): OutLine[] => [{ label, text, kind }]

// ---- Reality: one instance, two requests ----
const R = {
  first: { boxes: [handler('a', 'ctx'), ctx('a', [tenant('acme'), tracked('empty')])], line: L.CTOR, output: out('Request 1', 'TenantId acme') },
  work: { boxes: [handler('a', 'ctx'), ctx('a', [tenant('acme'), tracked('3 entities')])], line: null, output: out('Request 1', 'TenantId acme') },
  return: { boxes: [handler('a', undefined, 'gone'), ctx('pool', [tenant('acme'), tracked('empty', 'ok')])], line: null, output: out('Request 1', 'done') },
  rent: { boxes: [handler('b', 'ctx'), ctx('b', [tenant('acme'), tracked('empty')])], line: L.CTOR, output: out('Request 2', 'constructor not run') },
  leak: {
    boxes: [handler('b', 'ctx'), ctx('b', [tenant('acme', 'bad'), tracked('empty')], 'bad')],
    line: L.CTOR,
    bad: true,
    output: out('Request 2', "uses acme's data", 'bad'),
  },
} satisfies Record<string, GraphStep>

// ---- Fix: set TenantId on every rent ----
const FIX = {
  rent: { boxes: [handler('b', 'ctx'), ctx('b', [tenant('acme', 'muted'), tracked('empty')])], line: F.RENT, output: out('Request 2', 'rented, not ready yet') },
  set: { boxes: [handler('b', 'ctx'), ctx('b', [tenant('globex', 'ok'), tracked('empty')])], line: F.SET, output: out('Request 2', 'rented, not ready yet') },
  use: { boxes: [handler('b', 'ctx'), ctx('b', [tenant('globex', 'ok'), tracked('empty')], 'ok')], line: F.SET, output: out('Request 2', "uses globex's data", 'ok') },
} satisfies Record<string, GraphStep>

// ---- Claims ----
const RETURNED = [handler('a', undefined, 'gone'), ctx('pool', [tracked('3 entities')])]
const BOTH = [handler('a'), handler('b'), ctx('pool', [])]
const IDLE: Box[] = [ctx('pool', [{ name: 'connection', value: '?', kind: 'muted' }])]
const conn = (sub: string, kind?: Box['kind']): Box => ({ id: 'conn', region: 'ado', title: 'Connection', sub, kind })

const SPECS: Record<string, GraphSpec> = {
  setup: spec([{ id: 'req', name: 'Requests', tone: 'ui' }, { id: 'pool', name: 'Contexts', tone: 'pool' }], {
    switch: { boxes: [{ id: 'reg', region: 'pool', title: 'AppDbContext', sub: 'from AddDbContextPool' }], line: L.REG },
    ctor: {
      boxes: [
        { id: 'r1', region: 'req', title: 'Request 1', fields: [{ name: 'tenant', value: 'acme' }] },
        { id: 'reg', region: 'pool', title: 'AppDbContext', sub: 'for request 1', fields: [{ name: 'TenantId', value: 'acme', ref: 'r1' }] },
      ],
      line: L.CTOR,
    },
    risk: {
      boxes: [
        { id: 'r1', region: 'req', title: 'Request 1', fields: [{ name: 'tenant', value: 'acme' }] },
        { id: 'r2', region: 'req', title: 'Request 2', fields: [{ name: 'tenant', value: 'globex' }, { name: 'context', value: '?', kind: 'muted' }] },
        { id: 'reg', region: 'pool', title: 'AppDbContext', sub: 'for request 1', fields: [{ name: 'TenantId', value: 'acme', ref: 'r1' }] },
      ],
      line: L.REG,
    },
  }),
  pooled: spec([REQ_A, POOL, REQ_B], R),
  'per-rent': spec([REQ_A, POOL, REQ_B], FIX, FIX_CODE),

  'tracker-claim': spec([REQ_A, POOL, REQ_B], {
    return: { boxes: RETURNED, line: null },
    rent: { boxes: [handler('b', 'ctx'), ctx('b', [tracked("request 1's", 'bad')], 'bad')], line: null, bad: true },
    clear: {
      boxes: [handler('b', 'ctx'), ctx('b', [tracked("request 1's", 'bad')], 'bad')],
      line: null,
      output: out('Every handler', 'must call ChangeTracker.Clear()', 'bad'),
    },
  }),
  'tracker-reality': spec([REQ_A, POOL, REQ_B], {
    return: { boxes: RETURNED, line: null },
    rent: { boxes: [handler('b', 'ctx'), ctx('b', [tracked('empty', 'ok')])], line: null, output: out('Request 2', 'empty change tracker', 'ok') },
    clear: {
      boxes: [handler('b', 'ctx'), ctx('b', [tracked('empty', 'ok'), tenant('acme', 'bad')])],
      line: L.CTOR,
      output: out('Request 2', 'no Clear() needed; TenantId not reset', 'ok'),
    },
  }),

  'shared-claim': spec([REQ_A, POOL, REQ_B], {
    both: { boxes: BOTH, line: null },
    share: { boxes: [handler('a', 'ctx'), handler('b', 'ctx'), ctx('pool', [{ name: 'used by', value: '1 and 2 at once', kind: 'bad' }], 'bad')], line: null },
    'thread-safe': {
      boxes: [handler('a', 'ctx'), handler('b', 'ctx'), ctx('pool', [{ name: 'used by', value: '1 and 2 at once', kind: 'bad' }], 'bad')],
      line: null,
      output: out('AppDbContext', 'must be made thread-safe', 'bad'),
    },
  }),
  'shared-reality': spec([REQ_A, POOL, REQ_B], {
    both: { boxes: BOTH, line: null },
    share: {
      boxes: [handler('a', 'ctx'), ctx('a', [{ name: 'leased to', value: 'request 1 only', kind: 'ok' }]), handler('b', 'ctx2'), ctx('b', [{ name: 'leased to', value: 'request 2 only', kind: 'ok' }], undefined, 'ctx2', 'AppDbContext #2')],
      line: null,
    },
    'thread-safe': {
      boxes: [handler('a', undefined, 'gone'), handler('b', undefined, 'gone'), ctx('pool', []), ctx('pool', [], undefined, 'ctx2', 'AppDbContext #2')],
      line: null,
      output: out('AppDbContext', 'one request at a time, as before', 'ok'),
    },
  }),

  'connection-claim': spec(
    [POOL, ADO],
    {
      idle: { boxes: IDLE },
      open: { boxes: [ctx('pool', [{ name: 'connection', value: 'open', ref: 'conn', kind: 'bad' }], 'bad'), conn('held open', 'bad')] },
      limit: {
        boxes: [ctx('pool', [{ name: 'connection', value: 'open', ref: 'conn', kind: 'bad' }], 'bad'), conn('held open', 'bad')],
        output: out('Pool size', 'below the connection limit', 'bad'),
      },
    },
    null,
  ),
  'connection-reality': spec(
    [POOL, ADO],
    {
      idle: { boxes: IDLE },
      open: { boxes: [ctx('pool', [{ name: 'connection', value: 'closed', kind: 'ok' }]), conn('back in the pool, reusable', 'ok')] },
      limit: {
        boxes: [ctx('pool', [{ name: 'connection', value: 'closed', kind: 'ok' }]), conn('back in the pool, reusable', 'ok')],
        output: out('Open connections', 'not set by the DbContext pool size', 'ok'),
      },
    },
    null,
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
