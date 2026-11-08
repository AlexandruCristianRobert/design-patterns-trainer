import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'builder.Services.AddRateLimiter(o => o',
  '    .AddFixedWindowLimiter("fixed", w =>',
  '    {',
  '        w.PermitLimit = 2;',
  '        w.Window = TimeSpan.FromSeconds(10);',
  '    }));',
  '…',
  'app.UseRateLimiter();',
  'app.MapGet("/orders", GetOrders).RequireRateLimiting("fixed");',
]
const FIX_CODE = [
  'builder.Services.AddRateLimiter(o =>',
  '{',
  '    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;',
  '    o.OnRejected = (ctx, _) =>',
  '    {',
  '        ctx.HttpContext.Response.Headers.RetryAfter = "10";',
  '        return ValueTask.CompletedTask;',
  '    };',
  '    o.AddFixedWindowLimiter("fixed", w => { /* as before */ });',
  '});',
]
const L = { POLICY: [0, 5] as [number, number], PERMITS: 3, USE: 7, ALL: [0, 8] as [number, number] }

const actors: SeqSpec['actors'] = [
  { id: 'client', name: 'Client', tone: 'ui' },
  { id: 'lim', name: 'Limiter', sub: 'middleware', tone: 'pool' },
  { id: 'ep', name: 'Endpoint', tone: 'io' },
]
const spec = (steps: Record<string, SeqStep>, code = CODE): SeqSpec => ({ actors, code, outputName: 'Request 3', steps })

const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind'], both = false): SeqRow => ({ key, from, to, label, kind, both })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const res = (...lines: [label: string, text: string, kind?: OutLine['kind']][]): OutLine[] => lines.map(([label, text, kind]) => ({ label, text, kind }))

const SERVED = [msg('r1', 'client', 'ep', 'request 1: 200', 'muted', true), msg('r2', 'client', 'ep', 'request 2: 200', 'muted', true)]
const R3 = msg('r3', 'client', 'lim', 'request 3')
const NO_PERMIT = note('permit', 'lim', 'no permit left')
const ARRIVES = [...SERVED, R3, NO_PERMIT]
const NO_QUEUE = note('queue', 'lim', 'QueueLimit 0', 'bad')
const R503 = msg('res', 'lim', 'client', '503 Service Unavailable', 'bad')
const S503 = res(['Status', '503 Service Unavailable', 'bad'])
const REJECTED = [...ARRIVES, NO_QUEUE, R503, note('ep', 'ep', 'not run', 'muted')]

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    policy: { rows: SERVED, line: L.POLICY },
    third: { rows: [...SERVED, R3, msg('res', 'lim', 'client', '?', 'muted')], line: L.ALL },
  }),

  reject: spec({
    permits: { rows: ARRIVES, line: L.PERMITS },
    queue: { rows: [...ARRIVES, NO_QUEUE], line: L.POLICY },
    status: { rows: REJECTED, line: L.USE, output: S503 },
    reads: { rows: [...REJECTED, note('reads', 'client', 'server unhealthy?', 'bad')], line: L.USE, output: S503 },
  }),
  fix: spec(
    {
      status: { rows: [...ARRIVES, msg('res', 'lim', 'client', '429 Too Many Requests', 'ok')], line: 2, output: res(['Status', '429 Too Many Requests', 'ok']) },
      retry: {
        rows: [...ARRIVES, msg('res', 'lim', 'client', '429 + Retry-After: 10', 'ok')],
        line: [3, 7],
        output: res(['Status', '429 Too Many Requests', 'ok'], ['Retry-After', '10', 'ok']),
      },
    },
    FIX_CODE,
  ),

  'always-claim': spec({
    permits: { rows: ARRIVES, line: L.PERMITS },
    status: { rows: [...ARRIVES, msg('res', 'lim', 'client', '429 Too Many Requests', 'bad')], line: L.ALL, bad: true, output: res(['Status', '429 Too Many Requests', 'bad']) },
  }),
  'always-reality': spec({
    permits: { rows: ARRIVES, line: L.PERMITS },
    status: { rows: [...ARRIVES, R503], line: L.ALL, output: [...S503, { label: 'Why', text: 'RejectionStatusCode not set' }] },
  }),

  'queue-claim': spec({
    permits: { rows: ARRIVES, line: L.PERMITS },
    wait: {
      rows: [...ARRIVES, note('queue', 'lim', 'queued', 'bad'), msg('run', 'lim', 'ep', 'next window'), msg('res', 'ep', 'client', '200 OK')],
      line: L.POLICY,
      bad: true,
      output: res(['Status', '200 OK, later', 'bad']),
    },
  }),
  'queue-reality': spec({
    permits: { rows: ARRIVES, line: L.PERMITS },
    wait: { rows: REJECTED, line: L.POLICY, output: S503 },
  }),

  'auth-claim': spec({
    inside: { rows: [...ARRIVES, note('authz', 'lim', 'part of authz', 'bad')], line: L.USE, bad: true },
    status: { rows: [...ARRIVES, note('authz', 'lim', 'part of authz', 'bad'), msg('res', 'lim', 'client', '403 Forbidden', 'bad')], line: L.USE, bad: true, output: res(['Status', '403 Forbidden', 'bad']) },
  }),
  'auth-reality': spec({
    inside: { rows: [...ARRIVES, note('authz', 'lim', 'own middleware', 'ok')], line: L.USE },
    status: { rows: [...ARRIVES, note('authz', 'lim', 'own middleware', 'ok'), R503], line: L.USE, output: S503 },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
