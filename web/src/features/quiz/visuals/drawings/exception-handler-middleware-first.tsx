import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const FIRST = [
  'app.UseExceptionHandler("/error");',
  'app.UseAuthorization();',
  'app.MapGet("/orders", () => LoadOrders());',
  '',
  '// inside the exception handler, roughly',
  'try { await next(ctx); }',
  'catch { /* re-execute "/error": 500 */ }',
]
const F = { HANDLER: 0, ALL: [0, 2] as [number, number], ENDPOINT: [1, 2] as [number, number], MAP: 2, TRY: 5, CATCH: 6 }
const LATE = ['app.UseMiddleware<TenantMiddleware>();', 'app.UseExceptionHandler("/error");', 'app.MapGet("/orders", () => LoadOrders());']
const HOSTED = [
  'builder.Services.AddHostedService<CleanupService>();',
  'var app = builder.Build();',
  'app.UseExceptionHandler("/error");',
  'app.MapGet("/orders", () => LoadOrders());',
]

const CLIENT: SeqActor = { id: 'client', name: 'Client', tone: 'muted' }
const HANDLER: SeqActor = { id: 'handler', name: 'Exception handler', tone: 'ui' }
const AUTH: SeqActor = { id: 'auth', name: 'Auth', sub: 'authorization', tone: 'pool' }
const TENANT: SeqActor = { id: 'tenant', name: 'Tenant', sub: 'middleware', tone: 'pool' }
const ENDPOINT: SeqActor = { id: 'end', name: 'Endpoint', sub: 'GET /orders', tone: 'io' }
const CLEANUP: SeqActor = { id: 'cleanup', name: 'Cleanup', sub: 'hosted service', tone: 'muted' }

const spec = (actors: SeqActor[], code: string[], steps: Record<string, SeqStep>): SeqSpec => ({ actors, code, outputName: 'Outcome', steps })
const firstSpec = (steps: Record<string, SeqStep>) => spec([CLIENT, HANDLER, AUTH, ENDPOINT], FIRST, steps)
const lateSpec = (steps: Record<string, SeqStep>) => spec([CLIENT, TENANT, HANDLER, ENDPOINT], LATE, steps)
const hostedSpec = (steps: Record<string, SeqStep>) => spec([CLIENT, HANDLER, ENDPOINT, CLEANUP], HOSTED, steps)

const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const resp = (text: string, kind: OutLine['kind'] = 'plain'): OutLine => ({ label: 'Response', text, kind })
const PENDING = [resp('…', 'muted')]

// Handler registered first.
const req = row('req', 'client', 'GET /orders', 'handler')
const tryNext = row('try', 'handler', 'try { next }', 'auth')
const next2 = row('next2', 'auth', 'next', 'end')
const thr = row('thr', 'end', 'throws', undefined, 'bad')
const up1 = row('up1', 'end', 'exception', 'auth', 'bad')
const up2 = row('up2', 'auth', 'exception', 'handler', 'bad')
const caught = row('caught', 'handler', 'catch: /error', undefined, 'ok')
const answered = row('resp', 'handler', '500 from /error', 'client', 'ok')
const A = {
  request: { rows: [req], line: F.HANDLER, output: PENDING },
  wraps: { rows: [req, tryNext], line: F.TRY, output: PENDING },
  endpoint: { rows: [req, tryNext, next2], line: F.ENDPOINT, output: PENDING },
  throws: { rows: [req, tryNext, next2, thr], line: F.MAP, bad: true, output: PENDING },
  caught: { rows: [req, tryNext, next2, thr, up1, up2, caught], line: F.CATCH, output: PENDING },
  response: { rows: [req, tryNext, next2, thr, up1, up2, caught, answered], line: F.CATCH, output: [resp('500 error page from /error', 'ok')] },
} satisfies Record<string, SeqStep>

// Handler registered after a middleware that throws.
const lateReq = row('req', 'client', 'GET /orders', 'tenant')
const lateThr = row('thr', 'tenant', 'throws before next', undefined, 'bad')
const lateMissed = [row('h', 'handler', 'never runs', undefined, 'skip'), row('e', 'end', 'never runs', undefined, 'skip'), row('out', 'tenant', 'unhandled exception', 'client', 'bad')]
const UNHANDLED = [resp('unhandled exception, no /error page', 'bad')]
const LATE_STEPS = {
  request: { rows: [lateReq], line: 0, output: PENDING },
  throws: { rows: [lateReq, lateThr], line: 0, bad: true, output: PENDING },
  missed: { rows: [lateReq, lateThr, ...lateMissed], line: 1, output: UNHANDLED },
} satisfies Record<string, SeqStep>
const registered = (first: string, second: string, third: string, kind: SeqRow['kind'] = 'plain') => [
  row('r1', first, 'registered 1st', undefined, kind),
  row('r2', second, 'registered 2nd', undefined, kind),
  row('r3', third, 'registered 3rd', undefined, kind),
]

const SPECS: Record<string, SeqSpec> = {
  // Setup: only the registrations, not how the handler wraps next (that is the answer).
  setup: spec([CLIENT, HANDLER, AUTH, ENDPOINT], FIRST.slice(0, 3), {
    registered: { rows: registered('handler', 'auth', 'end'), line: F.ALL, output: [resp('?', 'muted')] },
    throws: {
      rows: [row('r1', 'handler', '1st: may throw', undefined, 'muted'), row('r2', 'auth', '2nd: may throw', undefined, 'muted'), row('r3', 'end', '3rd: may throw', undefined, 'muted')],
      line: F.ALL,
      output: [resp('?', 'muted')],
    },
    question: {
      rows: [row('r1', 'handler', '1st: why?'), row('r2', 'auth', '2nd: may throw', undefined, 'muted'), row('r3', 'end', '3rd: may throw', undefined, 'muted')],
      line: F.HANDLER,
      output: [resp('?', 'muted')],
    },
  }),
  'handler-first': firstSpec(A),
  'handler-late': lateSpec(LATE_STEPS),

  'reverse-order-claim': firstSpec({
    order: { rows: [row('req', 'client', 'GET /orders', 'auth', 'bad'), row('back', 'auth', 'next', 'handler', 'bad')], line: [0, 1], output: PENDING },
    last: {
      rows: [row('req', 'client', 'GET /orders', 'auth', 'bad'), row('back', 'auth', 'next', 'handler', 'bad'), row('last', 'handler', 'runs last: sees every exception', undefined, 'bad')],
      line: F.HANDLER,
      output: PENDING,
    },
  }),
  'reverse-order-reality': firstSpec({
    order: { rows: [req, tryNext, next2], line: [0, 1], output: PENDING },
    throws: A.throws,
    last: A.response,
  }),

  'sorted-claim': lateSpec({
    misplaced: { rows: registered('tenant', 'handler', 'end'), line: [0, 1], output: [{ label: 'Startup', text: '?', kind: 'muted' }] },
    startup: {
      rows: [...registered('tenant', 'handler', 'end'), row('check', 'handler', 'not first: startup fails', undefined, 'bad')],
      line: 1,
      bad: true,
      output: [{ label: 'Startup', text: 'sorted by priority, then fails', kind: 'bad' }],
    },
  }),
  'sorted-reality': lateSpec({
    misplaced: { rows: registered('tenant', 'handler', 'end'), line: [0, 1], output: [{ label: 'Startup', text: '?', kind: 'muted' }] },
    startup: { rows: registered('tenant', 'handler', 'end'), line: [0, 2], output: [{ label: 'Startup', text: 'built in Use… order, app starts', kind: 'ok' }] },
    request: { ...LATE_STEPS.missed, output: [{ label: 'Startup', text: 'built in Use… order, app starts', kind: 'ok' }, ...UNHANDLED] },
  }),

  'hosted-service-claim': hostedSpec({
    throws: { rows: [row('thr', 'cleanup', 'throws', undefined, 'bad')], line: 0, output: [{ label: 'Exception', text: '?', kind: 'muted' }] },
    caught: {
      rows: [row('thr', 'cleanup', 'throws', undefined, 'bad'), row('to', 'cleanup', 'exception', 'handler', 'bad'), row('caught', 'handler', 'catch: /error', undefined, 'bad')],
      line: 2,
      output: [{ label: 'Exception', text: 'caught by the exception handler', kind: 'bad' }],
    },
  }),
  'hosted-service-reality': hostedSpec({
    throws: { rows: [row('thr', 'cleanup', 'throws', undefined, 'bad')], line: 0, output: [{ label: 'Exception', text: '?', kind: 'muted' }] },
    caught: {
      rows: [row('thr', 'cleanup', 'throws', undefined, 'bad'), row('none', 'handler', 'never sees it', undefined, 'skip'), row('host', 'cleanup', 'logged by the host', undefined, 'ok')],
      line: 0,
      output: [{ label: 'Exception', text: 'outside any request: host logs it, app stops', kind: 'ok' }],
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
