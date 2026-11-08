import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type ChipKind, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const c = (label: string, kind: ChipKind = 'item', key = label): Chip => ({ key, label, kind })
const ORDER = ['A1', 'B1', 'C1', 'A2', 'B2', 'C2']
/** The packets in send order; `lost` is drawn as lost, `resent` adds the resent copy at the end. */
const packets = (lost: string | null = null, resent = false): Chip[] => [
  ...ORDER.map((p) => c(p, p === lost ? 'dead' : 'item')),
  ...(resent && lost ? [c(`${lost} again`, 'item', 'resend')] : []),
]
const ok = (...ps: string[]) => ps.map((p) => c(p, 'ok'))
const wait = (...ps: string[]) => ps.map((p) => c(p, 'wait'))
const stalled = c('stalled', 'bad')

const row = (id: string, name: string, sub: string | undefined, tone: RowDef['tone']): RowDef => ({ id, name, sub, tone })
const streams = [row('a', 'Stream A', 'delivered', 'ui'), row('b', 'Stream B', 'delivered', 'ui'), row('c', 'Stream C', 'delivered', 'ui')]
const spec = (rows: RowDef[], steps: Record<string, RowStep>): RowSpec => ({ rows, steps })
const QUIC_NET = row('net', 'Network', 'one QUIC connection, UDP', 'io')

const SPECS: Record<string, RowSpec> = {
  setup: spec(
    [row('h2', 'HTTP/2', 'packets sent', 'io'), row('r2', 'Responses', 'over HTTP/2', 'ui'), row('h3', 'HTTP/3', 'same responses', 'io'), row('r3', 'Responses', 'over HTTP/3', 'ui')],
    {
      send: { rows: { h2: packets() } },
      loss: { rows: { h2: packets('B1'), r2: [c('A stalls', 'wait'), c('B stalls', 'wait'), c('C stalls', 'wait')] } },
      h3: {
        rows: {
          h2: packets('B1'),
          r2: [c('A stalls', 'wait'), c('B stalls', 'wait'), c('C stalls', 'wait')],
          h3: [c('A, B, C'), c('one packet lost', 'dead')],
          r3: [c('stall less: why?', 'gone')],
        },
      },
    },
  ),
  tcp: spec([row('net', 'Network', 'one TCP connection', 'io'), row('held', 'TCP', 'received, held', 'pool'), ...streams], {
    send: { rows: { net: packets() } },
    loss: { rows: { net: packets('B1'), a: ok('A1') } },
    wait: { rows: { net: packets('B1'), held: wait('C1', 'A2', 'B2', 'C2'), a: [...ok('A1'), stalled], b: [stalled], c: [stalled] } },
    resend: { rows: { net: packets('B1', true), a: ok('A1', 'A2'), b: ok('B1', 'B2'), c: ok('C1', 'C2') } },
  }),
  quic: spec([QUIC_NET, row('held', 'QUIC', 'held per stream', 'pool'), ...streams], {
    send: { rows: { net: packets() } },
    loss: { rows: { net: packets('B1'), held: wait('B2'), a: ok('A1', 'A2'), b: [c('waits', 'bad')], c: ok('C1', 'C2') } },
    resend: { rows: { net: packets('B1', true), a: ok('A1', 'A2'), b: ok('B1', 'B2'), c: ok('C1', 'C2') } },
  }),

  'conns-claim': spec([row('c1', 'TCP 1', 'connection', 'io'), row('c2', 'TCP 2', 'connection', 'io'), row('c3', 'TCP 3', 'connection', 'io')], {
    conns: { rows: { c1: [c('A1'), c('A2')], c2: [c('B1'), c('B2')], c3: [c('C1'), c('C2')] } },
    loss: { rows: { c1: [c('A1'), c('A2'), c('unaffected', 'run')], c2: [c('B1', 'dead'), c('B2', 'wait')], c3: [c('C1'), c('C2'), c('unaffected', 'run')] } },
  }),
  'conns-reality': spec([QUIC_NET, ...streams], {
    one: { rows: { net: [...packets(), c('no TCP', 'run')] } },
    streams: { rows: { net: [...packets('B1'), c('no TCP', 'run')], a: ok('A1', 'A2'), b: [c('waits for B1', 'bad')], c: ok('C1', 'C2') } },
  }),

  'hpack-claim': spec([row('plain', 'Plain', 'headers as text', 'io'), row('packed', 'HPACK', 'headers compressed', 'io'), row('lost', 'Losses', undefined, 'muted')], {
    hpack: {
      rows: {
        plain: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'A3', 'B3'].map((p) => c(p)),
        packed: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((p) => c(p)),
      },
    },
    fewer: {
      rows: {
        plain: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'A3', 'B3'].map((p) => c(p)),
        packed: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((p) => c(p)),
        lost: [c('fewer packets, fewer lost', 'run')],
      },
    },
  }),
  'hpack-reality': spec([row('comp', 'Headers', 'compression', 'pool'), row('net', 'HTTP/2', 'one TCP connection', 'io'), ...streams], {
    qpack: { rows: { comp: [c('HTTP/2: HPACK', 'run'), c('HTTP/3: QPACK', 'run')] } },
    still: {
      rows: { comp: [c('HTTP/2: HPACK', 'run'), c('HTTP/3: QPACK', 'run')], net: packets('B1'), a: [...ok('A1'), stalled], b: [stalled], c: [stalled] },
    },
  }),

  'fec-claim': spec([row('net', 'TCP', 'with FEC', 'io'), row('recv', 'Receiver', undefined, 'pool')], {
    fec: { rows: { net: [...packets(), c('recovery', 'item')] } },
    rebuild: { rows: { net: [...packets('B1'), c('recovery', 'item')], recv: [c('B1 rebuilt', 'run'), c('no resend', 'run')] } },
  }),
  'fec-reality': spec([row('net', 'Network', 'QUIC over UDP', 'io'), ...streams], {
    'no-tcp': { rows: { net: [...packets(), c('no TCP', 'run')] } },
    resend: { rows: { net: [...packets('B1', true), c('no TCP', 'run')], a: ok('A1', 'A2'), b: [c('waited', 'wait'), ...ok('B1', 'B2')], c: ok('C1', 'C2') } },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
