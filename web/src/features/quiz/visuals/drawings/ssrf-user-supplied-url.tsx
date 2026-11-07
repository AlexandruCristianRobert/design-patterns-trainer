import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const USER: SeqActor = { id: 'user', name: 'User', tone: 'ui' }
const ATTACKER: SeqActor = { id: 'user', name: 'Attacker', tone: 'bad' }
const SVC: SeqActor = { id: 'svc', name: 'Image service', sub: 'in the cloud', tone: 'pool' }
const HOST: SeqActor = { id: 'host', name: 'URL host', tone: 'muted' }
const META: SeqActor = { id: 'meta', name: 'Metadata endpoint', sub: '169.254.169.254', tone: 'io' }
const PUBLIC: SeqActor = { id: 'pub', name: 'Public hosts', tone: 'muted' }
const EVIL: SeqActor = { id: 'pub', name: 'evil.example', sub: 'public', tone: 'muted' }
const ADMIN: SeqActor = { id: 'meta', name: 'admin.internal', sub: 'internal HTTPS API', tone: 'io' }

const CODE = [
  'app.MapPost("/images/fetch", async (string url, HttpClient http) =>',
  '{',
  '    byte[] bytes = await http.GetByteArrayAsync(url);',
  '    return Results.File(bytes, "image/png");',
  '});',
]
const GET = 2
const DEF_CODE = [
  'var handler = new SocketsHttpHandler',
  '{',
  '    AllowAutoRedirect = false,',
  '    ConnectCallback = async (ctx, ct) =>',
  '    {',
  '        var ips = await Dns.GetHostAddressesAsync(ctx.DnsEndPoint.Host, ct);',
  '        if (ips.Length == 0 || ips.Any(IsInternalOrLinkLocal))',
  '            throw new HttpRequestException("Destination not allowed");',
  '        var socket = new Socket(SocketType.Stream, ProtocolType.Tcp);',
  '        await socket.ConnectAsync(ips, ctx.DnsEndPoint.Port, ct);',
  '        return new NetworkStream(socket, ownsSocket: true);',
  '    },',
  '};',
]
const D = { REDIRECT: 2, RESOLVE: 5, CHECK: [6, 7] as [number, number], CONNECT: [8, 10] as [number, number] }
const HTTPS_CODE = [
  'var uri = new Uri(url);',
  'if (uri.Scheme != Uri.UriSchemeHttps)',
  '    return Results.BadRequest();',
  '',
  'byte[] bytes = await http.GetByteArrayAsync(uri);',
  'return Results.File(bytes, "image/png");',
]
const XSS_CODE = [
  'var encoded = WebUtility.HtmlEncode(url);',
  'byte[] bytes = await http.GetByteArrayAsync(encoded);',
  'return Results.File(bytes, "image/png");',
]
const DOS_CODE = [
  'http.Timeout = TimeSpan.FromSeconds(5);',
  'http.MaxResponseContentBufferSize = 5_000_000;',
  '',
  'byte[] bytes = await http.GetByteArrayAsync(url);',
  'return Results.File(bytes, "image/png");',
]

const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const spec = (actors: SeqActor[], code: string[], steps: Record<string, SeqStep>): SeqSpec => ({ actors, code, outputName: 'Returned to the user', steps })
const back = (text: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'Response', text, kind }]

// ---- The metadata attack, shared by several stages ----
const submitMeta = msg('submit', 'user', 'svc', 'url = http://169.254.169.254/…')
const fetchMeta = msg('fetch', 'svc', 'meta', 'GET /latest/meta-data/…', 'bad')
const creds = msg('creds', 'meta', 'svc', 'credentials')
const leak = msg('leak', 'svc', 'user', 'credentials, as the "image"', 'bad')

const SPECS: Record<string, SeqSpec> = {
  setup: spec([USER, SVC, HOST], CODE, {
    normal: {
      rows: [msg('submit', 'user', 'svc', 'url = https://cdn.example.com/cat.png'), msg('get', 'svc', 'host', 'GET /cat.png'), msg('img', 'host', 'svc', 'image bytes'), msg('ret', 'svc', 'user', 'the image')],
      line: GET,
      output: back('cat.png'),
    },
    any: { rows: [msg('submit-any', 'user', 'svc', 'url = any URL'), msg('get-any', 'svc', 'host', 'GET whatever it points at')], line: GET, output: back('?', 'muted') },
  }),
  attack: spec([ATTACKER, SVC, META], CODE, {
    submit: { rows: [submitMeta, note('out', 'meta', 'not reachable from outside', 'muted')], line: 0 },
    fetch: { rows: [submitMeta, note('out', 'meta', 'not reachable from outside', 'muted'), fetchMeta], line: GET, bad: true },
    leak: { rows: [submitMeta, note('out', 'meta', 'not reachable from outside', 'muted'), fetchMeta, creds, leak], line: [2, 3], bad: true, output: back('cloud credentials', 'bad') },
  }),
  defence: spec([ATTACKER, SVC, PUBLIC, META], DEF_CODE, {
    dns: { rows: [msg('submit', 'user', 'svc', 'url = http://img.evil.example/'), note('dns', 'svc', 'DNS: img.evil.example is 169.254.169.254', 'bad')], line: D.RESOLVE },
    connect: {
      rows: [msg('submit', 'user', 'svc', 'url = http://img.evil.example/'), note('dns', 'svc', 'DNS: img.evil.example is 169.254.169.254', 'bad'), msg('blocked', 'svc', 'meta', 'link-local: refused', 'skip')],
      line: D.CHECK,
      output: back('error: destination not allowed', 'ok'),
    },
    redirect: {
      rows: [msg('submit2', 'user', 'svc', 'url = https://evil.example/x'), msg('get2', 'svc', 'pub', 'GET /x'), msg('302', 'pub', 'svc', '302 to https://admin.internal/users'), note('nofollow', 'svc', 'redirect not followed', 'ok')],
      line: D.REDIRECT,
      output: back('error: the 302 is not followed', 'ok'),
    },
    allowed: {
      rows: [msg('submit3', 'user', 'svc', 'url = https://cdn.example.com/cat.png'), note('pass', 'svc', 'public IP: allowed', 'ok'), msg('get3', 'svc', 'pub', 'GET /cat.png'), msg('img3', 'pub', 'svc', 'image bytes')],
      line: D.CONNECT,
      output: back('cat.png', 'ok'),
    },
  }),

  'https-claim': spec([ATTACKER, SVC, META], HTTPS_CODE, {
    scheme: { rows: [submitMeta, note('reject', 'svc', 'not https: rejected')], line: [1, 2], output: back('400 Bad Request') },
    safe: { rows: [submitMeta, note('reject', 'svc', 'not https: rejected'), note('http', 'meta', 'internal: plain HTTP only')], line: [1, 2], output: [...back('400 Bad Request'), { label: 'Internal services', text: 'unreachable' }] },
  }),
  'https-reality': spec([ATTACKER, SVC, EVIL, ADMIN], HTTPS_CODE, {
    'internal-https': { rows: [note('https', 'meta', 'serves https://admin.internal')], line: null },
    redirect: {
      rows: [note('https', 'meta', 'serves https://admin.internal'), msg('submit', 'user', 'svc', 'url = https://evil.example/x'), note('pass', 'svc', 'https: accepted'), msg('get', 'svc', 'pub', 'GET /x'), msg('302', 'pub', 'svc', '302 to admin.internal/users')],
      line: [1, 4],
    },
    follow: {
      rows: [
        note('https', 'meta', 'serves https://admin.internal'),
        msg('submit', 'user', 'svc', 'url = https://evil.example/x'),
        note('pass', 'svc', 'https: accepted'),
        msg('get', 'svc', 'pub', 'GET /x'),
        msg('302', 'pub', 'svc', '302 to admin.internal/users'),
        msg('follow', 'svc', 'meta', 'GET /users (redirect followed)', 'bad'),
        msg('data', 'meta', 'svc', 'internal user list'),
        msg('leak', 'svc', 'user', 'internal data, as the "image"', 'bad'),
      ],
      line: 4,
      bad: true,
      output: back('internal user list', 'bad'),
    },
  }),

  'xss-claim': spec([ATTACKER, SVC, META], XSS_CODE, {
    script: { rows: [msg('submit', 'user', 'svc', 'url with a <script> inside'), note('runs', 'svc', 'script could run')], line: null },
    encode: { rows: [msg('submit', 'user', 'svc', 'url with a <script> inside'), note('runs', 'svc', 'HTML-encoded: script cannot run')], line: 0, output: back('safe') },
  }),
  'xss-reality': spec([ATTACKER, SVC, META], XSS_CODE, {
    'not-rendered': { rows: [submitMeta, note('enc', 'svc', 'URL is requested, never rendered')], line: 1 },
    'same-host': { rows: [submitMeta, note('enc', 'svc', 'encoded URL: same host'), fetchMeta, creds, leak], line: [0, 1], bad: true, output: back('cloud credentials', 'bad') },
  }),

  'dos-claim': spec([ATTACKER, SVC, PUBLIC], DOS_CODE, {
    slow: { rows: [msg('submit', 'user', 'svc', 'url = https://slow.example/huge'), msg('get', 'svc', 'pub', 'GET: slow, huge response')], line: 3 },
    limits: {
      rows: [msg('submit', 'user', 'svc', 'url = https://slow.example/huge'), msg('get', 'svc', 'pub', 'GET: slow, huge response'), note('cut', 'svc', 'cut off after 5 s or 5 MB')],
      line: [0, 1],
      output: back('error: too slow or too big', 'ok'),
    },
  }),
  'dos-reality': spec([ATTACKER, SVC, META], DOS_CODE, {
    fast: { rows: [submitMeta, fetchMeta, msg('creds', 'meta', 'svc', 'credentials: a few ms, about 1 KB')], line: [0, 1] },
    leak: {
      rows: [submitMeta, fetchMeta, msg('creds', 'meta', 'svc', 'credentials: a few ms, about 1 KB'), note('within', 'svc', 'within both limits'), leak],
      line: 3,
      bad: true,
      output: back('cloud credentials', 'bad'),
    },
  }),
}


const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
