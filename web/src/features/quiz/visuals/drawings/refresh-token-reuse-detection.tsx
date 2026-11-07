import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const server: SeqActor = { id: 'server', name: 'Auth server', sub: 'rotates tokens', tone: 'io' }
/** Who presents a token, where the Option does not say. */
const caller: SeqActor = { id: 'caller', name: 'Caller', tone: 'muted' }
const client: SeqActor = { id: 'client', name: 'Client app', sub: 'real user', tone: 'ui' }
const attacker: SeqActor = { id: 'attacker', name: 'Attacker', sub: 'copy of RT1', tone: 'bad' }
const first: SeqActor = { id: 'first', name: 'First use', sub: 'of RT1', tone: 'muted' }
const second: SeqActor = { id: 'second', name: 'Second use', sub: 'of RT1', tone: 'muted' }
const spa: SeqActor = { id: 'caller', name: 'Caller', sub: 'SPA or mobile app', tone: 'muted' }

const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const spec = (actors: SeqActor[], steps: Record<string, SeqStep>): SeqSpec => ({ actors, outputName: 'Refresh tokens', steps })

type K = OutLine['kind']
const tok = (label: string, text: string, kind?: K): OutLine => ({ label, text, kind: text === '?' ? 'muted' : kind })
const fam = (rt1: [string, K?], rt2: [string, K?], extra?: OutLine): OutLine[] => [tok('RT1', ...rt1), tok('RT2', ...rt2), ...(extra ? [extra] : [])]

const USED: [string, K?] = ['used, invalidated']
const VALID: [string, K?] = ['valid']
const REVOKED: [string, K?] = ['revoked', 'ok']

// ---- Setup: one generic caller ----
const rotateWith = (from: string, kind?: SeqRow['kind']) => [row('use1', from, 'refresh with RT1', 'server'), row('got2', 'server', 'access token + RT2', from, kind)]
const CALLER_ROTATED = rotateWith('caller')
const callerReplay = row('replay', 'caller', 'refresh with RT1, again', 'server')

// ---- Reality: the client refreshed first ----
const copy = row('copy', 'attacker', 'has a copy of RT1', undefined, 'bad')
const CLIENT_ROTATED = [copy, ...rotateWith('client')]
const attackerReplay = row('replay', 'attacker', 'refresh with RT1', 'server', 'bad')
const reuse = row('reuse', 'server', 'RT1 is used: reuse', undefined, 'bad')
const revoke = row('revoke', 'server', 'revoke the family', undefined, 'ok')

const SPECS: Record<string, SeqSpec> = {
  setup: spec([caller, server], {
    rotate: { rows: CALLER_ROTATED, output: fam(USED, VALID) },
    replay: { rows: [...CALLER_ROTATED, callerReplay, row('q', 'server', '?', undefined, 'muted')], output: fam(USED, VALID, tok('Response', '?')) },
  }),
  'client-first': spec([client, attacker, server], {
    copy: { rows: [copy], output: fam(['valid'], ['not issued yet', 'muted']) },
    rotate: { rows: CLIENT_ROTATED, output: fam(USED, ['valid, held by the client']) },
    replay: { rows: [...CLIENT_ROTATED, attackerReplay, reuse], output: fam(USED, ['valid, held by the client']) },
    revoke: {
      rows: [...CLIENT_ROTATED, attackerReplay, reuse, revoke, row('no', 'server', 'rejected', 'attacker', 'ok')],
      output: fam(REVOKED, REVOKED),
    },
    signin: {
      rows: [...CLIENT_ROTATED, attackerReplay, reuse, revoke, row('no', 'server', 'rejected', 'attacker', 'ok'), row('use2', 'client', 'refresh with RT2', 'server'), row('again', 'server', 'rejected: sign in again', 'client')],
      output: fam(REVOKED, REVOKED, tok('User', 'signs in again, new family')),
    },
  }),
  'attacker-first': spec([client, attacker, server], {
    rotate: { rows: rotateWith('attacker', 'bad'), output: fam(USED, ['valid, held by the attacker', 'bad']) },
    replay: { rows: [...rotateWith('attacker', 'bad'), row('replay', 'client', 'refresh with RT1', 'server'), reuse], output: fam(USED, ['valid, held by the attacker', 'bad']) },
    revoke: {
      rows: [...rotateWith('attacker', 'bad'), row('replay', 'client', 'refresh with RT1', 'server'), reuse, revoke],
      output: fam(REVOKED, ['revoked, the attacker is out', 'ok'], tok('User', 'signs in again, new family')),
    },
  }),

  'as-usual-claim': spec([caller, server], {
    replay: { rows: [...CALLER_ROTATED, callerReplay], output: fam(USED, VALID) },
    check: { rows: [...CALLER_ROTATED, callerReplay, row('check', 'server', 'lifetime OK, signature OK', undefined, 'bad')], output: fam(USED, VALID) },
    issue: {
      rows: [...CALLER_ROTATED, callerReplay, row('check', 'server', 'lifetime OK, signature OK', undefined, 'bad'), row('issue', 'server', 'new access token', 'caller', 'bad')],
      output: fam(USED, VALID, tok('Response', 'new access token', 'bad')),
    },
  }),
  'as-usual-reality': spec([client, attacker, server], {
    replay: { rows: [...CLIENT_ROTATED, attackerReplay], output: fam(USED, ['valid, held by the client']) },
    check: { rows: [...CLIENT_ROTATED, attackerReplay, row('check', 'server', 'state: RT1 used', undefined, 'bad')], output: fam(USED, ['valid, held by the client']) },
    issue: {
      rows: [...CLIENT_ROTATED, attackerReplay, row('check', 'server', 'state: RT1 used', undefined, 'bad'), row('issue', 'server', 'no new token', 'attacker', 'skip'), revoke],
      output: fam(REVOKED, REVOKED, tok('Response', 'rejected', 'ok')),
    },
  }),

  'keep-newest-claim': spec([first, second, server], {
    rotate: { rows: rotateWith('first'), output: fam(USED, VALID) },
    replay: { rows: [...rotateWith('first'), row('replay', 'second', 'refresh with RT1', 'server'), row('rej', 'server', 'rejected', 'second', 'bad')], output: fam(USED, VALID) },
    keep: {
      rows: [...rotateWith('first'), row('replay', 'second', 'refresh with RT1', 'server'), row('rej', 'server', 'rejected', 'second', 'bad'), row('keep', 'server', 'keep RT2: the real user\'s', undefined, 'bad')],
      output: fam(USED, ['valid, the real user\'s', 'bad']),
    },
  }),
  'keep-newest-reality': spec([attacker, client, server], {
    rotate: { rows: rotateWith('attacker', 'bad'), output: fam(USED, ['valid, held by the attacker', 'bad']) },
    replay: { rows: [...rotateWith('attacker', 'bad'), row('replay', 'client', 'refresh with RT1', 'server'), row('rej', 'server', 'rejected', 'client')], output: fam(USED, ['valid, held by the attacker', 'bad']) },
    keep: {
      rows: [...rotateWith('attacker', 'bad'), row('replay', 'client', 'refresh with RT1', 'server'), row('rej', 'server', 'rejected', 'client'), revoke],
      output: fam(REVOKED, ['revoked, the attacker is out', 'ok']),
    },
  }),

  'client-secret-claim': spec([caller, server], {
    replay: { rows: [...CALLER_ROTATED, callerReplay], output: fam(USED, VALID) },
    secret: { rows: [...CALLER_ROTATED, callerReplay, row('ask', 'server', 'send client_secret', 'caller', 'bad'), row('send', 'caller', 'client_secret', 'server')], output: fam(USED, VALID) },
    accept: {
      rows: [...CALLER_ROTATED, callerReplay, row('ask', 'server', 'send client_secret', 'caller', 'bad'), row('send', 'caller', 'client_secret', 'server'), row('accept', 'server', 'matches: accept RT1', undefined, 'bad')],
      output: fam(USED, VALID, tok('Response', 'RT1 accepted', 'bad')),
    },
  }),
  'client-secret-reality': spec([spa, server], {
    replay: { rows: [...CALLER_ROTATED, callerReplay], output: fam(USED, VALID) },
    secret: { rows: [...CALLER_ROTATED, callerReplay, row('ask', 'server', 'client_secret?', 'caller'), row('none', 'caller', 'public client: has none', undefined, 'bad')], output: fam(USED, VALID) },
    accept: {
      rows: [...CALLER_ROTATED, callerReplay, row('ask', 'server', 'client_secret?', 'caller'), row('none', 'caller', 'public client: has none', undefined, 'bad'), row('proof', 'server', 'a secret is no proof against replay', undefined, 'muted'), revoke],
      output: fam(REVOKED, REVOKED),
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
