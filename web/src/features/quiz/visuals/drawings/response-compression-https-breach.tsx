import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const SETUP = ['builder.Services.AddResponseCompression();', '// …', 'app.UseResponseCompression();']
const DEFAULT = [
  'builder.Services.AddResponseCompression(o =>',
  '{',
  '    // o.EnableForHttps: false by default',
  '});',
  'app.UseResponseCompression();',
]
const D = { OPT: 2 }
const PAGE = [
  '<!-- one response holds both -->',
  '<input name="__RequestVerificationToken"',
  '       value="token=7f3a…">',
  '<p>Results for @Request.Query["q"]</p>',
]
const P = { SECRET: [1, 2] as [number, number], ECHO: 3 }

const BROWSER: SeqActor = { id: 'browser', name: 'Browser', tone: 'ui' }
const APP: SeqActor = { id: 'app', name: 'App', sub: 'compression middleware', tone: 'pool' }
const ATTACKER: SeqActor = { id: 'eve', name: 'Attacker', sub: 'sees sizes only', tone: 'bad' }
const KESTREL: SeqActor = { id: 'kestrel', name: 'Kestrel', sub: 'connection', tone: 'io' }
const MIDDLEWARE: SeqActor = { id: 'app', name: 'Middleware', sub: 'compression', tone: 'pool' }

const spec = (steps: Record<string, SeqStep>, code: string[], actors = [BROWSER, APP]): SeqSpec => ({ actors, code, outputName: 'Response', steps })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const body = (text: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'Body', text, kind }]

// ---- Shared rows ----
const get = msg('get', 'browser', 'app', 'GET /page (HTTPS)')
const getAccept = msg('get', 'browser', 'app', 'Accept-Encoding: gzip, br')
const skip = note('skip', 'app', 'HTTPS, EnableForHttps false: skip')
const plain = msg('resp', 'app', 'browser', '200, uncompressed')

const size = (key: string, guess: string, bytes: string, kind?: SeqRow['kind']): SeqRow[] => [
  msg(`${key}-q`, 'browser', 'app', `?q=${guess}`),
  msg(`${key}-r`, 'app', 'browser', `${bytes} bytes`, kind),
  note(`${key}-seen`, 'eve', `${guess}: ${bytes}`, kind),
]
const PAGE_ROW = note('page', 'app', 'token + echoed q')
const G1 = [msg('lure', 'eve', 'browser', 'lure: send guesses'), ...size('g1', 'token=1', '1,203')]
const G7 = size('g7', 'token=7', '1,201', 'bad')

const SPECS: Record<string, SeqSpec> = {
  setup: spec(
    {
      config: { rows: [note('mw', 'app', 'compression added')], line: [0, 2] },
      request: { rows: [note('mw', 'app', 'compression added'), get, plain], line: 2, output: body('not compressed') },
    },
    SETUP,
  ),

  default: spec(
    {
      request: { rows: [getAccept], line: 4 },
      check: { rows: [getAccept, skip], line: D.OPT },
      response: { rows: [getAccept, skip, plain], line: D.OPT, output: body('not compressed, by default', 'ok') },
    },
    DEFAULT,
  ),
  breach: spec(
    {
      page: { rows: [PAGE_ROW], line: { each: [P.SECRET, P.ECHO] } },
      guess: { rows: [PAGE_ROW, ...G1], line: P.ECHO, output: [{ label: 'token=1', text: '1,203 bytes' }] },
      match: {
        rows: [PAGE_ROW, ...G1, ...G7],
        line: { each: [P.SECRET, P.ECHO] },
        bad: true,
        output: [
          { label: 'token=1', text: '1,203 bytes' },
          { label: 'token=7', text: '1,201 bytes: shorter', kind: 'bad' },
        ],
      },
      repeat: {
        rows: [PAGE_ROW, ...G1, ...G7, note('next', 'eve', 'next char: token=7f…', 'bad')],
        line: { each: [P.SECRET, P.ECHO] },
        bad: true,
        output: [{ label: 'Secret', text: 'leaks guess by guess', kind: 'bad' }],
      },
    },
    PAGE,
    [ATTACKER, BROWSER, APP],
  ),

  'tls-claim': spec(
    {
      tls: { rows: [get, msg('resp', 'app', 'browser', 'TLS compresses it', 'bad')], line: null, output: body('compressed by TLS') },
      waste: {
        rows: [get, note('gzip', 'app', 'app gzip: CPU, no gain'), msg('resp', 'app', 'browser', 'TLS compresses it', 'bad')],
        line: [0, 2],
        output: body('compressed by TLS'),
      },
    },
    SETUP,
  ),
  'tls-reality': spec(
    {
      tls: { rows: [get, msg('resp', 'app', 'browser', 'TLS: no compression', 'ok')], line: null, output: body('full size') },
      waste: { rows: [get, skip, msg('resp', 'app', 'browser', 'TLS: no compression', 'ok')], line: [0, 2], output: body('full size on the wire', 'bad') },
    },
    SETUP,
  ),

  'kestrel-claim': spec(
    {
      kestrel: { rows: [get, note('k', 'kestrel', 'compresses HTTPS', 'bad')], line: null, output: body('compressed by Kestrel') },
      skip: { rows: [get, note('k', 'kestrel', 'compresses HTTPS', 'bad'), note('leave', 'app', 'leaves HTTPS alone')], line: 2, output: body('compressed by Kestrel') },
    },
    SETUP,
    [BROWSER, KESTREL, MIDDLEWARE],
  ),
  'kestrel-reality': spec(
    {
      kestrel: { rows: [get, note('k', 'kestrel', 'no body compression', 'ok')], line: null },
      skip: { rows: [get, note('k', 'kestrel', 'no body compression', 'ok'), skip, plain], line: 2, output: body('not compressed', 'bad') },
    },
    SETUP,
    [BROWSER, KESTREL, MIDDLEWARE],
  ),

  'accept-claim': spec(
    {
      request: { rows: [msg('get', 'browser', 'app', 'no Accept-Encoding', 'bad')], line: null },
      skip: { rows: [msg('get', 'browser', 'app', 'no Accept-Encoding', 'bad'), note('none', 'app', 'no client accepts it')], line: 2, output: body('not compressed') },
    },
    SETUP,
  ),
  'accept-reality': spec(
    {
      request: { rows: [msg('get', 'browser', 'app', 'Accept-Encoding: gzip, deflate, br', 'ok')], line: null },
      skip: { rows: [msg('get', 'browser', 'app', 'Accept-Encoding: gzip, deflate, br', 'ok'), skip, plain], line: D.OPT, output: body('not compressed, by default') },
    },
    DEFAULT,
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
