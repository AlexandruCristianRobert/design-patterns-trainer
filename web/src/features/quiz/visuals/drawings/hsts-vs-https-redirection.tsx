import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = ['if (!app.Environment.IsDevelopment())', '    app.UseHsts();', '', 'app.UseHttpsRedirection();']
const L = { HSTS: [0, 1] as [number, number], REDIRECT: 3 }

const actors: SeqActor[] = [
  { id: 'browser', name: 'Browser', tone: 'ui' },
  { id: 'net', name: 'Network', sub: 'e.g. public Wi-Fi', tone: 'muted' },
  { id: 'site', name: 'shop.example', sub: 'ASP.NET Core', tone: 'io' },
]
const spec = (steps: Record<string, SeqStep>): SeqSpec => ({ actors, code: CODE, outputName: 'Browser memory', steps })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const memory = (text: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'shop.example', text, kind }]
const UNKNOWN = memory('no HSTS entry', 'muted')
const KNOWN = memory('HTTPS only, max-age 30 days', 'ok')

const typed = note('typed', 'browser', 'opens an http:// address')
const plain = msg('plain', 'browser', 'site', 'GET http://shop.example', 'bad')
const redirect = msg('redirect', 'site', 'browser', '307 to https://shop.example')
const hstsHeader = msg('header', 'site', 'browser', 'HTTPS + Strict-Transport-Security', 'ok')
const upgrade = note('upgrade', 'browser', 'upgrades to HTTPS itself', 'ok')
const secure = msg('secure', 'browser', 'site', 'GET https://shop.example', 'ok')

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    redirect: { rows: [note('redir', 'site', 'UseHttpsRedirection: http → https')], line: L.REDIRECT },
    hsts: { rows: [note('redir', 'site', 'UseHttpsRedirection: http → https'), note('hsts', 'site', 'UseHsts: adds what?', 'muted')], line: L.HSTS },
  }),

  'redirect-only': spec({
    type: { rows: [typed, plain, note('read', 'net', 'sees plain HTTP')], line: L.REDIRECT, output: UNKNOWN },
    strip: {
      rows: [typed, msg('plain', 'browser', 'net', 'GET http://shop.example', 'bad'), note('read', 'net', 'attacker intercepts', 'bad'), msg('fake', 'net', 'browser', 'fake page, plain HTTP', 'bad'), note('never', 'site', 'redirect never sent', 'muted')],
      line: L.REDIRECT,
      bad: true,
      output: UNKNOWN,
    },
  }),
  'with-hsts': spec({
    first: { rows: [hstsHeader], line: L.HSTS, output: KNOWN },
    later: { rows: [hstsHeader, typed, upgrade], line: L.HSTS, output: KNOWN },
    safe: { rows: [hstsHeader, typed, upgrade, secure, note('nothing', 'net', 'no plain HTTP to answer', 'ok')], line: L.HSTS, output: KNOWN },
  }),

  'port80-claim': spec({
    refuse: { rows: [msg('plain', 'browser', 'site', 'GET http://shop.example'), note('refused', 'site', 'port 80 refused', 'bad')], line: L.HSTS },
    'no-redirect': { rows: [msg('plain', 'browser', 'site', 'GET http://shop.example'), note('refused', 'site', 'port 80 refused', 'bad'), note('unneeded', 'site', 'redirect never needed', 'bad')], line: L.REDIRECT },
  }),
  'port80-reality': spec({
    refuse: { rows: [hstsHeader, note('listens', 'site', 'still listens on port 80')], line: L.HSTS, output: KNOWN },
    'no-redirect': {
      rows: [note('new', 'browser', 'never got the header'), plain, redirect, note('ignored', 'browser', 'header over HTTP: ignored', 'muted')],
      line: L.REDIRECT,
      output: UNKNOWN,
    },
  }),

  'cookie-claim': spec({
    encrypt: { rows: [note('key', 'site', 'cookie encrypted with extra key', 'bad')], line: L.HSTS },
    broken: { rows: [note('key', 'site', 'cookie encrypted with extra key', 'bad'), note('tls', 'net', 'TLS broken', 'bad'), note('safe', 'browser', 'cookie still protected', 'bad')], line: L.HSTS },
  }),
  'cookie-reality': spec({
    encrypt: { rows: [hstsHeader, note('nokey', 'site', 'no cookie encryption', 'muted')], line: L.HSTS, output: KNOWN },
    broken: {
      rows: [hstsHeader, note('nokey', 'site', 'no cookie encryption', 'muted'), msg('cookie', 'site', 'browser', 'Set-Cookie: …; Secure', 'ok'), note('kept', 'browser', 'cookie never sent over HTTP', 'ok')],
      line: null,
      output: KNOWN,
    },
  }),

  'pinning-claim': spec({
    pin: { rows: [note('pin', 'browser', 'pins the site certificate', 'bad')], line: L.HSTS },
    refuse: { rows: [note('pin', 'browser', 'pins the site certificate', 'bad'), msg('other', 'net', 'browser', 'cert from another CA'), note('refused', 'browser', 'refused', 'bad')], line: L.HSTS },
  }),
  'pinning-reality': spec({
    pin: { rows: [hstsHeader, note('nopin', 'browser', 'no certificate pinned', 'muted')], line: L.HSTS, output: KNOWN },
    refuse: {
      rows: [hstsHeader, note('nopin', 'browser', 'no certificate pinned', 'muted'), note('noclick', 'browser', 'cert errors: no click-through', 'ok'), msg('other', 'site', 'browser', 'valid cert, other trusted CA'), note('accepted', 'browser', 'accepted', 'muted')],
      line: L.HSTS,
      output: KNOWN,
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
