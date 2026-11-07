import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type ChipKind, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const MEM_CODE = [
  'var products = await cache.GetOrCreateAsync("products", async entry =>',
  '{',
  '    entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);',
  '    return await db.Products.ToListAsync();',
  '});',
]
const M = { CALL: 0, EXP: 2, FACTORY: 3 }
const HYBRID_CODE = [
  'var products = await hybrid.GetOrCreateAsync(',
  '    "products",',
  '    async ct => await db.Products.ToListAsync(ct),',
  '    new HybridCacheEntryOptions',
  '    {',
  '        Expiration = TimeSpan.FromMinutes(5)',
  '    });',
]
const H = { CALL: [0, 1] as [number, number], FACTORY: 2 }
const SLIDE_CODE = MEM_CODE.map((l, i) => (i === M.EXP ? '    entry.SlidingExpiration = TimeSpan.FromMinutes(5);' : l))

const REQ: RowDef = { id: 'req', name: 'Requests', sub: 'for the product list', tone: 'ui' }
const CACHE: RowDef = { id: 'cache', name: 'Cache', sub: 'IMemoryCache, one per app', tone: 'pool' }
/** The Setup's name for the cache: nothing about how it is registered. */
const CACHE_SETUP: RowDef = { id: 'cache', name: 'Cache', tone: 'pool' }
const HCACHE: RowDef = { ...CACHE, sub: 'HybridCache, one per app' }
const FACTORY: RowDef = { id: 'factory', name: 'Factory', sub: 'loads the list', tone: 'muted' }
const DB: RowDef = { id: 'db', name: 'Database', tone: 'io' }

const chip = (key: string, label: string, kind: ChipKind = 'run'): Chip => ({ key, label, kind })
const reqs = (kind: ChipKind = 'run', what = ''): Chip[] => ['#1', '#2', '#3', '… #100'].map((n, i) => chip(`r${i}`, `${n}${what}`, kind))
const fresh = [chip('products', 'products: list')]
const expired = [chip('products', 'products: expired', 'gone')]
const stampede = [chip('q', '100 × SELECT products', 'bad')]

const spec = (rows: RowDef[], code: string[] | null, steps: Record<string, RowStep>): RowSpec => ({ rows, code: code ?? undefined, steps })

// ---- Reality, in step with the HybridCache stage ----
const MEM = {
  miss: { rows: { req: reqs('run', ' miss'), cache: expired }, line: M.CALL },
  factories: { rows: { req: reqs('run', ' miss'), cache: expired, factory: reqs('bad', ' runs it') }, line: M.FACTORY },
  queries: { rows: { req: reqs('run', ' miss'), cache: expired, factory: reqs('bad', ' runs it'), db: stampede }, line: M.FACTORY, bad: true },
  stored: { rows: { req: reqs('ok', ' gets it'), cache: [chip('products', 'products: list, written 100 times')], factory: reqs('bad', ' runs it'), db: stampede }, line: M.CALL },
} satisfies Record<string, RowStep>
const one = [chip('r0', '#1 runs it', 'run'), chip('waiters', '#2 … #100 await #1', 'run')]
const HYB = {
  miss: { rows: { req: reqs('run', ' miss'), cache: expired }, line: H.CALL },
  factories: { rows: { req: reqs('run', ' miss'), cache: expired, factory: one }, line: H.FACTORY },
  queries: { rows: { req: reqs('run', ' miss'), cache: expired, factory: one, db: [chip('q', '1 × SELECT products', 'ok')] }, line: H.FACTORY },
  stored: { rows: { req: reqs('ok', ' gets it'), cache: [chip('products', 'products: list', 'ok')], factory: one, db: [chip('q', '1 × SELECT products', 'ok')] }, line: H.CALL },
} satisfies Record<string, RowStep>

// ---- Claim B: other entries ----
const others = (kind: ChipKind = 'run'): Chip[] => [chip('categories', 'categories', kind), chip('prices', 'prices', kind)]

// ---- Claim C: one cache or one per request ----
const perRequest = [chip('c1', '#1: own empty copy', 'gone'), chip('c2', '#2: own empty copy', 'gone'), chip('c3', '#3: own empty copy', 'gone')]
const CACHE_C: RowDef = { ...CACHE, sub: 'IMemoryCache: how many?' }

const SPECS: Record<string, RowSpec> = {
  setup: spec([REQ, CACHE_SETUP, DB], MEM_CODE, {
    cached: { rows: { req: reqs('run', ' reads'), cache: fresh }, line: M.CALL },
    expires: { rows: { cache: expired }, line: M.EXP },
    burst: { rows: { req: reqs(), cache: expired, db: [chip('q', 'hundreds × SELECT products', 'bad')] }, line: M.CALL },
  }),
  'memory-cache': spec([REQ, CACHE, FACTORY, DB], MEM_CODE, MEM),
  'hybrid-cache': spec([REQ, HCACHE, FACTORY, DB], HYBRID_CODE, HYB),

  'evict-all-claim': spec([CACHE, DB], null, {
    expires: { rows: { cache: [...expired, ...others()] } },
    evict: { rows: { cache: [...expired, ...others('gone').map((c) => ({ ...c, label: `${c.label}: evicted` }))] } },
    reload: {
      rows: {
        cache: [...expired, ...others('gone').map((c) => ({ ...c, label: `${c.label}: evicted` }))],
        db: [chip('q', 'SELECT products'), chip('qc', 'SELECT categories'), chip('qp', 'SELECT prices')],
      },
    },
  }),
  'evict-all-reality': spec([CACHE, DB], null, {
    expires: { rows: { cache: [...expired, ...others()] } },
    evict: { rows: { cache: [...expired, ...others('ok').map((c) => ({ ...c, label: `${c.label}: still cached` }))] } },
    reload: { rows: { cache: [...expired, ...others('ok').map((c) => ({ ...c, label: `${c.label}: still cached` }))], db: stampede } },
  }),

  'per-scope-claim': spec([REQ, CACHE_C, DB], null, {
    scopes: { rows: { req: reqs().slice(0, 3), cache: perRequest } },
    misses: { rows: { req: reqs('run', ' miss').slice(0, 3), cache: perRequest, db: [chip('q1', '#1 SELECT'), chip('q2', '#2 SELECT'), chip('q3', '#3 SELECT')] } },
    singleton: { rows: { req: reqs().slice(0, 3), cache: [chip('one', 'one shared cache, as a singleton', 'ok')], db: [chip('q', 'no burst', 'ok')] } },
  }),
  'per-scope-reality': spec([REQ, CACHE_C, DB], null, {
    scopes: { rows: { req: reqs().slice(0, 3), cache: [chip('one', 'one shared cache (AddMemoryCache: singleton)', 'ok')] } },
    misses: { rows: { req: reqs('ok', ' hit').slice(0, 3), cache: [chip('one', 'one shared cache (AddMemoryCache: singleton)', 'ok'), ...fresh], db: [chip('q', 'no queries', 'gone')] } },
    singleton: { rows: { req: reqs('run', ' miss'), cache: [chip('one', 'one shared cache (AddMemoryCache: singleton)', 'ok'), ...expired], db: stampede } },
  }),

  'sliding-claim': spec([REQ, CACHE, DB], SLIDE_CODE, {
    sliding: { rows: { cache: [chip('products', 'products: expires 5 min after the last read')] }, line: M.EXP },
    reads: { rows: { req: reqs('ok', ' hit'), cache: [chip('products', 'products: expiry pushed back on every read', 'ok')] }, line: M.EXP },
    never: { rows: { req: reqs('ok', ' hit'), cache: [chip('products', 'products: never expires', 'ok')], db: [chip('q', 'no burst', 'ok')] }, line: M.EXP },
  }),
  'sliding-reality': spec([REQ, CACHE, DB], SLIDE_CODE, {
    sliding: { rows: { cache: [chip('products', 'products: expires 5 min after the last read')] }, line: M.EXP },
    reads: { rows: { req: reqs('ok', ' hit'), cache: [chip('products', 'products: loaded hours ago, stale', 'bad')] }, line: M.EXP },
    never: { rows: { req: reqs('run', ' miss'), cache: [chip('products', 'products: gone after a restart', 'gone')], db: stampede }, line: M.FACTORY, bad: true },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
