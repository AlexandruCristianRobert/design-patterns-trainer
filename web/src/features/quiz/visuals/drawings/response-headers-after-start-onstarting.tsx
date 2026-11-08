import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const SET = '    ctx.Response.Headers["X-Elapsed-Ms"] = sw.ElapsedMilliseconds.ToString();'
const ENDPOINT = 'app.MapGet("/orders", () => orders); // a JSON body'
const CODE = ['app.Use(async (ctx, next) =>', '{', '    var sw = Stopwatch.StartNew();', '    await next(ctx);', SET, '});', ENDPOINT]
const FIX_CODE = [
  'app.Use(async (ctx, next) =>',
  '{',
  '    var sw = Stopwatch.StartNew();',
  '    ctx.Response.OnStarting(() =>',
  '    {',
  `    ${SET}`,
  '        return Task.CompletedTask;',
  '    });',
  '    await next(ctx);',
  '});',
  ENDPOINT,
]
const PLACEHOLDER_CODE = ['app.Use(async (ctx, next) =>', '{', '    var sw = Stopwatch.StartNew();', '    ctx.Response.Headers["X-Elapsed-Ms"] = "0";', '    await next(ctx);', SET, '});', ENDPOINT]
const L = { START: [2, 3] as [number, number], NEXT: 3, SET: 4, ENDPOINT: 6 }
const F = { REGISTER: [3, 7] as [number, number], CALLBACK: 5, NEXT: 8, ENDPOINT: 10 }
const P = { PLACEHOLDER: 3, NEXT: 4, SET: 5, ENDPOINT: 7 }

const actors: SeqSpec['actors'] = [
  { id: 'client', name: 'Client', tone: 'muted' },
  { id: 'mw', name: 'Timing', sub: 'middleware', tone: 'ui' },
  { id: 'end', name: 'Endpoint', sub: 'JSON body', tone: 'pool' },
]
const spec = (steps: Record<string, SeqStep>, code = CODE): SeqSpec => ({ actors, code, outputName: 'Outcome', steps })

const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const request = row('req', 'client', 'GET /orders', 'mw')
const stopwatch = row('sw', 'mw', 'start stopwatch')
const next = row('next', 'mw', 'next(ctx)', 'end')
const writes = row('write', 'end', 'writes JSON')
const headersOut = row('headers', 'end', 'status + headers', 'client')
const bodyOut = row('body', 'end', 'JSON body', 'client')
const returns = row('ret', 'end', 'returns', 'mw')
const setThrows = row('set', 'mw', 'set header: throws', undefined, 'bad')
const START = [request, stopwatch, next]
const STARTED = [...START, writes, headersOut, bodyOut]

const outcome = (header: string, client: string, hk: OutLine['kind'] = 'plain', ck: OutLine['kind'] = 'plain'): OutLine[] => [
  { label: 'Setting the header', text: header, kind: header === '?' || header === '…' ? 'muted' : hk },
  { label: 'Client gets', text: client, kind: client === '?' || client === '…' ? 'muted' : ck },
]
const THREW = outcome('InvalidOperationException', 'headers without X-Elapsed-Ms', 'bad', 'bad')

/** The real run of the question's middleware. */
const R = {
  request: { rows: START, line: L.START, output: outcome('…', '…') },
  body: { rows: STARTED, line: L.ENDPOINT, output: outcome('…', 'headers, then the body') },
  return: { rows: [...STARTED, returns, row('ro', 'mw', 'headers read-only', undefined, 'muted')], line: L.NEXT, output: outcome('…', 'headers, then the body') },
  header: { rows: [...STARTED, returns, row('ro', 'mw', 'headers read-only', undefined, 'muted'), setThrows], line: L.SET, bad: true, output: THREW },
} satisfies Record<string, SeqStep>

const callback = row('cb', 'mw', 'OnStarting: adds header', undefined, 'ok')
const ON_START = [request, stopwatch, row('reg', 'mw', 'register OnStarting'), next]

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    request: { rows: START, line: L.START, output: outcome('…', '…') },
    endpoint: { rows: [...START, row('write', 'end', 'writes JSON body'), returns], line: L.ENDPOINT, output: outcome('…', '…') },
    header: { rows: [...START, row('write', 'end', 'writes JSON body'), returns, row('set', 'mw', 'set X-Elapsed-Ms')], line: L.SET, output: outcome('?', '?') },
  }),
  'too-late': spec({ request: R.request, body: R.body, return: R.return, header: R.header }),
  'on-starting': spec(
    {
      register: { rows: ON_START, line: F.REGISTER, output: outcome('…', '…') },
      body: { rows: [...ON_START, writes, callback], line: F.CALLBACK, output: outcome('in time', '…', 'ok') },
      sent: {
        rows: [...ON_START, writes, callback, row('headers', 'end', 'headers + X-Elapsed-Ms', 'client', 'ok'), bodyOut, returns],
        line: F.ENDPOINT,
        output: outcome('in time', 'X-Elapsed-Ms, then the body', 'ok', 'ok'),
      },
    },
    FIX_CODE,
  ),

  'trailer-claim': spec({
    header: { rows: [...STARTED, returns, row('set', 'mw', 'set header: trailer', undefined, 'bad')], line: L.SET, bad: true, output: outcome('becomes a trailer', '…', 'bad') },
    client: {
      rows: [...STARTED, returns, row('set', 'mw', 'set header: trailer', undefined, 'bad'), row('trailer', 'mw', 'trailer: X-Elapsed-Ms', 'client', 'bad')],
      line: L.SET,
      bad: true,
      output: outcome('becomes a trailer', 'X-Elapsed-Ms as a trailer', 'bad', 'bad'),
    },
  }),
  'trailer-reality': spec({
    header: { rows: [...STARTED, returns, setThrows], line: L.SET, bad: true, output: outcome('InvalidOperationException', '…', 'bad') },
    client: { rows: [...STARTED, returns, setThrows, row('trailer', 'mw', 'no trailer', 'client', 'skip')], line: L.SET, bad: true, output: THREW },
  }),

  'buffered-claim': spec({
    body: { rows: [...START, row('write', 'end', 'writes JSON: buffered', undefined, 'bad')], line: L.ENDPOINT, bad: true, output: outcome('…', 'nothing yet', 'plain', 'bad') },
    header: {
      rows: [...START, row('write', 'end', 'writes JSON: buffered', undefined, 'bad'), returns, row('set', 'mw', 'adds header', undefined, 'bad')],
      line: L.SET,
      bad: true,
      output: outcome('works', 'nothing yet', 'bad', 'bad'),
    },
    send: {
      rows: [...START, row('write', 'end', 'writes JSON: buffered', undefined, 'bad'), returns, row('set', 'mw', 'adds header', undefined, 'bad'), row('all', 'mw', 'headers + X-Elapsed-Ms + body', 'client', 'bad')],
      line: L.SET,
      bad: true,
      output: outcome('works', 'X-Elapsed-Ms', 'bad', 'bad'),
    },
  }),
  'buffered-reality': spec({
    body: { rows: STARTED, line: L.ENDPOINT, output: outcome('…', 'headers, then the body') },
    header: { rows: [...STARTED, returns, setThrows], line: L.SET, bad: true, output: outcome('InvalidOperationException', 'headers, then the body', 'bad') },
    send: { rows: [...STARTED, returns, setThrows], line: L.SET, bad: true, output: THREW },
  }),

  'dropped-claim': spec({
    header: { rows: [...STARTED, returns, row('set', 'mw', 'set header: ignored', undefined, 'bad')], line: L.SET, bad: true, output: outcome('silently ignored', '…', 'bad') },
    fix: {
      rows: [
        request,
        row('ph', 'mw', 'set placeholder'),
        row('next', 'mw', 'next(ctx)', 'end'),
        row('write', 'end', 'writes JSON'),
        returns,
        row('set', 'mw', 'overwrite it', undefined, 'bad'),
      ],
      line: P.SET,
      bad: true,
      code: PLACEHOLDER_CODE,
      output: outcome('overwrite works', '…', 'bad'),
    },
  }),
  'dropped-reality': spec({
    header: { rows: [...STARTED, returns, setThrows], line: L.SET, bad: true, output: THREW },
    fix: {
      rows: [
        request,
        row('ph', 'mw', 'set placeholder'),
        row('next', 'mw', 'next(ctx)', 'end'),
        row('write', 'end', 'writes JSON'),
        row('headers', 'end', 'headers: placeholder', 'client'),
        bodyOut,
        returns,
        row('set', 'mw', 'overwrite: throws', undefined, 'bad'),
      ],
      line: P.SET,
      bad: true,
      code: PLACEHOLDER_CODE,
      output: outcome('InvalidOperationException', 'the placeholder "0"', 'bad', 'bad'),
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
