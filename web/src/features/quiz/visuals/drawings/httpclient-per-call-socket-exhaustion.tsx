import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type ChipKind, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const CODE = [
  'async Task<string> CallAsync(string url)',
  '{',
  '    using var client = new HttpClient();',
  '    var response = await client.GetAsync(url);',
  '    return await response.Content.ReadAsStringAsync();',
  '}',
]
const L = { NEW: 2, GET: 3, END: 5, CALL: [2, 3] as [number, number] }
const FACTORY_CODE = [
  '// HttpClient from IHttpClientFactory (AddHttpClient<Api>)',
  'class Api(HttpClient client)',
  '{',
  '    public Task<string> CallAsync(string url) =>',
  '        client.GetStringAsync(url);',
  '}',
]

const SLOTS = 4
const CALLS: RowDef = { id: 'calls', name: 'Outgoing calls', tone: 'ui' }
const PORTS: RowDef = { id: 'ports', name: 'Ephemeral ports', sub: 'EST: open · TW: in TIME_WAIT', tone: 'pool', slots: SLOTS }
const OPEN_PORTS: RowDef = { ...PORTS, sub: 'EST: open socket' }
const SOCKET: RowDef = { id: 'socket', name: 'Socket state', tone: 'pool' }
const DNS: RowDef = { id: 'dns', name: 'DNS cache', tone: 'muted', slots: 4 }
const RESULT: RowDef = { id: 'result', name: 'Result', tone: 'io' }

const calls = (n: number, label = (i: number) => `call ${i}`): Chip[] =>
  Array.from({ length: n }, (_, i) => ({ key: `c${i + 1}`, label: n > 4 && i === n - 2 ? '…' : label(n > 4 && i === n - 1 ? 500 : i + 1), kind: 'run' as ChipKind }))
/** Ports in use: `tw` closed ones in TIME_WAIT, then `open` ones, then (over) a connection that found no free port. */
const ports = (tw: number, open = 0, over = false): Chip[] => [
  ...Array.from({ length: tw }, (_, i): Chip => ({ key: `p${i}`, label: 'TW', kind: 'wait' })),
  ...Array.from({ length: open }, (_, i): Chip => ({ key: `p${tw + i}`, label: 'EST', kind: 'item' })),
  ...(over ? [{ key: 'over', label: 'no', kind: 'bad' as ChipKind }] : []),
]
const result = (label: string, kind: ChipKind): Chip[] => [{ key: 'r', label, kind }]
const FAILED = result('SocketException: no free port', 'bad')
const FULL = ports(SLOTS, 0, true)

const spec = (rows: RowDef[], steps: Record<string, RowStep>, code = CODE): RowSpec => ({ rows, code, steps })

const SPECS: Record<string, RowSpec> = {
  setup: spec([CALLS, RESULT], {
    call: { rows: { calls: calls(1) }, line: L.CALL },
    load: { rows: { calls: calls(6) }, line: L.CALL },
    fail: { rows: { calls: calls(6), result: result('SocketException', 'bad') }, line: L.CALL },
  }),
  'per-call': spec([CALLS, PORTS, RESULT], {
    call: { rows: { calls: calls(1), ports: ports(0, 1) }, line: L.CALL },
    dispose: { rows: { calls: calls(1), ports: ports(1) }, line: L.END },
    load: { rows: { calls: calls(6), ports: ports(3, 1) }, line: L.CALL },
    full: { rows: { calls: calls(6), ports: FULL, result: FAILED }, line: L.NEW, bad: true },
  }),
  reuse: spec(
    [CALLS, PORTS, RESULT],
    {
      first: { rows: { calls: calls(1), ports: ports(0, 1) }, line: 4 },
      load: { rows: { calls: calls(6), ports: ports(0, 2), result: result('every call succeeds', 'ok') }, line: 4 },
    },
    FACTORY_CODE,
  ),

  'thread-safety-claim': spec([CALLS, SOCKET, RESULT], {
    concurrent: { rows: { calls: calls(6) }, line: L.GET },
    corrupt: { rows: { calls: calls(6), socket: [{ key: 's', label: 'corrupted by concurrent calls', kind: 'bad' }], result: result('socket errors', 'bad') }, line: L.GET, bad: true },
  }),
  'thread-safety-reality': spec([CALLS, PORTS, RESULT], {
    own: { rows: { calls: calls(6, (i) => `call ${i}: own client`) }, line: L.NEW },
    ports: { rows: { calls: calls(6, (i) => `call ${i}: own client`), ports: FULL, result: FAILED }, line: L.NEW, bad: true },
  }),

  'using-gc-claim': spec([CALLS, OPEN_PORTS, RESULT], {
    'scope-end': { rows: { calls: calls(1), ports: ports(0, 1), result: result('client not disposed until a GC', 'bad') }, line: L.END },
    pile: { rows: { calls: calls(6), ports: ports(0, SLOTS, true), result: result('open sockets pile up', 'bad') }, line: L.END, bad: true },
  }),
  'using-gc-reality': spec([CALLS, PORTS, RESULT], {
    'scope-end': { rows: { calls: calls(1), ports: ports(1), result: result('disposed, connection closed', 'ok') }, line: L.END },
    pile: { rows: { calls: calls(6), ports: FULL, result: FAILED }, line: L.NEW, bad: true },
  }),

  'dns-claim': spec([CALLS, DNS, RESULT], {
    resolve: { rows: { calls: calls(3), dns: ['a', 'b', 'c'].map((k): Chip => ({ key: k, label: 'api', kind: 'run' })) }, line: L.GET },
    full: {
      rows: { calls: calls(6), dns: [...['a', 'b', 'c', 'd'].map((k): Chip => ({ key: k, label: 'api', kind: 'run' })), { key: 'over', label: 'api', kind: 'bad' }], result: result('calls fail', 'bad') },
      line: L.GET,
      bad: true,
    },
  }),
  'dns-reality': spec([CALLS, DNS, PORTS, RESULT], {
    resolve: { rows: { calls: calls(6), dns: [{ key: 'a', label: 'api', kind: 'ok' }] }, line: L.GET },
    ports: { rows: { calls: calls(6), dns: [{ key: 'a', label: 'api', kind: 'ok' }], ports: FULL, result: FAILED }, line: L.NEW, bad: true },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
