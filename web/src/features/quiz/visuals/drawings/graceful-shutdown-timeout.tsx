import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const DEFAULTS = [
  '// app: ShutdownTimeout not set',
  '//   → 30 s by default',
  '# pod: terminationGracePeriodSeconds',
  '#   not set → 30 by default',
]
const D = { HOST: [0, 1] as [number, number], POD: [2, 3] as [number, number] }
const RAISED = [
  'services.Configure<HostOptions>(o =>',
  '    o.ShutdownTimeout =',
  '        TimeSpan.FromSeconds(75));',
  '# pod spec',
  'terminationGracePeriodSeconds: 90',
]
const R = { HOST: [0, 2] as [number, number], POD: [3, 4] as [number, number] }
const EXIT = [
  'PosixSignalRegistration.Create(PosixSignal.SIGTERM,',
  '    _ => Environment.Exit(0));',
]
const HOSTED = [
  '// the long work moved out of the endpoint',
  'builder.Services.AddHostedService<LongJob>();',
]

const K8S: SeqActor = { id: 'k8s', name: 'Kubernetes', tone: 'muted' }
const HOST: SeqActor = { id: 'host', name: 'App host', sub: 'Kestrel', tone: 'ui' }
const REQ: SeqActor = { id: 'req', name: 'Long request', sub: 'up to 60 s', tone: 'io' }
const JOB: SeqActor = { id: 'req', name: 'Hosted service', sub: 'up to 60 s', tone: 'io' }

const spec = (steps: Record<string, SeqStep>, code: string[] | null, actors = [K8S, HOST, REQ]): SeqSpec => ({
  actors,
  code: code ?? undefined,
  outputName: 'Outcome',
  steps,
})
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const out = (text: string, kind?: OutLine['kind'], label = 'Request'): OutLine[] => [{ label, text, kind }]

// ---- Shared rows ----
const running = note('run', 'req', 'running')
const sigterm = msg('term', 'k8s', 'host', '0 s: SIGTERM')
const drain = note('drain', 'host', 'stop accepting, wait')
const SHUTDOWN = [running, sigterm, drain]
const abort = msg('abort', 'host', 'req', '30 s: abort', 'bad')
const kill = msg('kill', 'k8s', 'host', '30 s: SIGKILL', 'bad')
const cut = note('cut', 'req', 'cut at 30 s', 'bad')

const SPECS: Record<string, SeqSpec> = {
  setup: spec(
    {
      running: { rows: [running], output: out('running') },
      deploy: { rows: [running, msg('deploy', 'k8s', 'host', 'replace pod')], output: out('running') },
      cut: { rows: [running, msg('deploy', 'k8s', 'host', 'replace pod'), note('cut', 'req', 'cut off', 'bad')], output: out('cut off mid-way', 'bad') },
    },
    null,
  ),

  defaults: spec(
    {
      sigterm: { rows: SHUTDOWN, output: out('running'), line: null },
      timeout: { rows: [...SHUTDOWN, note('limit', 'host', '30 s: timeout', 'bad'), abort], output: out('aborted at 30 s', 'bad'), line: D.HOST, bad: true },
      kill: { rows: [...SHUTDOWN, note('limit', 'host', '30 s: timeout', 'bad'), abort, kill], output: out('aborted at 30 s', 'bad'), line: D.POD, bad: true },
    },
    DEFAULTS,
  ),
  raised: spec(
    {
      sigterm: { rows: SHUTDOWN, output: out('running'), line: { each: [R.HOST, R.POD] } },
      drain: { rows: [...SHUTDOWN, msg('done', 'req', 'host', '60 s: response', 'ok')], output: out('completed at 60 s', 'ok'), line: R.HOST },
      exit: {
        rows: [...SHUTDOWN, msg('done', 'req', 'host', '60 s: response', 'ok'), note('exit', 'host', '~60 s: exits', 'ok'), note('nokill', 'k8s', 'no SIGKILL', 'skip')],
        output: out('completed at 60 s', 'ok'),
        line: R.POD,
      },
    },
    RAISED,
  ),

  'k8s-waits-claim': spec(
    {
      sigterm: { rows: [running, sigterm], output: out('running'), line: null },
      wait: {
        rows: [running, sigterm, note('wait', 'k8s', 'waits for connections', 'bad'), msg('done', 'req', 'host', '60 s: response'), msg('stop', 'k8s', 'host', 'then stops pod')],
        output: out('completed at 60 s', 'bad'),
        line: null,
        bad: true,
      },
    },
    DEFAULTS,
  ),
  'k8s-waits-reality': spec(
    {
      sigterm: { rows: [running, sigterm], output: out('running'), line: null },
      wait: { rows: [running, sigterm, drain, kill, cut], output: out('cut at 30 s', 'bad'), line: { each: [D.HOST, D.POD] } },
    },
    DEFAULTS,
  ),

  'exit-claim': spec(
    {
      sigterm: { rows: [running, sigterm], output: out('running'), line: 0 },
      exit: {
        rows: [running, sigterm, note('exit', 'host', 'Exit(0) at once'), note('stopped', 'k8s', 'stopped before SIGKILL')],
        output: out('stops before SIGKILL', undefined, 'Pod'),
        line: [0, 1],
        bad: true,
      },
    },
    EXIT,
  ),
  'exit-reality': spec(
    {
      sigterm: { rows: [running, sigterm], output: out('running'), line: 0 },
      exit: {
        rows: [running, sigterm, note('exit', 'host', 'Exit(0) at once'), msg('abort', 'host', 'req', '0 s: process ends', 'bad'), note('cut', 'req', 'cut at 0 s', 'bad')],
        output: out('aborted at once', 'bad'),
        line: [0, 1],
      },
    },
    EXIT,
  ),

  'hosted-claim': spec(
    {
      sigterm: { rows: [running, sigterm], output: out('running', undefined, 'Work'), line: 1 },
      wait: {
        rows: [running, sigterm, note('wait', 'host', 'waits, no limit', 'bad'), msg('done', 'req', 'host', '60 s: done')],
        output: out('finished at 60 s', 'bad', 'Work'),
        line: 1,
        bad: true,
      },
    },
    HOSTED,
    [K8S, HOST, JOB],
  ),
  'hosted-reality': spec(
    {
      sigterm: { rows: [running, sigterm], output: out('running', undefined, 'Work'), line: 1 },
      wait: { rows: [running, sigterm, note('limit', 'host', '30 s: timeout', 'bad'), note('stop', 'host', 'stops waiting', 'bad')], output: out('abandoned at 30 s', 'bad', 'Work'), line: 1 },
      kill: {
        rows: [running, sigterm, note('limit', 'host', '30 s: timeout', 'bad'), note('stop', 'host', 'stops waiting', 'bad'), kill, note('cut', 'req', 'cut at 30 s', 'bad')],
        output: out('cut at 30 s', 'bad', 'Work'),
        line: 1,
      },
    },
    HOSTED,
    [K8S, HOST, JOB],
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
