import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'app.MapGet("/items", () => { log("handler"); return "ok"; })',
  '   .AddEndpointFilter(async (ctx, next) =>',
  '   { log("A in"); var r = await next(ctx); log("A out"); return r; })',
  '   .AddEndpointFilter(async (ctx, next) =>',
  '   { log("B in"); var r = await next(ctx); log("B out"); return r; });',
]
const L = { HANDLER: 0, A: [1, 2] as [number, number], B: [3, 4] as [number, number], FILTERS: [1, 4] as [number, number], ALL: [0, 4] as [number, number] }

const REQ: SeqActor = { id: 'req', name: 'Request', tone: 'muted' }
const A: SeqActor = { id: 'a', name: 'Filter A', sub: 'added 1st', tone: 'pool' }
const B: SeqActor = { id: 'b', name: 'Filter B', sub: 'added 2nd', tone: 'pool' }
const H: SeqActor = { id: 'h', name: 'Handler', tone: 'ok' }
const FILTERS: SeqActor = { id: 'f', name: 'Filters', sub: 'A and B', tone: 'pool' }

const spec = (steps: Record<string, SeqStep>, actors = [REQ, A, B, H]): SeqSpec => ({ actors, code: CODE, outputName: 'Log', steps })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const ASK: OutLine[] = [{ label: '1–5', text: '?', kind: 'muted' }]
const TRUE_ORDER = ['A in', 'B in', 'handler', 'B out', 'A out']
/** One output line per log entry. ok: the full, true order · bad: a claim's lines that are out of place (only those turn red). */
const log = (lines: string[], kind: 'plain' | 'ok' | 'bad' = 'plain'): OutLine[] =>
  lines.length
    ? lines.map((text, i) => ({ label: String(i + 1), text, kind: kind === 'bad' ? (TRUE_ORDER[i] === text ? 'plain' : 'bad') : kind }))
    : [{ label: '1', text: '…', kind: 'muted' }]

// ---- Reality: A outermost ----
const get = msg('get', 'req', 'a', 'GET /items')
const aIn = note('a-in', 'a', 'A in')
const aNext = msg('a-next', 'a', 'b', 'next(ctx)')
const bIn = note('b-in', 'b', 'B in')
const bNext = msg('b-next', 'b', 'h', 'next(ctx)')
const hLog = note('h-log', 'h', 'handler')
const hRet = msg('h-ret', 'h', 'b', '"ok"')
const bOut = note('b-out', 'b', 'B out', 'ok')
const bRet = msg('b-ret', 'b', 'a', 'r')
const aOut = note('a-out', 'a', 'A out', 'ok')
const resp = msg('resp', 'a', 'req', '200 ok')

const IN = [get, aIn, aNext, bIn, bNext, hLog]
const R = {
  'a-in': { rows: [get, aIn], line: L.A, output: log(['A in']) },
  'b-in': { rows: [get, aIn, aNext, bIn], line: L.B, output: log(['A in', 'B in']) },
  handler: { rows: IN, line: L.HANDLER, output: log(['A in', 'B in', 'handler']) },
  'b-out': { rows: [...IN, hRet, bOut], line: L.B, output: log(['A in', 'B in', 'handler', 'B out']) },
  'a-out': { rows: [...IN, hRet, bOut, bRet, aOut, resp], line: L.A, output: log(['A in', 'B in', 'handler', 'B out', 'A out'], 'ok') },
} satisfies Record<string, SeqStep>

// ---- Claim B: B outermost ----
const cGet = msg('get', 'req', 'b', 'GET /items', 'bad')
const cBIn = note('b-in', 'b', 'B in', 'bad')
const cBNext = msg('b-next', 'b', 'a', 'next(ctx)', 'bad')
const cAIn = note('a-in', 'a', 'A in')
const cHandler = [msg('a-next', 'a', 'h', 'next(ctx)'), hLog, msg('h-ret', 'h', 'a', '"ok"'), note('a-out', 'a', 'A out'), msg('a-ret', 'a', 'b', 'r'), note('b-out', 'b', 'B out')]

// ---- Claim C: one after another ----
const sA = [msg('get', 'req', 'a', 'GET /items'), note('a-in', 'a', 'A in'), note('a-out', 'a', 'A out', 'bad')]
const sB = [msg('then-b', 'req', 'b', 'then B', 'bad'), note('b-in', 'b', 'B in'), note('b-out', 'b', 'B out', 'bad')]
const sH = [msg('then-h', 'req', 'h', 'then handler', 'bad'), note('h-log', 'h', 'handler')]

const SPECS: Record<string, SeqSpec> = {
  setup: spec(
    {
      endpoint: { rows: [], line: L.HANDLER, output: ASK },
      filters: { rows: [], line: L.FILTERS, output: ASK },
      request: { rows: [msg('get', 'req', 'f', 'GET /items'), note('order', 'f', '?', 'muted'), note('h', 'h', '?', 'muted')], line: L.ALL, output: ASK },
    },
    [REQ, FILTERS, H],
  ),
  onion: spec(R),

  'outside-claim': spec({
    first: { rows: [cGet, cBIn], line: L.B, bad: true, output: log(['B in'], 'bad') },
    second: { rows: [cGet, cBIn, cBNext, cAIn], line: L.A, output: log(['B in', 'A in'], 'bad') },
    out: { rows: [cGet, cBIn, cBNext, cAIn, ...cHandler], line: L.ALL, output: log(['B in', 'A in', 'handler', 'A out', 'B out'], 'bad') },
  }),
  'outside-reality': spec({
    first: { rows: [msg('get', 'req', 'a', 'GET /items', 'ok'), aIn], line: L.A, output: log(['A in']) },
    second: { rows: [msg('get', 'req', 'a', 'GET /items', 'ok'), aIn, aNext, bIn], line: L.B, output: log(['A in', 'B in']) },
    out: { rows: [msg('get', 'req', 'a', 'GET /items', 'ok'), ...IN.slice(1), hRet, bOut, bRet, aOut], line: L.ALL, output: log(['A in', 'B in', 'handler', 'B out', 'A out'], 'ok') },
  }),

  'sequential-claim': spec({
    a: { rows: sA, line: L.A, bad: true, output: log(['A in', 'A out'], 'bad') },
    b: { rows: [...sA, ...sB], line: L.B, bad: true, output: log(['A in', 'A out', 'B in', 'B out'], 'bad') },
    handler: { rows: [...sA, ...sB, ...sH], line: L.HANDLER, bad: true, output: log(['A in', 'A out', 'B in', 'B out', 'handler'], 'bad') },
  }),
  'sequential-reality': spec({
    a: { rows: [get, aIn, note('a-wait', 'a', 'awaits next')], line: L.A, output: log(['A in']) },
    b: { rows: [get, aIn, note('a-wait', 'a', 'awaits next'), aNext, bIn, bNext, hLog], line: L.B, output: log(['A in', 'B in', 'handler']) },
    handler: { rows: [get, aIn, note('a-wait', 'a', 'awaits next'), aNext, bIn, bNext, hLog, hRet, bOut, bRet, aOut], line: L.FILTERS, output: log(['A in', 'B in', 'handler', 'B out', 'A out'], 'ok') },
  }),

  'resume-claim': spec({
    in: { rows: IN, line: L.ALL, output: log(['A in', 'B in', 'handler']) },
    out: { rows: [...IN, note('a-out', 'a', 'A out', 'bad'), note('b-out', 'b', 'B out', 'bad')], line: L.FILTERS, bad: true, output: log(['A in', 'B in', 'handler', 'A out', 'B out'], 'bad') },
  }),
  'resume-reality': spec({
    in: { rows: IN, line: L.ALL, output: log(['A in', 'B in', 'handler']) },
    out: { rows: [...IN, hRet, bOut, bRet, aOut], line: L.FILTERS, output: log(['A in', 'B in', 'handler', 'B out', 'A out'], 'ok') },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
