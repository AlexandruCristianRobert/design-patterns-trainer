import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'app.MapWhen(ctx => ctx.Request.Path.StartsWithSegments("/api"),',
  '    branch => branch.UseMiddleware<ApiKeyMiddleware>());',
  'app.UseRouting();',
  'app.MapControllers();',
]
const USE_WHEN = [
  'app.UseWhen(ctx => ctx.Request.Path.StartsWithSegments("/api"),',
  '    branch => branch.UseMiddleware<ApiKeyMiddleware>());',
  'app.UseRouting();',
  'app.MapControllers();',
]
const MOVED = [
  'app.UseRouting();',
  'app.MapControllers();',
  'app.MapWhen(ctx => ctx.Request.Path.StartsWithSegments("/api"),',
  '    branch => branch.UseMiddleware<ApiKeyMiddleware>());',
]
const L = { PREDICATE: 0, BRANCH: 1, MAIN: [2, 3] as [number, number], ALL: [0, 3] as [number, number] }

const actors = (fork: string): SeqActor[] => [
  { id: 'client', name: 'Client', tone: 'muted' },
  { id: 'fork', name: fork, sub: 'predicate', tone: 'ui' },
  { id: 'branch', name: 'Branch', sub: 'API key check', tone: 'pool' },
  { id: 'main', name: 'Main pipeline', sub: 'routing, controllers', tone: 'io' },
]
const spec = (steps: Record<string, SeqStep>, fork = 'MapWhen', code = CODE): SeqSpec => ({ actors: actors(fork), code, outputName: 'Response', steps })

const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const resp = (text: string, kind: OutLine['kind'] = 'plain'): OutLine[] => [{ label: 'Status', text, kind }]
const WAITING = resp('…')

const request = row('req', 'client', 'GET /api/orders', 'fork')
const into = row('into', 'fork', 'true', 'branch')
const key = row('key', 'branch', 'key ok: next(ctx)')
const end = row('end', 'branch', 'end of branch: 404', undefined, 'bad')
const never = row('never', 'main', 'never reached', undefined, 'skip')
const back = row('resp', 'branch', '404', 'client', 'bad')

/** The real run through the MapWhen fork. */
const R = {
  request: { rows: [request], line: null, output: WAITING },
  predicate: { rows: [request, into], line: L.PREDICATE, output: WAITING },
  key: { rows: [request, into, key], line: L.BRANCH, output: WAITING },
  branchEnd: { rows: [request, into, key, end, never], line: L.MAIN, bad: true, output: WAITING },
  response: { rows: [request, into, key, end, never, back], line: null, output: resp('404 Not Found', 'bad') },
} satisfies Record<string, SeqStep>

const uwInto = row('into', 'fork', 'true', 'branch')
const rejoin = row('rejoin', 'branch', 'next: back to main', 'main', 'ok')
const ctrl = row('ctrl', 'main', 'route matched, controller runs', undefined, 'ok')
const uwBack = row('resp', 'main', 'controller result', 'client', 'ok')

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    request: { rows: [request], line: null, output: resp('?', 'muted') },
    predicate: { rows: [request, row('into', 'fork', 'true', 'branch')], line: L.PREDICATE, output: resp('?', 'muted') },
    result: {
      rows: [request, row('into', 'fork', 'true', 'branch'), row('b', 'branch', '?', undefined, 'muted'), row('m', 'main', '?', undefined, 'muted')],
      line: L.ALL,
      output: resp('404 Not Found'),
    },
  }),
  fork: spec({ request: R.request, predicate: R.predicate, key: R.key, 'branch-end': R.branchEnd, response: R.response }),
  'use-when': spec(
    {
      predicate: { rows: [request, uwInto], line: L.PREDICATE, output: WAITING },
      key: { rows: [request, uwInto, key], line: L.BRANCH, output: WAITING },
      rejoin: { rows: [request, uwInto, key, rejoin, ctrl], line: L.MAIN, output: WAITING },
      response: { rows: [request, uwInto, key, rejoin, ctrl, uwBack], line: null, output: resp('from the controller', 'ok') },
    },
    'UseWhen',
    USE_WHEN,
  ),

  'path-stripped-claim': spec({
    predicate: { rows: [request, row('into', 'fork', 'true: Path /orders', 'branch', 'bad')], line: L.PREDICATE, bad: true, output: WAITING },
    routes: {
      rows: [request, row('into', 'fork', 'true: Path /orders', 'branch', 'bad'), row('on', 'branch', 'Path /orders', 'main', 'bad'), row('nomatch', 'main', 'no route matches: 404', undefined, 'bad')],
      line: L.MAIN,
      bad: true,
      output: resp('404 Not Found', 'bad'),
    },
  }),
  'path-stripped-reality': spec({
    predicate: { ...R.predicate, rows: [request, row('into', 'fork', 'true: Path /api/orders', 'branch', 'ok')] },
    routes: { rows: [request, row('into', 'fork', 'true: Path /api/orders', 'branch', 'ok'), key, end, never], line: L.MAIN, output: resp('404 Not Found', 'bad') },
  }),

  'after-endpoints-claim': spec(
    {
      move: { rows: [row('req', 'client', 'GET /api/orders', 'main')], line: L.ALL, output: WAITING },
      match: { rows: [row('req', 'client', 'GET /api/orders', 'main'), row('ctrl', 'main', 'controller matched first, runs', undefined, 'bad'), row('resp', 'main', 'works', 'client', 'bad')], line: [0, 1], bad: true, output: resp('from the controller', 'bad') },
    },
    'MapWhen',
    MOVED,
  ),
  'after-endpoints-reality': spec(
    {
      move: { rows: [row('req', 'client', 'GET /api/orders', 'main'), row('route', 'main', 'UseRouting: endpoint chosen, not run yet')], line: [0, 1], output: WAITING },
      match: {
        rows: [
          row('req', 'client', 'GET /api/orders', 'main'),
          row('route', 'main', 'UseRouting: endpoint chosen, not run yet'),
          row('next', 'main', 'next: the fork', 'fork'),
          row('into', 'fork', 'true', 'branch'),
          row('key', 'branch', 'key ok: next(ctx), branch ends'),
          row('never', 'main', 'controller never runs', undefined, 'skip'),
        ],
        line: [2, 3],
        output: resp('not from the controller', 'bad'),
      },
    },
    'MapWhen',
    MOVED,
  ),

  'registration-claim': spec({
    skip: { rows: [request, row('into', 'fork', 'true', 'branch'), row('key', 'branch', 'skipped: not registered', undefined, 'skip')], line: L.BRANCH, bad: true, output: WAITING },
    result: {
      rows: [request, row('into', 'fork', 'true', 'branch'), row('key', 'branch', 'skipped: not registered', undefined, 'skip'), row('resp', 'branch', '404 because skipped', 'client', 'bad')],
      line: L.BRANCH,
      bad: true,
      output: resp('404 Not Found', 'bad'),
    },
  }),
  'registration-reality': spec({
    skip: { rows: [request, row('into', 'fork', 'true', 'branch'), row('key', 'branch', 'runs: key ok, next(ctx)', undefined, 'ok')], line: L.BRANCH, output: WAITING },
    result: {
      rows: [request, row('into', 'fork', 'true', 'branch'), row('key', 'branch', 'runs: key ok, next(ctx)'), end, never, back],
      line: L.MAIN,
      output: resp('404 Not Found', 'bad'),
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
