import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type ChipKind, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const CODE = [
  '[HttpGet]',
  'public string Get()',
  '{',
  '    var body = _client.GetStringAsync(url).Result;',
  '    return body;',
  '}',
]
const AWAITED = [
  '[HttpGet]',
  'public async Task<string> Get()',
  '{',
  '    var body = await _client.GetStringAsync(url);',
  '    return body;',
  '}',
]
const L = { RESULT: 3, RETURN: 4 }

const ROW: Record<string, RowDef> = {
  requests: { id: 'requests', name: 'Requests', sub: 'arriving', tone: 'ui' },
  responses: { id: 'responses', name: 'Responses', tone: 'ok' },
  lib: { id: 'lib', name: 'Library', sub: 'inside GetStringAsync', tone: 'muted' },
  threads: { id: 'threads', name: 'Pool threads', sub: 'simplified: 4', tone: 'pool' },
  queue: { id: 'queue', name: 'Waiting', sub: 'for a free thread', tone: 'muted' },
  io: { id: 'io', name: 'In flight', sub: 'HTTP calls', tone: 'io' },
  outcome: { id: 'outcome', name: 'Outcome', tone: 'muted' },
}
const POOL = ['threads', 'queue', 'io', 'outcome'].map((id) => ROW[id])
const spec = (steps: Record<string, RowStep>, rows = POOL, code = CODE): RowSpec => ({ rows, code, steps })

const chip = (key: string, label: string, kind: ChipKind = 'item'): Chip => ({ key, label, kind })
const free = (n: number): Chip => chip(`t${n}`, 'free', 'gone')
const blocked = (n: number, t = n): Chip => chip(`t${t}`, `req ${n}: blocked`, 'wait')
const call = (n: number): Chip => chip(`c${n}`, `call ${n}`, 'run')
const cont = (n: number): Chip => chip(`k${n}`, `cont ${n}`, 'wait')
const req = (n: number): Chip => chip(`r${n}`, `req ${n}`, 'wait')
const more = (key = 'more'): Chip => chip(key, '…', 'wait')

const ONE: RowStep = { rows: { threads: [blocked(1), free(2), free(3), free(4)], io: [call(1)] }, line: L.RESULT }
const ALL_BLOCKED = [blocked(1), blocked(2), blocked(3), blocked(4)]
const LOAD: RowStep = { rows: { threads: ALL_BLOCKED, queue: [req(5), req(6), more()], io: [1, 2, 3, 4].map(call) }, line: L.RESULT }
const REPLIES: RowStep = { rows: { threads: ALL_BLOCKED, queue: [req(5), req(6), cont(1), cont(2), cont(3), cont(4), more()] }, line: L.RESULT }
const GROW: RowStep = { rows: { threads: [...ALL_BLOCKED, blocked(5, 5)], queue: [req(6), cont(1), cont(2), cont(3), cont(4), req(7), more()] }, line: L.RESULT }
const STARVED: RowStep = {
  ...GROW,
  rows: { ...GROW.rows, queue: [req(6), cont(1), cont(2), cont(3), cont(4), req(7), req(8), more()], outcome: [chip('lat', 'latency climbs', 'bad'), chip('to', 'timeouts', 'bad')] },
}

const SPECS: Record<string, RowSpec> = {
  setup: spec(
    {
      testing: { rows: { requests: [chip('r1', 'req 1')], responses: [chip('ok1', 'req 1: fast', 'ok')] }, line: L.RESULT },
      load: { rows: { requests: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => chip(`r${n}`, `req ${n}`)).concat(more()), responses: [chip('q', '?', 'wait')] }, line: L.RESULT },
    },
    [ROW.requests, ROW.responses],
  ),

  blocked: spec({
    one: ONE,
    resume: { rows: { threads: [chip('t1', 'req 1: runs on', 'ok'), chip('t2', 'cont 1', 'run'), free(3), free(4)] }, line: L.RETURN },
    load: LOAD,
    replies: REPLIES,
    grow: GROW,
    starved: STARVED,
  }),
  awaited: spec(
    {
      release: { rows: { threads: [free(1), free(2), free(3), free(4)], io: [1, 2, 3, 4, 5, 6].map(call).concat(more()) }, line: L.RESULT },
      resume: {
        rows: { threads: [chip('t1', 'cont 1', 'run'), chip('t2', 'cont 2', 'run'), chip('t3', 'req 7', 'run'), free(4)], io: [3, 4, 5, 6].map(call).concat(more()), outcome: [chip('lat', 'latency steady', 'ok')] },
        line: L.RETURN,
      },
    },
    POOL,
    AWAITED,
  ),

  'deadlock-claim': spec({
    block: ONE,
    post: { rows: { threads: [blocked(1), free(2), free(3), free(4)], queue: [chip('k1', 'cont 1: needs req 1 thread', 'bad')], outcome: [chip('dl', 'deadlock', 'bad')] }, line: L.RESULT },
  }),
  'deadlock-reality': spec({
    block: ONE,
    post: { rows: { threads: [chip('t1', 'req 1: runs on', 'ok'), chip('t2', 'cont 1', 'run'), free(3), free(4)], outcome: [chip('done', 'req 1 completes', 'ok')] }, line: L.RETURN },
  }),

  'reject-claim': spec({
    block: ONE,
    reject: { rows: { threads: [blocked(1), free(2), free(3), free(4)], io: [call(1)], outcome: [chip('500', '500 from Kestrel', 'bad')] }, line: L.RESULT, bad: true },
  }),
  'reject-reality': spec({
    block: ONE,
    reject: { ...STARVED, rows: { ...STARVED.rows, outcome: [chip('no500', 'no error from Kestrel', 'item'), chip('lat', 'latency climbs', 'bad'), chip('to', 'timeouts', 'bad')] } },
  }),

  'configureawait-claim': spec(
    {
      library: { rows: { lib: [chip('caf', 'ConfigureAwait(false) everywhere', 'item')] }, line: L.RESULT },
      load: { rows: { lib: [chip('caf', 'ConfigureAwait(false) everywhere', 'item')], outcome: [chip('fine', 'fine under load', 'bad')] }, line: L.RESULT },
    },
    [ROW.lib, ...POOL],
  ),
  'configureawait-reality': spec(
    {
      library: { rows: { lib: [chip('caf', 'ConfigureAwait(false): no context to skip', 'gone')], threads: [blocked(1), free(2), free(3), free(4)], io: [call(1)] }, line: L.RESULT },
      load: { rows: { lib: [chip('caf', 'ConfigureAwait(false): no context to skip', 'gone')], ...STARVED.rows }, line: L.RESULT },
    },
    [ROW.lib, ...POOL],
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
