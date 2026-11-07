import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const HAND_CODE = [
  'var header = DecodeHeader(token);',
  'var alg = header.Alg;                  // taken from the token',
  'if (alg == "none") return Accept(token);',
  'var key = alg.StartsWith("HS")',
  '    ? Encoding.UTF8.GetBytes(publicKeyPem) // the public key as an HMAC secret',
  '    : rsaPublicKey;',
  'return Verify(token, alg, key) ? Accept(token) : Reject();',
]
const H = { ALG: [0, 1] as [number, number], NONE: 2, KEY: [3, 5] as [number, number], VERIFY: 6 }
const PARAMS_CODE = [
  'new TokenValidationParameters',
  '{',
  '    ValidAlgorithms = new[] { SecurityAlgorithms.RsaSha256 },',
  '    IssuerSigningKey = new RsaSecurityKey(rsa), // the public key',
  '    RequireSignedTokens = true,                 // the default',
  '    // …issuer, audience, lifetime',
  '};',
]
const PR = { PIN: [2, 3] as [number, number], SIGNED: 4 }

const ATTACKER: SeqActor = { id: 'evil', name: 'Attacker', tone: 'bad' }
const VALIDATOR: SeqActor = { id: 'val', name: 'Server', sub: 'token validator', tone: 'pool' }
const ACTORS = [ATTACKER, VALIDATOR]

const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const result = (t1: string, t2: string, k1?: OutLine['kind'], k2?: OutLine['kind']): OutLine[] => [
  { label: 'alg: none token', text: t1, kind: t1 === '?' ? 'muted' : k1 },
  { label: 'alg: HS256 token', text: t2, kind: t2 === '?' ? 'muted' : k2 },
]
const one = (label: string, text: string, kind?: OutLine['kind']): OutLine[] => [{ label, text, kind: text === '?' ? 'muted' : kind }]
const seq = (code: string[] | null, steps: Record<string, SeqStep>): SeqSpec => ({ actors: ACTORS, code: code ?? undefined, outputName: 'Result', steps })

// ---- The two tokens ----
const noneTok = row('none', 'evil', '{alg: none} {sub: admin} (no signature)', 'val')
const hsTok = row('hs', 'evil', '{alg: HS256} {sub: admin} + signature', 'val')
const expects = row('expects', 'val', 'issues RS256, holds RSA public key')

// ---- Reality: trusting the header ----
const reads = row('reads', 'val', 'alg := token header', undefined, 'bad')
const noneOk = row('none-ok', 'val', 'none: no check, accepted', undefined, 'bad')
const pubKey = row('pub', 'val', 'RSA public key (published)', 'evil')
const hmacSign = row('hmac', 'evil', 'HMAC-SHA256 with the public key', undefined, 'bad')
const hsTokSigned = row('hs', 'evil', '{alg: HS256} {sub: admin} + that HMAC', 'val')
const hsOk = row('hs-ok', 'val', 'HMAC with the public key: match, accepted', undefined, 'bad')
const attackBase = [reads, noneTok, noneOk]

// ---- Reality: the defence ----
const pinned = row('pin', 'val', 'server decides: RS256 only, RSA key', undefined, 'ok')
const noneRej = row('none-rej', 'val', 'unsigned: rejected', 'evil', 'ok')
const hsRej = row('hs-rej', 'val', 'HS256 not allowed: rejected', 'evil', 'ok')

const SPECS: Record<string, SeqSpec> = {
  setup: seq(null, {
    server: { rows: [expects], output: result('?', '?') },
    none: { rows: [expects, noneTok, row('q1', 'val', 'accepted, why: ?', undefined, 'muted')], output: result('accepted', '?') },
    hs256: { rows: [expects, noneTok, row('q1', 'val', 'accepted, why: ?', undefined, 'muted'), hsTok, row('q2', 'val', 'accepted, why: ?', undefined, 'muted')], output: result('accepted', 'accepted') },
  }),

  attack: seq(HAND_CODE, {
    reads: { rows: [reads], line: H.ALG, bad: true, output: result('?', '?') },
    none: { rows: attackBase, line: H.NONE, bad: true, output: result('accepted', '?', 'bad') },
    hmac: { rows: [...attackBase, pubKey, hmacSign, hsTokSigned], line: H.KEY, bad: true, output: result('accepted', '?', 'bad') },
    matches: { rows: [...attackBase, pubKey, hmacSign, hsTokSigned, hsOk], line: H.VERIFY, bad: true, output: result('accepted', 'accepted', 'bad', 'bad') },
  }),
  defence: seq(PARAMS_CODE, {
    pin: { rows: [pinned], line: PR.PIN, output: result('?', '?') },
    none: { rows: [pinned, noneTok, noneRej], line: PR.SIGNED, output: result('rejected', '?', 'ok') },
    hs256: { rows: [pinned, noneTok, noneRej, hsTok, hsRej], line: PR.PIN, output: result('rejected', 'rejected', 'ok', 'ok') },
  }),

  'readable-claim': seq(null, {
    read: { rows: [row('has', 'evil', 'has a token'), row('decode', 'evil', 'Base64url-decodes: sub, role')], output: one('Problem', 'claims readable') },
    encrypt: {
      rows: [row('has', 'evil', 'has a token'), row('decode', 'evil', 'Base64url-decodes: sub, role'), row('jwe', 'val', 'defence: encrypt every token (JWE)')],
      output: one('Problem', 'fixed by encryption'),
    },
  }),
  'readable-reality': seq(null, {
    read: { rows: [noneTok, row('pass', 'val', 'header trusted: accepted', undefined, 'bad')], output: one('Forged token', 'accepted', 'bad') },
    encrypt: {
      rows: [row('jwe', 'val', 'tokens now encrypted (JWE)'), noneTok, row('pass', 'val', 'header still trusted: accepted', undefined, 'bad')],
      output: one('Forged token', 'still accepted', 'bad'),
    },
  }),

  'lifetime-claim': seq(null, {
    'no-exp': { rows: [row('old', 'evil', 'old token, no exp: works forever', 'val')], output: one('Problem', 'tokens never expire') },
    lifetime: {
      rows: [row('old', 'evil', 'old token, no exp: works forever', 'val'), row('exp', 'val', 'defence: validate exp on every token')],
      output: one('Problem', 'fixed by lifetime checks'),
    },
  }),
  'lifetime-reality': seq(null, {
    mint: { rows: [row('new', 'evil', 'brand-new {alg: none} {sub: admin, exp: +1 h}', 'val')], output: one('Forged token', '?') },
    lifetime: {
      rows: [row('new', 'evil', 'brand-new {alg: none} {sub: admin, exp: +1 h}', 'val'), row('exp', 'val', 'exp valid ✓'), row('pass', 'val', 'header still trusted: accepted', undefined, 'bad')],
      output: one('Forged token', 'accepted', 'bad'),
    },
  }),

  'hmac-broken-claim': seq(null, {
    broken: { rows: [row('break', 'evil', 'breaks HMAC-SHA256')], output: one('Accepted algorithms', '?') },
    deny: { rows: [row('break', 'evil', 'breaks HMAC-SHA256'), row('deny', 'val', 'reject HS256, accept every other alg')], output: one('Accepted algorithms', 'everything but HS256') },
  }),
  'hmac-broken-reality': seq(null, {
    broken: { rows: [pubKey, row('misuse', 'evil', 'HMAC keyed with the public key: misuse')], output: one('Accepted algorithms', '?') },
    deny: {
      rows: [pubKey, row('misuse', 'evil', 'HMAC keyed with the public key: misuse'), row('deny', 'val', 'reject HS256 only'), noneTok, row('pass', 'val', 'none is not HS256: accepted', undefined, 'bad')],
      output: one('Accepted algorithms', 'everything but HS256, none included', 'bad'),
    },
    allow: {
      rows: [pubKey, row('misuse', 'evil', 'HMAC keyed with the public key: misuse'), row('deny', 'val', 'allow-list: RS256 only', undefined, 'ok'), noneTok, row('pass', 'val', 'not on the list: rejected', 'evil', 'ok')],
      output: one('Accepted algorithms', 'RS256 only', 'ok'),
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
