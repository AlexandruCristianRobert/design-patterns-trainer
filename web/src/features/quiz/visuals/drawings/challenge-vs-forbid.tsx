import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'builder.Services.AddAuthentication().AddJwtBearer();',
  'builder.Services.AddAuthorization();',
  '',
  'app.MapGet("/admin", () => …)',
  '   .RequireAuthorization(p => p.RequireRole("Admin"));',
]
const COOKIE = [
  'builder.Services.AddAuthentication().AddCookie(o =>',
  '{',
  '    o.LoginPath = "/Account/Login";',
  '    o.AccessDeniedPath = "/Account/AccessDenied";',
  '});',
  '',
  'app.MapGet("/admin", () => …)',
  '   .RequireAuthorization(p => p.RequireRole("Admin"));',
]
const L = { AUTH: 0, ENDPOINT: [3, 4] as [number, number] }

const ACTORS: SeqActor[] = [
  { id: 'anon', name: 'Anon', sub: 'no token', tone: 'ui' },
  { id: 'user', name: 'Non-admin', sub: 'valid token', tone: 'ui' },
  { id: 'mw', name: 'AuthZ', sub: 'middleware', tone: 'pool' },
  { id: 'ep', name: '/admin', sub: 'Admin role', tone: 'io' },
]
const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const spec = (steps: Record<string, SeqStep>, code = CODE): SeqSpec => ({ actors: ACTORS, code, steps })

const ROLE = row('role', 'ep', 'needs Admin')
const A_REQ = row('areq', 'anon', 'GET /admin', 'mw')
const U_REQ = row('ureq', 'user', 'GET /admin', 'mw')
const ANON = [A_REQ, row('anot', 'mw', 'not signed in'), row('a401', 'mw', 'Challenge: 401', 'anon', 'ok'), row('www', 'anon', 'WWW-Auth: Bearer')]
const USER = [U_REQ, row('unot', 'mw', 'signed in, no Admin'), row('u403', 'mw', 'Forbid: 403', 'user', 'ok')]
const NEVER = row('never', 'ep', 'never runs', undefined, 'skip')
/** A claim's answer arrow: neutral, only the status the claim names. */
const answer = (key: string, to: string, label: string): SeqRow => row(key, 'mw', label, to)

const SPECS: Record<string, SeqSpec> = {
  // ---- Setup: the two requests arrive; no answers drawn ----
  setup: spec({
    endpoint: { rows: [ROLE], line: { each: [L.AUTH, L.ENDPOINT] } },
    callers: { rows: [ROLE, A_REQ, U_REQ], line: L.ENDPOINT },
    ask: { rows: [ROLE, A_REQ, U_REQ, row('q', 'mw', '?', undefined, 'muted')], line: L.ENDPOINT },
  }),

  outcomes: spec({
    anon: { rows: [ROLE, ...ANON], line: L.AUTH },
    user: { rows: [ROLE, ...ANON, ...USER], line: L.ENDPOINT },
    endpoint: { rows: [ROLE, ...ANON, ...USER, NEVER], line: L.ENDPOINT },
  }),
  cookie: spec(
    {
      anon: { rows: [ROLE, A_REQ, row('a302', 'mw', 'Challenge: 302 Login', 'anon', 'ok')], line: 2 },
      user: {
        rows: [ROLE, A_REQ, row('a302', 'mw', 'Challenge: 302 Login', 'anon', 'ok'), U_REQ, row('u302', 'mw', 'Forbid: 302 Denied', 'user', 'ok')],
        line: 3,
      },
    },
    COOKIE,
  ),

  'both401-claim': spec({
    rule: { rows: [ROLE, A_REQ, U_REQ, row('rule', 'mw', 'fail = not signed in')], line: L.ENDPOINT },
    both: { rows: [ROLE, A_REQ, U_REQ, row('rule', 'mw', 'fail = not signed in'), answer('a', 'anon', '401'), answer('u', 'user', '401')], line: L.ENDPOINT },
  }),
  'both401-reality': spec({
    anon: { rows: [ROLE, ...ANON], line: L.ENDPOINT },
    user: { rows: [ROLE, ...ANON, U_REQ, row('unot', 'mw', 'signed in, no Admin'), row('no401', 'mw', '401 would not help', undefined, 'bad'), row('u403', 'mw', 'Forbid: 403', 'user', 'ok')], line: L.ENDPOINT },
  }),

  'both403-claim': spec({
    rule: { rows: [ROLE, A_REQ, U_REQ, row('rule', 'mw', 'role check: authZ only')], line: L.ENDPOINT },
    both: { rows: [ROLE, A_REQ, U_REQ, row('rule', 'mw', 'role check: authZ only'), answer('a', 'anon', '403'), answer('u', 'user', '403')], line: L.ENDPOINT },
  }),
  'both403-reality': spec({
    anon: { rows: [ROLE, ...ANON], line: L.ENDPOINT },
    user: { rows: [ROLE, ...ANON, ...USER], line: L.ENDPOINT },
  }),

  'swap-claim': spec({
    anon: { rows: [ROLE, A_REQ, answer('a', 'anon', '403')], line: L.ENDPOINT },
    user: { rows: [ROLE, A_REQ, answer('a', 'anon', '403'), U_REQ, answer('u', 'user', '401'), row('other', 'user', 'log in as another')], line: L.ENDPOINT },
  }),
  'swap-reality': spec({
    anon: { rows: [ROLE, ...ANON], line: L.ENDPOINT },
    user: { rows: [ROLE, ...ANON, ...USER], line: L.ENDPOINT },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
