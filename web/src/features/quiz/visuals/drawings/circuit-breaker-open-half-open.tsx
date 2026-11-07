import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type ChipKind, type RowDef, type RowSpec, type RowStep } from '../RowStage'
import { StateStage, type MachineEdge, type MachineState, type StateSpec, type StateStep } from '../StateStage'

const CALLER: RowDef = { id: 'caller', name: 'Caller', sub: 'its requests', tone: 'ui' }
const CALLS: RowDef = { id: 'calls', name: 'Calls', sub: 'to the pricing service', tone: 'pool' }
const SERVICE: RowDef = { id: 'service', name: 'Pricing service', tone: 'io' }
const BREAKER: RowDef = { id: 'breaker', name: 'Circuit breaker', tone: 'muted' }
const QUEUE: RowDef = { id: 'queue', name: 'Queue', sub: 'held in memory', tone: 'muted' }

const STATES: MachineState[] = [
  { id: 'closed', name: 'Closed', sub: 'calls go through', tone: 'ok' },
  { id: 'open', name: 'Open', sub: 'calls fail at once', tone: 'bad' },
  { id: 'half', name: 'Half-open', sub: 'trial calls', tone: 'warn' },
]
const EDGES: MachineEdge[] = [
  { id: 'trip', from: 'closed', to: 'open', label: 'failures pass the threshold' },
  { id: 'wait', from: 'open', to: 'half', label: 'break duration is over' },
  { id: 'reclose', from: 'half', to: 'closed', label: 'trial call succeeds' },
  { id: 'reopen', from: 'half', to: 'open', label: 'trial call fails' },
]

const chip = (key: string, label: string, kind: ChipKind = 'item'): Chip => ({ key, label, kind })
const timeout = (n: number, wait = '10 s'): Chip => chip(`c${n}`, `#${n} waits ${wait}, fails`, 'bad')
const fast = (n: number): Chip => chip(`c${n}`, `#${n} fails at once`, 'ok')
const ok = (n: number, what = '200 OK'): Chip => chip(`c${n}`, `#${n} ${what}`, 'ok')
const down = [chip('svc', 'down', 'bad')]
const waiting = (...ns: number[]): Chip[] => ns.map((n) => chip(`r${n}`, `#${n} waiting`, 'wait'))
const fallback = [chip('fb', 'fallback price, no wait', 'ok')]
const live = [chip('fb', 'live price', 'ok')]

const machine = (rows: RowDef[], steps: Record<string, StateStep>): StateSpec => ({ rows, states: STATES, edges: EDGES, steps })
const plain = (rows: RowDef[], steps: Record<string, RowStep>): RowSpec => ({ rows, steps })

// ---- Reality: the whole cycle ----
const R = {
  closed: { state: 'closed', rows: { calls: [timeout(1), timeout(2), timeout(3)], service: down, caller: waiting(1, 2, 3) } },
  open: {
    state: 'open',
    edge: 'trip',
    rows: { calls: [timeout(3), fast(4), fast(5)], service: [chip('svc', 'down, gets no calls', 'bad')], caller: fallback },
  },
  half: { state: 'half', edge: 'wait', rows: { calls: [fast(5), chip('c6', '#6 trial call sent', 'run')], service: down, caller: fallback } },
  trialFails: { state: 'open', edge: 'reopen', rows: { calls: [chip('c6', '#6 trial: waits 10 s, fails', 'bad'), fast(7)], service: down, caller: fallback } },
  closes: { state: 'closed', edge: 'reclose', rows: { calls: [ok(8, 'trial: 200 OK'), ok(9)], service: [chip('svc', 'back up', 'ok')], caller: live } },
} satisfies Record<string, StateStep>

const SPECS: Record<string, StateSpec | RowSpec> = {
  setup: plain([CALLER, CALLS, SERVICE, BREAKER], {
    down: { rows: { calls: [timeout(1)], service: down } },
    'pile-up': { rows: { caller: waiting(1, 2, 3, 4), calls: [timeout(1), timeout(2), timeout(3), timeout(4)], service: down } },
    'add-breaker': {
      rows: { caller: waiting(1, 2, 3, 4), calls: [timeout(1), timeout(2), timeout(3), timeout(4)], service: down, breaker: [chip('br', '?', 'gone')] },
    },
  }),
  breaker: machine([CALLER, CALLS, SERVICE], { closed: R.closed, open: R.open, 'half-open': R.half, 'trial-fails': R.trialFails, closes: R.closes }),

  'retry-other-claim': plain([CALLS, { ...SERVICE, name: 'Pricing instances' }], {
    fail: { rows: { calls: [chip('a', '#1 to instance 1: waits 10 s, fails', 'bad')], service: [chip('i1', 'instance 1', 'bad')] } },
    retry: {
      rows: {
        calls: [chip('a', '#1 to instance 1: waits 10 s, fails', 'bad'), chip('b', '#1 again, to instance 2', 'run')],
        service: [chip('i1', 'instance 1', 'bad'), chip('i2', 'instance 2')],
      },
    },
    success: {
      rows: {
        calls: [chip('a', '#1 to instance 1: waits 10 s, fails', 'bad'), chip('b', '#1 again, to instance 2: fails', 'bad'), chip('c', '#1 again, to instance 3: 200 OK', 'ok')],
        service: [chip('i1', 'instance 1', 'bad'), chip('i2', 'instance 2', 'bad'), chip('i3', 'instance 3', 'ok')],
      },
    },
  }),
  'retry-other-reality': machine([CALLER, CALLS, SERVICE], {
    fail: { state: 'closed', rows: { calls: [timeout(1)], service: down, caller: waiting(1) } },
    retry: { state: 'open', edge: 'trip', rows: { calls: [timeout(1), timeout(2), timeout(3)], service: [chip('svc', 'down, gets no calls', 'bad')], caller: waiting(1, 2, 3) } },
    success: { state: 'open', edge: 'trip', rows: { calls: [timeout(3), fast(4), fast(5)], service: [chip('svc', 'down, gets no calls', 'bad')], caller: fallback } },
  }),

  'queue-replay-claim': plain([CALLS, QUEUE, SERVICE], {
    fail: { rows: { calls: [timeout(1), timeout(2), timeout(3)], service: down } },
    queue: { rows: { calls: [timeout(1), timeout(2), timeout(3)], queue: [chip('q1', '#1'), chip('q2', '#2'), chip('q3', '#3')], service: down } },
    replay: { rows: { calls: [ok(1, 'replayed: 200 OK'), ok(2, 'replayed: 200 OK'), ok(3, 'replayed: 200 OK')], queue: [], service: [chip('svc', 'healthy', 'ok')] } },
  }),
  'queue-replay-reality': machine([CALLER, CALLS, QUEUE, SERVICE], {
    fail: { state: 'closed', rows: { calls: [timeout(1), timeout(2), timeout(3)], service: down, caller: waiting(1, 2, 3) } },
    queue: {
      state: 'open',
      edge: 'trip',
      rows: { calls: [timeout(3), fast(4), fast(5)], queue: [chip('none', 'nothing stored', 'gone')], service: [chip('svc', 'down, gets no calls', 'bad')], caller: fallback },
    },
    replay: {
      state: 'closed',
      edge: 'reclose',
      rows: { calls: [ok(8, 'trial: 200 OK'), ok(9)], queue: [chip('none', 'nothing replayed', 'gone')], service: [chip('svc', 'healthy', 'ok')], caller: live },
    },
  }),

  'short-timeout-claim': plain([CALLS, SERVICE], {
    first: { rows: { calls: [timeout(1)], service: down } },
    shorter: { rows: { calls: [timeout(1), chip('c2', '#2 waits 1 s, fails', 'bad')], service: down } },
    every: { rows: { calls: [timeout(1), chip('c2', '#2 waits 1 s, fails', 'bad'), chip('c3', '#3 waits 1 s, fails', 'bad'), chip('c4', '#4 waits 1 s, fails', 'bad')], service: [chip('svc', 'down, gets every call', 'bad')] } },
  }),
  'short-timeout-reality': machine([CALLER, CALLS, SERVICE], {
    first: { state: 'closed', rows: { calls: [timeout(1)], service: down, caller: waiting(1) } },
    shorter: { state: 'closed', rows: { calls: [timeout(1), timeout(2), timeout(3)], service: down, caller: waiting(1, 2, 3) } },
    every: { state: 'open', edge: 'trip', rows: { calls: [timeout(3), fast(4), fast(5)], service: [chip('svc', 'down, gets no calls', 'bad')], caller: fallback } },
  }),
}

const isMachine = (s: StateSpec | RowSpec): s is StateSpec => 'states' in s

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, spec]) => [
    stage,
    (p: StageDrawingProps) => (isMachine(spec) ? <StateStage spec={spec} {...p} /> : <RowStage spec={spec} {...p} />),
  ]),
)
export default drawing
