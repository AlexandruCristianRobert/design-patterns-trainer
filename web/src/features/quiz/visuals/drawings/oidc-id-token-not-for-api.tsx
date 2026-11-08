import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const API_CODE = [
  'builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)',
  '    .AddJwtBearer(o =>',
  '    {',
  '        o.Authority = "https://login.example.com";',
  '        o.Audience = "orders-api"; // an ID token has aud "web-app"',
  '    });',
  '',
  'builder.Services.AddAuthorizationBuilder()',
  '    .AddPolicy("ReadOrders", p => p.RequireClaim("scope", "orders.read"));',
]
const A = { AUD: 4, SCOPE: [7, 8] as [number, number] }

// The Setup does not name the client or the API: their ids are what the answer is about.
const PLAIN: SeqActor[] = [
  { id: 'app', name: 'Web app', tone: 'ui' },
  { id: 'idp', name: 'Identity provider', tone: 'pool' },
  { id: 'api', name: 'Backend API', tone: 'io' },
]
const NAMED: SeqActor[] = [
  { id: 'app', name: 'Web app', sub: 'client id: web-app', tone: 'ui' },
  { id: 'idp', name: 'Identity provider', tone: 'pool' },
  { id: 'api', name: 'Orders API', sub: 'orders-api', tone: 'io' },
]
const seq = (actors: SeqActor[], steps: Record<string, SeqStep>, code?: string[]): SeqSpec => ({ actors, code, outputName: 'Tokens', steps })

const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind'], both = false): SeqRow => ({ key, from, to, label, kind, both })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const out = (...lines: [label: string, text: string, kind?: OutLine['kind']][]): OutLine[] => lines.map(([label, text, kind]) => ({ label, text, kind }))

const ID_TOKEN = msg('id', 'idp', 'app', 'ID token')
const ACCESS = msg('at', 'idp', 'app', 'access token')
const SEND_ID = msg('send', 'app', 'api', 'Bearer <ID token>')
const ID_LINE: [string, string, OutLine['kind']?] = ['ID token', 'aud: web-app, sub: alice']
const AT_LINE: [string, string, OutLine['kind']?] = ['Access token', 'aud: orders-api, scope: orders.read']

const NOT_FOR_API = note('aud', 'api', 'aud: web-app, not this API', 'bad')

const SPECS: Record<string, SeqSpec> = {
  setup: seq(PLAIN, {
    signin: { rows: [ID_TOKEN, ACCESS] },
    send: { rows: [ID_TOKEN, ACCESS, SEND_ID] },
  }),

  purpose: seq(
    NAMED,
    {
      'id-token': { rows: [ID_TOKEN], output: out(ID_LINE) },
      access: { rows: [ID_TOKEN, ACCESS], output: out(ID_LINE, AT_LINE) },
      reject: { rows: [ID_TOKEN, ACCESS, SEND_ID, note('check', 'api', 'aud ≠ orders-api', 'bad'), msg('401', 'api', 'app', '401', 'bad')], line: A.AUD, output: out(ID_LINE, AT_LINE) },
      skip: {
        rows: [ID_TOKEN, ACCESS, SEND_ID, note('check', 'api', 'aud check off', 'bad'), note('any', 'api', "any client's ID token passes", 'bad'), note('scope', 'api', 'no scopes', 'bad')],
        line: A.AUD,
        bad: true,
        output: out(ID_LINE, AT_LINE),
      },
    },
    API_CODE,
  ),
  fix: seq(
    NAMED,
    {
      send: { rows: [ID_TOKEN, ACCESS, msg('send', 'app', 'api', 'Bearer <access token>', 'ok'), note('check', 'api', 'aud = orders-api', 'ok')], line: A.AUD, output: out(AT_LINE) },
      scope: {
        rows: [ID_TOKEN, ACCESS, msg('send', 'app', 'api', 'Bearer <access token>', 'ok'), note('check', 'api', 'aud = orders-api', 'ok'), note('scope', 'api', 'orders.read: allowed', 'ok')],
        line: A.SCOPE,
        output: out(AT_LINE),
      },
    },
    API_CODE,
  ),

  'unsigned-claim': seq(NAMED, {
    token: { rows: [ID_TOKEN, note('sig', 'app', 'no signature')] },
    check: { rows: [ID_TOKEN, note('sig', 'app', 'no signature'), SEND_ID, note('check', 'api', "can't check the issuer")] },
  }),
  'unsigned-reality': seq(NAMED, {
    token: { rows: [ID_TOKEN, note('sig', 'app', 'signed JWT: checked', 'ok')], output: out(['ID token', 'header.payload.signature (RS256)', 'ok']) },
    check: {
      rows: [ID_TOKEN, note('sig', 'app', 'signed JWT: checked', 'ok'), SEND_ID, msg('keys', 'api', 'idp', 'signing keys', undefined, true), note('valid', 'api', 'signature valid', 'ok'), NOT_FOR_API],
      output: out(['ID token', 'header.payload.signature (RS256)', 'ok'], ID_LINE),
    },
  }),

  'encrypted-claim': seq(NAMED, {
    token: { rows: [ID_TOKEN, note('enc', 'app', 'encrypted for web-app')] },
    read: { rows: [ID_TOKEN, note('enc', 'app', 'encrypted for web-app'), SEND_ID, note('read', 'api', "can't read claims")] },
  }),
  'encrypted-reality': seq(NAMED, {
    token: { rows: [ID_TOKEN, note('enc', 'app', 'signed, not encrypted', 'ok')], output: out(['Payload', 'Base64url JSON, readable', 'ok']) },
    read: {
      rows: [ID_TOKEN, note('enc', 'app', 'signed, not encrypted', 'ok'), SEND_ID, note('read', 'api', 'reads sub, aud, …', 'ok'), NOT_FOR_API],
      output: out(['Payload', 'Base64url JSON, readable', 'ok'], ID_LINE),
    },
  }),

  'expired-claim': seq(NAMED, {
    callback: { rows: [ID_TOKEN, note('exp', 'app', 'callback done: expired')] },
    call: { rows: [ID_TOKEN, note('exp', 'app', 'callback done: expired'), SEND_ID, msg('401', 'api', 'app', '401')] },
  }),
  'expired-reality': seq(NAMED, {
    lifetime: { rows: [ID_TOKEN, note('exp', 'app', 'valid for ~1 hour', 'ok')], output: out(['ID token', 'exp: often 1 hour after sign-in', 'ok']) },
    unnoticed: {
      rows: [ID_TOKEN, note('exp', 'app', 'valid for ~1 hour', 'ok'), SEND_ID, note('check', 'api', 'aud check off', 'bad'), msg('200', 'api', 'app', '200 OK', 'bad')],
      output: out(['ID token', 'exp: often 1 hour after sign-in', 'ok'], ['Misuse', 'unnoticed', 'bad']),
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
