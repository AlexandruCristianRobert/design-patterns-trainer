import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const actors: SeqActor[] = [
  { id: 'k8s', name: 'Kubernetes', sub: 'kubelet, Service', tone: 'muted' },
  { id: 'pod', name: 'Pod', sub: 'every replica', tone: 'ui' },
  { id: 'db', name: 'Database', tone: 'io' },
]
const ONE = [
  'builder.Services.AddHealthChecks()',
  '    .AddCheck<DatabaseHealthCheck>("database");',
  '',
  'app.MapHealthChecks("/health");',
  '',
  '// livenessProbe:  GET /health',
  '// readinessProbe: GET /health',
]
const SPLIT = [
  'builder.Services.AddHealthChecks()',
  '    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live"])',
  '    .AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);',
  '',
  'app.MapHealthChecks("/health/live", new HealthCheckOptions',
  '    { Predicate = c => c.Tags.Contains("live") });',
  'app.MapHealthChecks("/health/ready", new HealthCheckOptions',
  '    { Predicate = c => c.Tags.Contains("ready") });',
]
const LONGER = [
  'builder.Services.AddHealthChecks()',
  '    .AddCheck<DatabaseHealthCheck>("database"); // waits up to 30 s',
  '',
  'app.MapHealthChecks("/health");',
  '',
  '// livenessProbe:  GET /health',
  '// readinessProbe: GET /health',
]
const SWAPPED = [
  '// liveness: includes the database check',
  'app.MapHealthChecks("/health/live", new HealthCheckOptions',
  '    { Predicate = c => c.Tags.Contains("db") });',
  '',
  '// readiness: 200 once startup has finished',
  'app.MapHealthChecks("/health/ready", new HealthCheckOptions',
  '    { Predicate = c => c.Tags.Contains("startup") });',
]
const NONE = ['builder.Services.AddHealthChecks(); // removed', 'app.MapHealthChecks("/health");  // removed', '', '// no livenessProbe, no readinessProbe']

const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const spec = (code: string[], steps: Record<string, SeqStep>): SeqSpec => ({ actors, code, outputName: 'Pods', steps })

type K = OutLine['kind']
const pods = (database: string, container: string, traffic: string, kinds: [K?, K?] = []): OutLine[] => [
  { label: 'Database', text: database, kind: database === 'down' ? 'bad' : undefined },
  { label: 'Container', text: container, kind: kinds[0] },
  { label: 'Traffic', text: traffic, kind: kinds[1] },
]
const UP = pods('up', 'running', 'receives requests')

const down = note('down', 'db', 'down for 2 minutes', 'bad')
const liveGet = msg('live', 'k8s', 'pod', 'liveness: GET /health')
const fail503 = msg('503', 'pod', 'k8s', '503 Unhealthy', 'bad')
const restart = note('restart', 'k8s', 'liveness failed: restart', 'bad')

const SPECS: Record<string, SeqSpec> = {
  setup: spec(ONE, {
    probes: {
      rows: [liveGet, msg('ready', 'k8s', 'pod', 'readiness: GET /health'), note('incl', 'pod', '/health includes the database check')],
      line: [0, 6],
      output: UP,
    },
    outage: {
      rows: [down, note('restarts', 'k8s', 'every pod restarted, again and again', 'bad')],
      line: null,
      output: pods('down', 'restarted again and again', '?', ['bad']),
    },
  }),
  'one-endpoint': spec(ONE, {
    probe: { rows: [down, liveGet, msg('check', 'pod', 'db', 'database check: fails', 'bad'), fail503], line: [1, 3], output: pods('down', 'running', 'receives requests') },
    restart: { rows: [down, liveGet, msg('check', 'pod', 'db', 'database check: fails', 'bad'), fail503, restart], line: 5, bad: true, output: pods('down', 'restarted', 'none', ['bad']) },
    again: {
      rows: [down, liveGet, msg('check', 'pod', 'db', 'database check: fails', 'bad'), fail503, restart, note('new', 'pod', 'new container: fails again', 'bad'), note('loop', 'k8s', 'restart again, every replica', 'bad')],
      line: 5,
      bad: true,
      output: pods('down', 'restarted again and again', 'none', ['bad']),
    },
  }),
  split: spec(SPLIT, {
    live: {
      rows: [down, msg('live', 'k8s', 'pod', 'liveness: GET /health/live'), msg('200', 'pod', 'k8s', '200 Healthy', 'ok'), note('keep', 'k8s', 'container keeps running', 'ok')],
      line: { each: [1, [4, 5]] },
      output: pods('down', 'keeps running', '?', ['ok']),
    },
    ready: {
      rows: [
        down,
        msg('live', 'k8s', 'pod', 'liveness: GET /health/live'),
        msg('200', 'pod', 'k8s', '200 Healthy', 'ok'),
        note('keep', 'k8s', 'container keeps running', 'ok'),
        msg('ready', 'k8s', 'pod', 'readiness: GET /health/ready'),
        msg('r503', 'pod', 'k8s', '503 Unhealthy'),
        note('out', 'k8s', 'out of the Service: no traffic', 'ok'),
      ],
      line: { each: [2, [6, 7]] },
      output: pods('down', 'keeps running', 'held back', ['ok', 'ok']),
    },
    recover: {
      rows: [
        note('up', 'db', 'back up', 'ok'),
        msg('ready', 'k8s', 'pod', 'readiness: GET /health/ready'),
        msg('r200', 'pod', 'k8s', '200 Healthy', 'ok'),
        note('in', 'k8s', 'back in the Service, no restart', 'ok'),
      ],
      line: [6, 7],
      output: pods('up', 'never restarted', 'receives requests', ['ok', 'ok']),
    },
  }),

  'timeout-claim': spec(LONGER, {
    timeout: { rows: [liveGet, msg('ready', 'k8s', 'pod', 'readiness: GET /health'), note('wait', 'pod', 'database check waits up to 30 s')], line: 1, output: UP },
    blip: {
      rows: [note('blip', 'db', 'short outage, back within 30 s'), liveGet, note('wait', 'pod', 'database check waits up to 30 s'), msg('200', 'pod', 'k8s', '200 Healthy'), note('no', 'k8s', 'no restart')],
      line: 1,
      output: pods('back within 30 s', 'running', 'receives requests'),
    },
  }),
  'timeout-reality': spec(LONGER, {
    minutes: {
      rows: [down, liveGet, note('wait', 'pod', 'database check fails after 30 s', 'bad'), fail503, note('probe', 'k8s', 'or the probe times out first', 'muted')],
      line: 1,
      bad: true,
      output: pods('down', 'running', 'receives requests'),
    },
    restart: {
      rows: [down, liveGet, note('wait', 'pod', 'database check fails after 30 s', 'bad'), fail503, note('probe', 'k8s', 'or the probe times out first', 'muted'), restart],
      line: 5,
      bad: true,
      output: pods('down', 'restarted again and again', 'none', ['bad']),
    },
  }),

  'swap-claim': spec(SWAPPED, {
    live: { rows: [msg('live', 'k8s', 'pod', 'liveness: GET /health/live'), note('incl', 'pod', 'includes the database check')], line: [0, 2] },
    ready: {
      rows: [msg('live', 'k8s', 'pod', 'liveness: GET /health/live'), note('incl', 'pod', 'includes the database check'), msg('ready', 'k8s', 'pod', 'readiness: GET /health/ready'), note('startup', 'pod', '200 once startup has finished')],
      line: [4, 6],
    },
  }),
  'swap-reality': spec(SWAPPED, {
    outage: {
      rows: [down, msg('live', 'k8s', 'pod', 'liveness: GET /health/live'), msg('503', 'pod', 'k8s', '503 Unhealthy', 'bad'), note('restart', 'k8s', 'liveness failed: restart', 'bad')],
      line: [0, 2],
      bad: true,
      output: pods('down', 'restarted again and again', '?', ['bad']),
    },
    traffic: {
      rows: [
        down,
        msg('live', 'k8s', 'pod', 'liveness: GET /health/live'),
        msg('503', 'pod', 'k8s', '503 Unhealthy', 'bad'),
        note('restart', 'k8s', 'liveness failed: restart', 'bad'),
        msg('ready', 'k8s', 'pod', 'readiness: GET /health/ready'),
        msg('r200', 'pod', 'k8s', '200 Healthy'),
        msg('req', 'k8s', 'pod', 'user requests', 'bad'),
        note('fail', 'pod', 'cannot serve them', 'bad'),
      ],
      line: [4, 6],
      bad: true,
      output: pods('down', 'restarted again and again', 'sent to pods that cannot serve', ['bad', 'bad']),
    },
  }),

  'none-claim': spec(NONE, {
    remove: { rows: [note('none', 'pod', 'no health endpoint'), note('noprobe', 'k8s', 'no probes')], line: [0, 3] },
    crash: {
      rows: [note('none', 'pod', 'no health endpoint'), note('noprobe', 'k8s', 'no probes'), note('crash', 'pod', 'process crashes'), note('restart', 'k8s', 'sees the crash: restart')],
      line: 3,
      output: pods('up', 'restarted after a crash', 'receives requests'),
    },
  }),
  'none-reality': spec(NONE, {
    hung: {
      rows: [note('none', 'pod', 'no health endpoint'), note('noprobe', 'k8s', 'no probes'), note('hung', 'pod', 'process hung, container still running', 'bad'), note('blind', 'k8s', 'nothing to see: no restart', 'bad')],
      line: 3,
      bad: true,
      output: pods('up', 'running, hung', 'receives requests, no answers', ['bad', 'bad']),
    },
    'not-ready': {
      rows: [note('none', 'pod', 'no health endpoint'), note('noprobe', 'k8s', 'no probes'), down, msg('req', 'k8s', 'pod', 'user requests', 'bad'), note('fail', 'pod', 'cannot serve them', 'bad')],
      line: 3,
      bad: true,
      output: pods('down', 'running', 'sent to a pod that cannot serve', [undefined, 'bad']),
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
