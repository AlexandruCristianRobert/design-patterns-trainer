import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  '// ShopContext.OnModelCreating',
  'modelBuilder.Entity<Order>()',
  '    .HasQueryFilter(o => o.TenantId == _tenantId);',
  '',
  '// each request, on its own context',
  'var orders = await db.Orders.ToListAsync();',
]
const L = { FILTER: [1, 2] as [number, number], QUERY: 5 }

const REGIONS: Region[] = [
  { id: 'req', name: 'Requests', sub: 'one context each', tone: 'ui' },
  { id: 'cache', name: 'Model cache', sub: 'built once, shared', tone: 'pool' },
]

const ctx = (n: 'A' | 'B', kind?: Box['kind'], sub?: string): Box => ({
  id: `ctx${n}`,
  region: 'req',
  title: `Context ${n}`,
  sub: sub ?? `request ${n}`,
  kind,
  fields: [{ name: '_tenantId', value: n === 'A' ? '"acme"' : '"globex"' }],
})

/** The cached model's filter for Order; `from` is the context the parameter is read from (null: none drawn). */
const model = (
  filter: string,
  filterKind?: Field['kind'],
  from: string | null = null,
  fromKind?: Field['kind'],
  kind?: Box['kind'],
  fromName = '@p from',
): Box => ({
  id: 'model',
  region: 'cache',
  title: 'Order filter',
  sub: 'in the cached model',
  kind,
  fields: [
    { name: 'filter', value: filter, kind: filterKind },
    ...(from === null ? [] : [{ name: fromName, ref: from, value: 'context', kind: fromKind }]),
  ],
})
const AS_WRITTEN = 'TenantId == _tenantId'
const PARAM = 'TenantId == @p'

const sql = (a: string | null, b: string | null, kindA?: OutLine['kind'], kindB?: OutLine['kind']): OutLine[] => [
  { label: 'Request A', text: a ?? 'no query yet', kind: a === null ? 'muted' : kindA },
  { label: 'Request B', text: b ?? 'no query yet', kind: b === null ? 'muted' : kindB },
]
const spec = (steps: Record<string, GraphStep>): GraphSpec => ({ regions: REGIONS, code: CODE, outputName: 'Filters by', steps })

const BUILD: GraphStep = { boxes: [ctx('A'), model(PARAM, 'ok', null, undefined, 'ok')], line: L.FILTER, output: sql(null, null) }
const QUERY_A: GraphStep = { boxes: [ctx('A', 'ok'), ctx('B'), model(PARAM, 'plain', 'ctxA', 'ok')], line: L.QUERY, output: sql("@p = 'acme'", null, 'ok') }
const QUERY_B: GraphStep = { boxes: [ctx('A'), ctx('B', 'ok'), model(PARAM, 'plain', 'ctxB', 'ok')], line: L.QUERY, output: sql("@p = 'acme'", "@p = 'globex'", 'plain', 'ok') }

const SPECS: Record<string, GraphSpec> = {
  setup: spec({
    model: { boxes: [ctx('A'), model(AS_WRITTEN)], line: L.FILTER, output: sql(null, null) },
    requests: { boxes: [ctx('A'), ctx('B'), model(AS_WRITTEN)], line: null, output: sql(null, null) },
    query: { boxes: [ctx('A'), ctx('B'), model(AS_WRITTEN)], line: L.QUERY, output: sql('?', '?', 'muted', 'muted') },
  }),

  model: spec({
    build: { boxes: [ctx('A', 'ok', 'builds the model'), model(AS_WRITTEN, 'plain')], line: L.FILTER, output: sql(null, null) },
    parameter: { boxes: [ctx('A', 'plain', 'builds the model'), model(PARAM, 'ok', null, undefined, 'ok')], line: L.FILTER, output: sql(null, null) },
  }),
  queries: spec({
    'query-a': QUERY_A,
    'query-b': QUERY_B,
    results: { boxes: [ctx('A', 'ok'), ctx('B', 'ok'), model(PARAM)], line: L.QUERY, output: sql("acme's orders", "globex's orders", 'ok', 'ok') },
  }),

  'fixed-claim': spec({
    build: { boxes: [ctx('A', 'plain', 'builds the model'), model("TenantId == 'acme'", 'bad', null, undefined, 'bad')], line: L.FILTER, bad: true, output: sql(null, null) },
    'query-b': { boxes: [ctx('A'), ctx('B', 'bad'), model("TenantId == 'acme'", 'bad')], line: L.QUERY, bad: true, output: sql(null, "'acme'", undefined, 'bad') },
  }),
  'fixed-reality': spec({ build: BUILD, 'query-b': { ...QUERY_B, output: sql(null, "@p = 'globex'", undefined, 'ok') } }),

  'ignored-claim': spec({
    build: { boxes: [ctx('A', 'plain', 'builds the model'), model('none', 'bad', null, undefined, 'bad')], line: L.FILTER, bad: true, output: sql(null, null) },
    'query-b': { boxes: [ctx('A'), ctx('B', 'bad'), model('none', 'bad')], line: L.QUERY, bad: true, output: sql(null, 'no tenant: every order', undefined, 'bad') },
  }),
  'ignored-reality': spec({ build: BUILD, 'query-b': { ...QUERY_B, output: sql(null, "@p = 'globex'", undefined, 'ok') } }),

  'closure-claim': spec({
    construct: { boxes: [ctx('A', 'plain', 'built 1st'), ctx('B', 'plain', 'built 2nd'), model(AS_WRITTEN)], line: null, output: sql(null, null) },
    'query-a': {
      boxes: [ctx('A', 'plain', 'built 1st, runs the query'), ctx('B', 'bad', 'built 2nd'), model(AS_WRITTEN, 'plain', 'ctxB', 'bad', undefined, 'closure sees')],
      line: L.QUERY,
      bad: true,
      output: sql("'globex'", null, 'bad'),
    },
  }),
  'closure-reality': spec({
    construct: { boxes: [ctx('A', 'plain', 'built 1st'), ctx('B', 'plain', 'built 2nd'), model(AS_WRITTEN)], line: null, output: sql(null, null) },
    'query-a': { boxes: [ctx('A', 'ok', 'built 1st, runs the query'), ctx('B', 'plain', 'built 2nd'), model(PARAM, 'plain', 'ctxA', 'ok')], line: L.QUERY, output: sql("@p = 'acme'", null, 'ok') },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
