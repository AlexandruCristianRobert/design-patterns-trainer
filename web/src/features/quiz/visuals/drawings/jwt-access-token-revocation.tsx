import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const actors: SeqActor[] = [
  { id: 'idp', name: 'Identity provider', sub: 'the issuer', tone: 'pool' },
  { id: 'client', name: 'Client', tone: 'ui' },
  { id: 'api', name: 'API', sub: 'JwtBearer', tone: 'io' },
]

const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const spec = (steps: Record<string, SeqStep>, outputName = 'Outcome'): SeqSpec => ({ actors, outputName, steps })
type K = OutLine['kind']
const out = (lines: [string, string, K?][]): OutLine[] => lines.map(([label, text, kind]) => ({ label, text, kind: text === '?' ? 'muted' : kind }))

const issued = msg('issue', 'idp', 'client', 'access token (signed, exp)')
const disabled = note('dis', 'idp', 'account disabled')
const call = msg('call', 'client', 'api', 'GET /orders + token')

// ---- Reality: local validation ----
const keys = msg('keys', 'idp', 'api', 'public signing keys')
const cached = note('cached', 'api', 'keys cached')
const checks = note('checks', 'api', 'signature, iss, aud, exp: valid', 'bad')
const noAsk = msg('noask', 'api', 'idp', 'no call to the issuer', 'skip')
const ok200 = msg('ok', 'api', 'client', '200 OK', 'bad')
const VALIDATE = [keys, cached, issued, disabled, call, checks, noAsk, ok200]

// ---- Reality: the usual design ----
const pair = msg('pair', 'idp', 'client', 'access token (minutes) + refresh token', 'ok')
const stored = note('stored', 'idp', 'refresh token stored', 'ok')
const revoked = note('dis', 'idp', 'disabled: refresh token revoked', 'ok')
const refresh = msg('refresh', 'client', 'idp', 'refresh token')
const refused = msg('refused', 'idp', 'client', 'refused: revoked', 'ok')
const expired = note('expd', 'client', 'access token expired')
const DESIGN = [pair, stored, revoked, expired, refresh, refused]

const SPECS: Record<string, SeqSpec> = {
  setup: {
    actors,
    steps: {
      issue: { rows: [issued] },
      disable: { rows: [issued, disabled] },
      call: { rows: [issued, disabled, call, note('acc', 'api', 'still accepted until exp: why?', 'muted')] },
    },
  },
  local: spec({
    keys: { rows: [keys, cached, issued], output: out([['Token after disabling', '?']]) },
    disable: { rows: [keys, cached, issued, disabled], output: out([['Token after disabling', '?']]) },
    validate: { rows: VALIDATE, output: out([['Token after disabling', 'accepted', 'bad']]) },
    expire: {
      rows: [...VALIDATE, note('exp', 'api', 'later: exp has passed'), msg('401', 'api', 'client', '401 Unauthorized', 'ok')],
      output: out([['Token after disabling', 'accepted until exp', 'bad']]),
    },
  }),
  design: spec({
    short: { rows: [pair, stored], output: out([['Access token', 'valid for minutes', 'ok'], ['Refresh token', 'checked by the issuer on each use', 'ok']]) },
    disable: { rows: [pair, stored, revoked], output: out([['Access token', 'valid for minutes', 'ok'], ['Refresh token', 'revoked', 'ok']]) },
    refresh: { rows: [...DESIGN, note('noacc', 'client', 'no new access token', 'ok')], output: out([['Access token', 'expired, not renewed', 'ok'], ['Refresh token', 'revoked', 'ok']]) },
    bound: {
      rows: [...DESIGN, note('noacc', 'client', 'no new access token', 'ok'), note('opt', 'api', 'instant cut-off: introspect or deny-list')],
      output: out([['Exposure', 'at most one access-token lifetime', 'ok'], ['Immediate cut-off', 'extra work']]),
    },
  }),

  'cache-claim': spec(
    {
      cache: {
        rows: [msg('first', 'client', 'api', 'first request + token'), note('cache', 'api', "caches the user's claims"), msg('later', 'client', 'api', 'later request'), note('hit', 'api', 'claims from the cache')],
        output: out([['Sign-out', '?']]),
      },
      signout: {
        rows: [
          msg('first', 'client', 'api', 'first request + token'),
          note('cache', 'api', "caches the user's claims"),
          msg('later', 'client', 'api', 'later request'),
          note('hit', 'api', 'claims from the cache'),
          note('so', 'api', 'sign-out call: cache cleared'),
        ],
        output: out([['Sign-out', 'clears the cached claims']]),
      },
    },
    'The claim',
  ),
  'cache-reality': spec({
    stateless: {
      rows: [call, note('v1', 'api', 'validate this token: no per-user cache', 'ok'), msg('call2', 'client', 'api', 'GET /orders + token'), note('v2', 'api', 'validate this token again', 'ok')],
      output: out([['Per-user state', 'none', 'ok'], ['Sign-out', '?']]),
    },
    signout: {
      rows: [
        call,
        note('v1', 'api', 'validate this token: no per-user cache', 'ok'),
        note('so', 'api', 'sign-out call: throws', 'bad'),
        msg('call2', 'client', 'api', 'GET /orders + token'),
        note('v2', 'api', 'signature, exp: valid', 'bad'),
        msg('ok', 'api', 'client', '200 OK', 'bad'),
      ],
      output: out([['Per-user state', 'none', 'ok'], ['Sign-out', 'not supported: throws', 'bad'], ['Token', 'still accepted', 'bad']]),
    },
  }),

  'rsa-claim': spec(
    {
      hs256: { rows: [note('hs', 'idp', 'signs with a shared key: HS256'), msg('tok', 'idp', 'client', 'HS256 token')], output: out([['Revoke one token', '?']]) },
      rsa: {
        rows: [note('hs', 'idp', 'signs with a shared key: HS256'), msg('tok', 'idp', 'client', 'HS256 token'), note('rs', 'idp', 'switch to RSA: RS256'), note('rev', 'idp', 'can revoke a single token')],
        output: out([['Revoke one token', 'possible with RSA']]),
      },
    },
    'The claim',
  ),
  'rsa-reality': spec({
    rs256: {
      rows: [msg('keys', 'idp', 'api', 'RSA public key'), msg('tok', 'idp', 'client', 'RS256 token'), msg('call', 'client', 'api', 'GET /orders + RS256 token'), note('ver', 'api', 'verify with the public key, locally'), noAsk],
      output: out([['Issuer asked', 'never', 'bad']]),
    },
    still: {
      rows: [
        msg('keys', 'idp', 'api', 'RSA public key'),
        msg('tok', 'idp', 'client', 'RS256 token'),
        disabled,
        msg('call', 'client', 'api', 'GET /orders + RS256 token'),
        note('ver', 'api', 'verify with the public key, locally'),
        noAsk,
        ok200,
      ],
      output: out([['Issuer asked', 'never', 'bad'], ['Token after disabling', 'accepted until exp', 'bad']]),
    },
  }),

  'push-claim': spec(
    {
      normal: { rows: [disabled, msg('ev', 'idp', 'api', 'normally: revocation event'), note('rej', 'api', 'rejects the token at once')], output: out([['This time', '?']]) },
      forgot: {
        rows: [disabled, msg('ev', 'idp', 'api', 'normally: revocation event'), note('rej', 'api', 'rejects the token at once'), msg('ev2', 'idp', 'api', 'this time: not pushed', 'skip'), call, note('acc', 'api', 'token accepted')],
        output: out([['This time', 'the event was forgotten']]),
      },
    },
    'The claim',
  ),
  'push-reality': spec({
    'no-channel': {
      rows: [keys, note('only', 'api', 'holds signing keys only, no event channel', 'bad'), disabled, call, checks, ok200],
      output: out([['Revocation events', 'none in plain JWT validation', 'bad']]),
    },
    rotate: {
      rows: [keys, note('only', 'api', 'holds signing keys only, no event channel', 'bad'), disabled, call, checks, ok200, note('rot', 'idp', 'rotate the signing key?'), note('all', 'api', "every user's token rejected", 'bad')],
      output: out([['Revocation events', 'none in plain JWT validation', 'bad'], ['Key rotation', 'cuts off everyone, not one user', 'bad']]),
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
