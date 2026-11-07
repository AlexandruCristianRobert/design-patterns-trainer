import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const OUTPUT_CODE = [
  'builder.Services.AddOutputCache();',
  'app.UseOutputCache();',
  '',
  'app.MapGet("/products/{id}", GetProductPage)',
  '   .CacheOutput(p => p.Expire(TimeSpan.FromMinutes(10)).Tag("products"));',
  '',
  'app.MapPut("/products/{id}", async (int id, ProductDto dto,',
  '    IOutputCacheStore cache, CancellationToken ct) =>',
  '{',
  '    await UpdateProductAsync(id, dto, ct);',
  '    await cache.EvictByTagAsync("products", ct);',
  '    return Results.NoContent();',
  '});',
]
const O = { CACHE: [3, 4] as [number, number], PUT: [6, 9] as [number, number], EVICT: 10 }

const NO_CACHE_CODE = [
  'app.UseResponseCaching();',
  '// the page is sent with Cache-Control: public,max-age=600',
  '',
  '// the admin\'s next request to the page',
  'GET /products/42 HTTP/1.1',
  'Cache-Control: no-cache',
]
const N = { SETUP: [0, 1] as [number, number], REQUEST: [4, 5] as [number, number] }

const REMOVE_CODE = [
  'app.UseResponseCaching();',
  '',
  'app.MapPut("/products/{id}", async (int id, ProductDto dto, CancellationToken ct) =>',
  '{',
  '    await UpdateProductAsync(id, dto, ct);',
  '    ResponseCache.Remove($"/products/{id}");',
  '    return Results.NoContent();',
  '});',
]
const R = { PUT: [2, 4] as [number, number], REMOVE: 5 }

const ATTRIBUTE_CODE = [
  '[ResponseCache(Duration = 600)]',
  'public IActionResult Product(int id) => View(_products.Find(id));',
  '',
  '// response header',
  'Cache-Control: public,max-age=600',
]
const A = { ACTION: [0, 1] as [number, number], HEADER: 4 }

const actors: SeqActor[] = [
  { id: 'client', name: 'Browsers', sub: 'visitors, admin', tone: 'ui' },
  { id: 'cache', name: 'Server cache', tone: 'pool' },
  { id: 'app', name: 'Endpoints', sub: 'the app', tone: 'io' },
]
const spec = (code: string[] | undefined, steps: Record<string, SeqStep>): SeqSpec => ({ actors, code, outputName: 'Cached page for product 42', steps })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind'], both?: boolean): SeqRow => ({ key, from, to, label, kind, both })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const entry = (text: string, kind?: OutLine['kind']): OutLine[] => [{ label: '/products/42', text, kind }]

const get = msg('get', 'client', 'cache', 'visitor: GET /products/42')
const render1 = msg('render1', 'cache', 'app', 'miss: renders page v1', undefined, true)
const put = msg('put', 'client', 'app', 'admin: PUT /products/42')
const saved = note('saved', 'app', 'product saved: v2')
const CACHED = [get, render1]
const UPDATED = [...CACHED, put, saved]
const V1 = entry('page v1, 10 minutes')

const SPECS: Record<string, SeqSpec> = {
  setup: spec(undefined, {
    cached: { rows: CACHED, output: V1 },
    update: { rows: UPDATED, output: entry('?', 'muted') },
  }),

  'evict-by-tag': spec(OUTPUT_CODE, {
    'first-get': { rows: CACHED, line: O.CACHE, output: entry('page v1, tag "products", 10 minutes') },
    hit: { rows: [...CACHED, msg('get2', 'client', 'cache', 'visitor: GET again'), msg('hit', 'cache', 'client', 'hit: page v1, endpoint not run', 'ok')], line: O.CACHE, output: entry('page v1, tag "products", 10 minutes') },
    update: { rows: [...CACHED, put, saved], line: O.PUT, output: entry('page v1, tag "products", 10 minutes') },
    evict: { rows: [...UPDATED, msg('evict', 'app', 'cache', 'EvictByTagAsync("products")', 'ok')], line: O.EVICT, output: entry('removed', 'ok') },
    'next-get': {
      rows: [...UPDATED, msg('evict', 'app', 'cache', 'EvictByTagAsync("products")', 'ok'), msg('get3', 'client', 'cache', 'visitor: GET /products/42'), msg('render2', 'cache', 'app', 'miss: renders page v2', 'ok', true)],
      line: O.CACHE,
      output: entry('page v2, tag "products", 10 minutes', 'ok'),
    },
  }),

  'no-cache-claim': spec(NO_CACHE_CODE, {
    update: { rows: UPDATED, line: N.SETUP, output: V1 },
    'no-cache': { rows: [...UPDATED, msg('nc', 'client', 'cache', 'admin: GET, no-cache'), note('inv', 'cache', 'cached page invalidated', 'bad')], line: N.REQUEST, bad: true, output: entry('invalidated (claimed)', 'bad') },
  }),
  'no-cache-reality': spec(NO_CACHE_CODE, {
    update: { rows: [...UPDATED, msg('get2', 'client', 'cache', 'visitor: GET /products/42'), msg('old', 'cache', 'client', 'hit: old page v1', 'bad')], line: N.SETUP, output: V1 },
    'no-cache': {
      rows: [
        ...UPDATED,
        msg('get2', 'client', 'cache', 'visitor: GET /products/42'),
        msg('old', 'cache', 'client', 'hit: old page v1', 'bad'),
        msg('nc', 'client', 'cache', 'admin: GET, no-cache'),
        msg('fresh', 'cache', 'app', 'lookup skipped: renders v2', undefined, true),
        note('noapi', 'cache', 'no eviction API', 'muted'),
      ],
      line: N.REQUEST,
      output: [{ label: 'Header', text: 'a request directive, not an eviction' }],
    },
  }),

  'remove-claim': spec(REMOVE_CODE, {
    update: { rows: UPDATED, line: R.PUT, output: V1 },
    remove: { rows: [...UPDATED, msg('remove', 'app', 'cache', 'ResponseCache.Remove(path)', 'bad')], line: R.REMOVE, bad: true, output: entry('removed (claimed)', 'bad') },
  }),
  'remove-reality': spec(REMOVE_CODE, {
    update: { rows: UPDATED, line: R.PUT, output: V1 },
    remove: {
      rows: [...UPDATED, note('noapi', 'app', 'no such API', 'bad'), msg('get2', 'client', 'cache', 'visitor: GET /products/42'), msg('old', 'cache', 'client', 'hit: old page v1', 'bad')],
      line: R.REMOVE,
      bad: true,
      output: entry('page v1 until it expires', 'bad'),
    },
  }),

  'attribute-claim': spec(ATTRIBUTE_CODE, {
    cached: { rows: CACHED, line: A.ACTION, output: entry('page v1, 600 s') },
    update: { rows: [...UPDATED, note('inv', 'cache', 'attribute invalidates it', 'bad')], line: A.ACTION, bad: true, output: entry('invalidated (claimed)', 'bad') },
  }),
  'attribute-reality': spec(ATTRIBUTE_CODE, {
    cached: { rows: [...CACHED, msg('hdr', 'cache', 'client', 'page v1 + Cache-Control header')], line: A.HEADER, output: entry('page v1, 600 s') },
    update: {
      rows: [...CACHED, msg('hdr', 'cache', 'client', 'page v1 + Cache-Control header'), put, saved, msg('get2', 'client', 'cache', 'visitor: GET /products/42'), msg('old', 'cache', 'client', 'hit: old page v1', 'bad')],
      line: A.ACTION,
      output: entry('page v1, for up to 600 s', 'bad'),
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
