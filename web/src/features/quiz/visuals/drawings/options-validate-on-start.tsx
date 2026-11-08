import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const code = (onStart: boolean) => [
  'builder.Services.AddOptions<SmtpOptions>()',
  '    .BindConfiguration("Smtp")',
  onStart ? '    .ValidateDataAnnotations()' : '    .ValidateDataAnnotations();',
  ...(onStart ? ['    .ValidateOnStart();'] : []),
  '',
  'var app = builder.Build();',
  'app.Run();',
  '',
  'class SmtpOptions { [Required] public string? Host { get; set; } }',
  '',
  'class EmailSender(IOptions<SmtpOptions> options)',
  '{',
  '    public Task SendAsync(Mail m) => Send(options.Value.Host, m);',
  '}',
]
const CODE = code(false)
/** The Setup's code: the registration and the options class only; nothing about where the value is read. */
const SETUP_CODE = [...CODE.slice(0, 3), '', CODE[7]]
const ON_START = code(true)
const L = { REG: [0, 2] as [number, number], BUILD: 4, RUN: 5, OPTS: 7, VALUE: 11 }
const O = { REG: [0, 3] as [number, number], START: 4, RUN: 6 }

const ACTORS: SeqActor[] = [
  { id: 'host', name: 'Host', tone: 'ui' },
  { id: 'req', name: 'Requests', tone: 'pool' },
  { id: 'opts', name: 'Options', sub: 'SmtpOptions', tone: 'io' },
]
const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const spec = (steps: Record<string, SeqStep>, c = CODE): SeqSpec => ({ actors: ACTORS, code: c, steps })

const REG = row('reg', 'opts', 'Host [Required]')
const MISSING = row('cfg', 'opts', 'config: no Host')
const BUILD = row('build', 'host', 'Build()')
const START = row('start', 'host', 'starts')
const NOINST = row('noinst', 'opts', 'no instance yet', undefined, 'ok')
const SERVE = row('serve', 'req', 'other requests', undefined, 'ok')
const FIRST = [row('val', 'req', 'options.Value', 'opts'), row('create', 'opts', 'created, validated'), row('ex', 'opts', 'throws', 'req', 'bad'), row('fail', 'req', 'email request fails', undefined, 'bad')]
const LAZY_END = [REG, MISSING, BUILD, NOINST, START, SERVE, ...FIRST]

const SPECS: Record<string, SeqSpec> = {
  // ---- Setup: the registration, the missing value, and the app's life; no point marked as where it fails ----
  setup: spec({
    register: { rows: [REG], line: { each: [L.REG, 4] } },
    missing: { rows: [REG, MISSING], line: 4 },
    ask: { rows: [REG, MISSING, row('q', 'opts', 'error: when?', undefined, 'muted')], line: null },
  }, SETUP_CODE),

  lazy: spec({
    build: { rows: [REG, MISSING, BUILD, NOINST], line: L.BUILD },
    start: { rows: [REG, MISSING, BUILD, NOINST, START, SERVE], line: L.RUN },
    first: { rows: LAZY_END, line: L.VALUE, bad: true },
  }),
  onstart: spec(
    {
      validate: { rows: [REG, MISSING, BUILD, row('vos', 'host', 'validate on start', 'opts')], line: O.REG },
      stop: { rows: [REG, MISSING, BUILD, row('vos', 'host', 'validate on start', 'opts'), row('ex', 'opts', 'throws', 'host', 'bad'), row('nostart', 'host', 'start fails', undefined, 'ok')], line: O.RUN },
    },
    ON_START,
  ),

  'build-claim': spec({
    register: { rows: [REG, MISSING, row('chk', 'opts', 'check at Build()')], line: L.REG },
    build: { rows: [REG, MISSING, row('chk', 'opts', 'check at Build()'), row('build', 'host', 'Build()', 'opts'), row('err', 'host', 'error here')], line: L.BUILD },
  }),
  'build-reality': spec({
    build: { rows: [REG, MISSING, row('build', 'host', 'Build() ok', undefined, 'ok'), NOINST], line: L.BUILD },
    later: { rows: LAZY_END, line: L.VALUE, bad: true },
  }),

  'never-claim': spec({
    mvc: { rows: [REG, MISSING, row('mvc', 'opts', 'MVC only')], line: L.OPTS },
    never: { rows: [REG, MISSING, row('mvc', 'opts', 'MVC only'), row('val', 'req', 'options.Value', 'opts'), row('null', 'opts', 'Host = null', 'req'), row('none', 'opts', 'no error')], line: L.VALUE },
  }),
  'never-reality': spec({
    wired: { rows: [REG, MISSING, row('wired', 'opts', 'annotations checked', undefined, 'ok')], line: L.REG },
    throws: { rows: [REG, MISSING, row('wired', 'opts', 'annotations checked', undefined, 'ok'), ...FIRST], line: L.VALUE, bad: true },
  }),

  'every-claim': spec({
    inject: { rows: [REG, MISSING, row('i1', 'req', 'request 1: inject', 'opts'), row('v1', 'opts', 'validate')], line: 9 },
    every: {
      rows: [REG, MISSING, row('i1', 'req', 'request 1: inject', 'opts'), row('v1', 'opts', 'validate'), row('e1', 'req', 'error'), row('i2', 'req', 'request 2: inject', 'opts'), row('v2', 'opts', 'validate'), row('e2', 'req', 'error')],
      line: 9,
    },
  }),
  'every-reality': spec({
    inject: { rows: [REG, MISSING, row('i1', 'req', 'inject', 'opts'), row('n1', 'opts', 'nothing checked', undefined, 'ok'), SERVE], line: 9 },
    once: {
      rows: [REG, MISSING, row('i1', 'req', 'inject', 'opts'), row('n1', 'opts', 'nothing checked', undefined, 'ok'), SERVE, row('val', 'req', 'options.Value', 'opts'), row('create', 'opts', 'validated on create'), row('ex', 'opts', 'throws', 'req', 'bad'), row('cache', 'opts', 'if valid: cached')],
      line: L.VALUE,
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
