import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const code = (first: string, second: string) => [
  'builder.Services.AddAuthentication().AddJwtBearer();',
  'builder.Services.AddAuthorization();',
  'var app = builder.Build();',
  '',
  `app.${first}();`,
  `app.${second}();`,
  '',
  'app.MapGet("/orders", [Authorize] () => "orders");',
]
const WRONG = code('UseAuthorization', 'UseAuthentication')
const FIXED = code('UseAuthentication', 'UseAuthorization')
const L = { FIRST: 4, SECOND: 5, ORDER: [4, 7] as [number, number], MAP: 7 }

const client: SeqActor = { id: 'client', name: 'Client', sub: 'valid token', tone: 'muted' }
// Soft hyphens let the long middleware names break cleanly in a narrow column.
const authz: SeqActor = { id: 'authz', name: 'Use­Authori­zation', tone: 'pool' }
const authn: SeqActor = { id: 'authn', name: 'Use­Authenti­cation', sub: 'JWT bearer', tone: 'ui' }
const endpoint: SeqActor = { id: 'end', name: 'Endpoint', sub: '[Authorize]', tone: 'io' }

const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })

type UserState = '?' | 'anonymous' | 'authenticated' | 'claimed'
const USER: Record<UserState, OutLine> = {
  '?': { label: 'User', text: '?', kind: 'muted' },
  anonymous: { label: 'User', text: 'anonymous, IsAuthenticated false', kind: 'plain' },
  authenticated: { label: 'User', text: 'authenticated from the token', kind: 'ok' },
  claimed: { label: 'User', text: 'authenticated from the token', kind: 'bad' },
}
const out = (user: UserState, response = '…', kind: OutLine['kind'] = 'plain'): OutLine[] => [
  USER[user],
  { label: 'Response', text: response, kind: response === '?' ? 'muted' : kind },
]

const spec = (actors: SeqActor[], c: string[], steps: Record<string, SeqStep>): SeqSpec => ({ actors, code: c, outputName: 'HttpContext', steps })
const WRONG_ACTORS = [client, authz, authn, endpoint]
const FIXED_ACTORS = [client, authn, authz, endpoint]
const wrong = (steps: Record<string, SeqStep>) => spec(WRONG_ACTORS, WRONG, steps)

const req = row('req', 'client', 'GET + token', 'authz')
const policyFails = row('policy', 'authz', 'policy fails', undefined, 'bad')
const challenge = row('challenge', 'authz', 'JWT: 401')
const skipped = [row('authn', 'authn', 'never runs', undefined, 'skip'), row('end', 'end', 'never runs', undefined, 'skip')]
const answer401 = row('resp', 'authz', '401', 'client', 'ok')

/** The real run with the wrong order. */
const R = {
  request: { rows: [req], line: L.FIRST, output: out('anonymous') },
  policy: { rows: [req, policyFails], line: L.FIRST, output: out('anonymous') },
  challenge: { rows: [req, policyFails, challenge, ...skipped], line: L.FIRST, output: out('anonymous') },
  response: { rows: [req, policyFails, challenge, ...skipped, answer401], line: L.FIRST, output: out('anonymous', '401, WWW-Authenticate: Bearer', 'ok') },
} satisfies Record<string, SeqStep>

const freq = row('req', 'client', 'GET + token', 'authn')
const validated = row('validate', 'authn', 'User set', undefined, 'ok')
const toAuthz = row('next', 'authn', 'next', 'authz')
const passes = row('policy', 'authz', 'passes', undefined, 'ok')
const toEnd = row('next2', 'authz', 'next', 'end')
const runs = row('runs', 'end', 'runs', undefined, 'ok')

const SPECS: Record<string, SeqSpec> = {
  setup: wrong({
    order: { rows: [], line: L.ORDER, output: out('?', '?') },
    request: { rows: [req], line: L.ORDER, output: out('?', '?') },
  }),
  'wrong-order': wrong(R),
  'fixed-order': spec(FIXED_ACTORS, FIXED, {
    authenticate: { rows: [freq, validated], line: L.FIRST, output: out('authenticated') },
    authorize: { rows: [freq, validated, toAuthz, passes], line: L.SECOND, output: out('authenticated') },
    endpoint: { rows: [freq, validated, toAuthz, passes, toEnd, runs, row('resp', 'end', '200', 'client', 'ok')], line: L.MAP, output: out('authenticated', '200', 'ok') },
  }),

  'authorizer-authenticates-claim': wrong({
    request: R.request,
    authenticate: { rows: [req, row('auth', 'authz', 'runs JWT itself', undefined, 'bad')], line: L.FIRST, bad: true, output: out('claimed') },
    endpoint: {
      rows: [req, row('auth', 'authz', 'runs JWT itself', undefined, 'bad'), row('policy', 'authz', 'passes', undefined, 'bad'), row('next', 'authz', 'next', 'authn', 'muted'), row('next2', 'authn', 'next', 'end', 'muted'), row('runs', 'end', 'runs', undefined, 'bad'), row('resp', 'end', '200', 'client', 'bad')],
      line: L.MAP,
      output: out('claimed', '200', 'bad'),
    },
  }),
  'authorizer-authenticates-reality': wrong({
    request: R.request,
    authenticate: { rows: [req, row('auth', 'authz', 'User as is')], line: L.FIRST, output: out('anonymous') },
    endpoint: { rows: [req, row('auth', 'authz', 'User as is'), policyFails, ...skipped, answer401], line: L.MAP, output: out('anonymous', '401', 'ok') },
  }),

  'token-read-later-claim': wrong({
    request: R.request,
    policy: R.policy,
    later: {
      rows: [req, policyFails, row('next', 'authz', 'next', 'authn', 'bad'), row('read', 'authn', 'User set', undefined, 'bad'), row('resp', 'authn', '403', 'client', 'bad')],
      line: L.SECOND,
      bad: true,
      output: out('claimed', '403', 'bad'),
    },
  }),
  'token-read-later-reality': wrong({ request: R.request, policy: R.policy, later: R.response }),

  'order-check-claim': wrong({
    request: { rows: [req], line: L.FIRST, output: out('?') },
    reaches: { rows: [req, row('next', 'authz', 'next', 'authn', 'muted'), row('next2', 'authn', 'next', 'end', 'muted')], line: L.ORDER, output: out('?') },
    throws: {
      rows: [req, row('next', 'authz', 'next', 'authn', 'muted'), row('next2', 'authn', 'next', 'end', 'muted'), row('throw', 'end', 'throws', undefined, 'bad'), row('resp', 'end', '500', 'client', 'bad')],
      line: L.MAP,
      bad: true,
      output: out('?', '500', 'bad'),
    },
  }),
  'order-check-reality': wrong({
    request: R.request,
    reaches: R.challenge,
    throws: { ...R.response, line: L.MAP },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
