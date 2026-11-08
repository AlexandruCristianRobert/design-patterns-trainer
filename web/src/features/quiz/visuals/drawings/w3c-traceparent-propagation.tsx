import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  '// both services',
  'builder.Services.AddOpenTelemetry()',
  '    .WithTracing(t => t',
  '        .AddAspNetCoreInstrumentation()',
  '        .AddHttpClientInstrumentation());',
  '',
  '// service A',
  'await http.GetAsync("http://service-b/stock");',
]
const L = { OTEL: [1, 4] as [number, number], HTTPCLIENT: 4, ASPNET: 3, CALL: 7 }
const CORRELATION = ['// service A', 'request.Headers.Add("X-Correlation-ID", id);', '', '// service B: a new root activity', '// with TraceId = that header value']

const A: SeqActor = { id: 'a', name: 'Service A', sub: 'HttpClient', tone: 'ui' }
const B: SeqActor = { id: 'b', name: 'Service B', sub: 'ASP.NET Core', tone: 'pool' }
const COL: SeqActor = { id: 'col', name: 'Collector', tone: 'muted' }
const spec = (steps: Record<string, SeqStep>, actors = [A, B], code = CODE): SeqSpec => ({ actors, code, outputName: 'Spans', steps })

const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
type Span = [text: string, kind?: OutLine['kind']]
const spans = (a: Span, b?: Span): OutLine[] => [
  { label: "A's call", text: a[0], kind: a[1] },
  ...(b ? [{ label: "B's span", text: b[0], kind: b[1] }] : []),
]

const TP = 'traceparent: 00-4bf9…-00f0…-01'
const get = msg('get', 'a', 'b', 'GET /stock')
const clientSpan = note('cs', 'a', 'span 00f0…, trace 4bf9…')
const inject = msg('get', 'a', 'b', TP, 'ok')
const serverSpan = note('ss', 'b', 'trace 4bf9…, parent 00f0…', 'ok')
const A_SPAN: Span = ['trace 4bf9…, span 00f0…']
const B_SPAN: Span = ['trace 4bf9…, parent 00f0…', 'ok']
const exportRows = [msg('ea', 'a', 'col', 'export span'), msg('eb', 'b', 'col', 'export span')]

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    call: { rows: [get], line: L.CALL },
    spans: { rows: [note('cs', 'a', 'span for the call'), get, note('ss', 'b', 'server span')], line: L.OTEL, output: spans(['trace ?'], ['trace ?']) },
  }),

  propagate: spec(
    {
      'client-span': { rows: [clientSpan], line: L.HTTPCLIENT, output: spans(A_SPAN) },
      inject: { rows: [clientSpan, inject], line: L.CALL, output: spans(A_SPAN) },
      extract: { rows: [clientSpan, inject, serverSpan], line: L.ASPNET, output: spans(A_SPAN, B_SPAN) },
      export: { rows: [clientSpan, inject, serverSpan, ...exportRows, note('one', 'col', 'one trace: 4bf9…', 'ok')], line: L.OTEL, output: spans(A_SPAN, B_SPAN) },
    },
    [A, B, COL],
  ),

  'collector-claim': spec(
    {
      export: { rows: [get, ...exportRows], line: L.CALL, output: spans(['GET /stock at 10:00:00.120'], ['GET /stock at 10:00:00.125']) },
      match: {
        rows: [get, ...exportRows, note('match', 'col', 'links by time + URL', 'bad')],
        line: L.CALL,
        output: spans(['GET /stock at 10:00:00.120'], ['GET /stock at 10:00:00.125']),
      },
    },
    [A, B, COL],
  ),
  'collector-reality': spec(
    {
      export: { rows: [clientSpan, inject, serverSpan, ...exportRows], line: L.CALL, output: spans(A_SPAN, B_SPAN) },
      match: { rows: [clientSpan, inject, serverSpan, ...exportRows, note('match', 'col', 'groups by trace id', 'ok')], line: L.OTEL, output: spans(A_SPAN, B_SPAN) },
    },
    [A, B, COL],
  ),

  'correlation-claim': spec(
    {
      header: { rows: [msg('get', 'a', 'b', 'X-Correlation-ID: 7c1e…')], line: 1 },
      copy: { rows: [msg('get', 'a', 'b', 'X-Correlation-ID: 7c1e…'), note('root', 'b', 'new root, TraceId = 7c1e…', 'bad')], line: [3, 4] },
    },
    [A, B],
    CORRELATION,
  ),
  'correlation-reality': spec(
    {
      header: { rows: [msg('get', 'a', 'b', 'X-Correlation-ID: 7c1e…'), note('ignored', 'b', 'not read by OpenTelemetry', 'muted')], line: 1 },
      copy: {
        rows: [msg('get', 'a', 'b', 'X-Correlation-ID: 7c1e…'), note('ignored', 'b', 'not read by OpenTelemetry', 'muted'), note('root', 'b', 'root: new trace 9e3a…', 'bad')],
        line: [3, 4],
        output: spans(A_SPAN, ['trace 9e3a…, no parent', 'bad']),
      },
    },
    [A, B],
    CORRELATION,
  ),

  'asynclocal-claim': spec({
    flow: { rows: [note('ctx', 'a', 'AsyncLocal: trace 4bf9…'), msg('flow', 'a', 'b', 'AsyncLocal flows across', 'bad')], line: L.CALL },
    shared: { rows: [note('ctx', 'a', 'AsyncLocal: trace 4bf9…'), msg('flow', 'a', 'b', 'AsyncLocal flows across', 'bad'), note('ss', 'b', 'trace 4bf9…')], line: L.CALL },
  }),
  'asynclocal-reality': spec({
    flow: { rows: [note('ctx', 'a', 'AsyncLocal: trace 4bf9…'), msg('flow', 'a', 'b', 'AsyncLocal never crosses', 'skip')], line: L.CALL },
    shared: { rows: [note('ctx', 'a', 'AsyncLocal: trace 4bf9…'), msg('flow', 'a', 'b', 'AsyncLocal never crosses', 'skip'), inject, serverSpan], line: L.CALL, output: spans(A_SPAN, B_SPAN) },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
