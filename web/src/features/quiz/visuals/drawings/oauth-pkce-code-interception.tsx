import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const APP: SeqActor = { id: 'app', name: 'App', sub: 'mobile or SPA', tone: 'ui' }
const SPA: SeqActor = { id: 'app', name: 'Single-page app', tone: 'ui' }
const AS: SeqActor = { id: 'as', name: 'Authorization server', tone: 'pool' }
const EVIL: SeqActor = { id: 'evil', name: 'Malicious app', sub: 'same URL scheme', tone: 'bad' }
const SCRIPT: SeqActor = { id: 'script', name: 'Injected script', sub: 'in the page', tone: 'bad' }
const API: SeqActor = { id: 'api', name: 'API', tone: 'io' }
const OTHER: SeqActor = { id: 'other', name: 'Other device', sub: 'attacker', tone: 'bad' }

const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind'], both?: boolean): SeqRow => ({ key, from, to, label, kind, both })
const seq = (actors: SeqActor[], steps: Record<string, SeqStep>): SeqSpec => ({ actors, steps })

// ---- Setup: the plain code flow, PKCE still a question ----
const signIn = [row('authz', 'app', 'authorization request', 'as'), row('login', 'as', 'user signs in')]
const codeBack = row('code', 'as', 'authorization code (redirect)', 'app')
const exchange = row('exchange', 'app', 'code for tokens', 'as', 'plain', true)

// ---- Reality ----
const verifier = row('verifier', 'app', 'random verifier, kept secret')
const challenge = row('authz', 'app', 'authorize + challenge (hash of verifier)', 'as')
const made = [verifier, challenge]
const intercepted = [...made, row('login', 'as', 'user signs in'), row('code', 'as', 'code', 'app'), row('steal', 'as', 'same code', 'evil', 'bad')]
const evilTry = [...intercepted, row('try', 'evil', 'code, no verifier', 'as', 'bad'), row('deny', 'as', 'invalid_grant', 'evil', 'ok')]
const appRedeems = [
  ...evilTry,
  row('redeem', 'app', 'code + verifier', 'as'),
  row('check', 'as', 'hash of verifier = challenge', undefined, 'ok'),
  row('tokens', 'as', 'tokens', 'app', 'ok'),
]

// ---- Claim B: the token after the exchange ----
const redeem = row('redeem', 'app', 'code + verifier', 'as')
const bearer = [redeem, row('check', 'as', 'verifier checked', undefined, 'ok'), row('token', 'as', 'access token (bearer)', 'app')]

// ---- Claim C: client credentials ----
const noSecret = row('nosecret', 'app', 'no client secret stored')

// ---- Claim D: a stolen token ----
const steal = row('steal', 'app', 'access token copied', 'other', 'bad')

const SPECS: Record<string, SeqSpec> = {
  setup: seq([APP, AS], {
    authorize: { rows: signIn },
    code: { rows: [...signIn, codeBack] },
    exchange: { rows: [...signIn, codeBack, exchange] },
    pkce: { rows: [...signIn, codeBack, exchange, row('pkce', 'app', 'PKCE added: protects against ?', undefined, 'muted')] },
  }),
  pkce: seq([APP, AS, EVIL], {
    verifier: { rows: made },
    intercept: { rows: intercepted },
    'attacker-redeems': { rows: evilTry },
    'app-redeems': { rows: appRedeems },
  }),

  'encrypt-token-claim': seq([SPA, SCRIPT, AS], {
    exchange: { rows: [redeem] },
    token: { rows: [redeem, row('token', 'as', 'access token, encrypted', 'app')] },
    xss: { rows: [redeem, row('token', 'as', 'access token, encrypted', 'app'), row('read', 'script', 'reads the token', 'app'), row('fail', 'script', 'cannot read it')] },
  }),
  'encrypt-token-reality': seq([SPA, SCRIPT, AS], {
    exchange: { rows: [redeem] },
    token: { rows: bearer },
    xss: { rows: [...bearer, row('read', 'script', 'reads the token', 'app', 'bad'), row('fail', 'script', 'has the token, can call the API', undefined, 'bad')] },
  }),

  'client-credentials-claim': seq([APP, AS], {
    'no-secret': { rows: [noSecret] },
    request: { rows: [noSecret, row('cc', 'app', 'client credentials grant, verifier as the secret', 'as')] },
    tokens: { rows: [noSecret, row('cc', 'app', 'client credentials grant, verifier as the secret', 'as'), row('tokens', 'as', 'tokens', 'app')] },
  }),
  'client-credentials-reality': seq([APP, AS], {
    'no-secret': { rows: [noSecret] },
    request: { rows: [noSecret, row('cc', 'app', 'client credentials grant, no secret', 'as', 'bad'), row('deny', 'as', 'invalid_client', 'app', 'bad')] },
    tokens: {
      rows: [
        noSecret,
        row('cc', 'app', 'client credentials grant, no secret', 'as', 'bad'),
        row('deny', 'as', 'invalid_client', 'app', 'bad'),
        row('flow', 'app', 'authorize + challenge', 'as'),
        row('login', 'as', 'user signs in'),
        row('code', 'as', 'code', 'app'),
        row('redeem', 'app', 'code + verifier', 'as'),
        row('tokens', 'as', 'tokens', 'app', 'ok'),
      ],
    },
  }),

  'token-binding-claim': seq([APP, AS, API, OTHER], {
    tokens: { rows: [redeem, row('token', 'as', 'access token, bound to the device certificate', 'app')] },
    stolen: { rows: [redeem, row('token', 'as', 'access token, bound to the device certificate', 'app'), steal] },
    replay: {
      rows: [redeem, row('token', 'as', 'access token, bound to the device certificate', 'app'), steal, row('call', 'other', 'GET /orders + token', 'api'), row('deny', 'api', '401: wrong device', 'other')],
    },
  }),
  'token-binding-reality': seq([APP, AS, API, OTHER], {
    tokens: { rows: [redeem, row('token', 'as', 'access token (bearer)', 'app')] },
    stolen: { rows: [redeem, row('token', 'as', 'access token (bearer)', 'app'), steal] },
    replay: {
      rows: [redeem, row('token', 'as', 'access token (bearer)', 'app'), steal, row('call', 'other', 'GET /orders + token', 'api', 'bad'), row('deny', 'api', '200 OK', 'other', 'bad')],
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, spec]) => [stage, (p: StageDrawingProps) => <SeqStage spec={spec} {...p} />]),
)
export default drawing
