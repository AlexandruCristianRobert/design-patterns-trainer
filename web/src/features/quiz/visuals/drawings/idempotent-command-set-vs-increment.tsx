import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type ChipKind, type RowDef, type RowSpec, type RowStep } from '../RowStage'

// Soft hyphens let the long command names break between words in the narrow name column.
const SH = '­'
const DELIVERIES: RowDef = { id: 'deliv', name: 'Deliveries', sub: 'same command', tone: 'io' }
const ADDRESS: RowDef = { id: 'address', name: `SetShipping${SH}Address`, sub: 'shipping address', tone: 'pool' }
const POINTS: RowDef = { id: 'points', name: `AddLoyalty${SH}Points`, sub: 'points balance', tone: 'pool' }
const STOCK: RowDef = { id: 'stock', name: `Receive${SH}Stock`, sub: 'on hand', tone: 'pool' }
const NOTES: RowDef = { id: 'notes', name: `AddOrder${SH}Note`, sub: 'order notes', tone: 'pool' }

const HANDLERS = [
  'order.ShippingAddress = cmd.Address;',
  'customer.Points += cmd.Points;',
  'product.OnHand += cmd.Quantity;',
  'order.Notes.Add(new Note(cmd.Text));',
]
const H = { ADDRESS: 0, POINTS: 1, STOCK: 2, NOTES: 3 }

const c = (key: string, label: string, kind?: ChipKind): Chip => ({ key, label, kind })
const ONE = c('d1', '1st', 'run')
const TWO = c('d2', '2nd', 'run')

/** A state row: the start value, after one delivery, and (optionally) after two. */
const states = (start: string, once: string, twice?: string, kind: ChipKind = 'item'): Chip[] => [
  c('s0', start, 'run'),
  c('s1', `×1: ${once}`, 'run'),
  ...(twice ? [c('s2', `×2: ${twice}`, kind)] : []),
]
const ADDR = states('old address', 'new address', 'new address', 'ok')
const PTS = states('200', '250', '300', 'bad')
const STK = states('5', '15', '25', 'bad')
const NTS = states('0 notes', '1 note', '2 notes', 'bad')

const SPECS: Record<string, RowSpec> = {
  setup: {
    rows: [DELIVERIES, { id: 'state', name: 'System state', tone: 'pool' }],
    code: ['await handler.HandleAsync(command); // 1st delivery', 'await handler.HandleAsync(command); // same command again'],
    steps: {
      once: { rows: { deliv: [ONE], state: [c('s0', 'old state', 'run'), c('s1', '×1: new state', 'run')] }, line: 0 },
      twice: { rows: { deliv: [ONE, TWO], state: [c('s0', 'old state', 'run'), c('s1', '×1: new state', 'run'), c('s2', '×2: ?', 'wait')] }, line: 1 },
      question: { rows: { deliv: [ONE, TWO], state: [c('s0', 'old state', 'run'), c('s1', '×1: new state', 'run'), c('s2', '×2: ?', 'wait')] }, line: [0, 1] },
    },
  },
  twice: {
    rows: [DELIVERIES, ADDRESS, POINTS, STOCK, NOTES],
    code: HANDLERS,
    steps: {
      address: { rows: { deliv: [ONE, TWO], address: ADDR }, line: H.ADDRESS },
      points: { rows: { deliv: [ONE, TWO], address: ADDR, points: PTS }, line: H.POINTS, bad: true },
      stock: { rows: { deliv: [ONE, TWO], address: ADDR, points: PTS, stock: STK }, line: H.STOCK, bad: true },
      notes: { rows: { deliv: [ONE, TWO], address: ADDR, points: PTS, stock: STK, notes: NTS }, line: H.NOTES, bad: true },
    },
  },
  dedup: {
    rows: [
      { id: 'deliv', name: 'Deliveries', sub: 'same message', tone: 'io' },
      { id: 'ids', name: 'Processed ids', sub: 'same transaction', tone: 'ui' },
      POINTS,
    ],
    code: [
      'if (await processed.ContainsAsync(msg.MessageId))',
      '    return; // duplicate: skip it',
      'customer.Points += cmd.Points;',
      'await processed.AddAsync(msg.MessageId);',
      'await db.SaveChangesAsync(); // both or neither',
    ],
    steps: {
      first: { rows: { deliv: [c('d1', 'm-42', 'run')], ids: [c('m42', 'm-42', 'ok')], points: [c('s0', '200', 'run'), c('s1', '×1: 250', 'run')] }, line: [2, 4] },
      second: {
        rows: { deliv: [c('d1', 'm-42', 'gone'), c('d2', 'm-42 again', 'dead')], ids: [c('m42', 'm-42', 'ok')], points: [c('s0', '200', 'run'), c('s1', '×1: 250', 'run'), c('s2', '×2: 250', 'ok')] },
        line: [0, 1],
      },
    },
  },
}

/** A claim or its reality for one relative command: once, then twice. */
const pair = (row: RowDef, line: number, start: string, once: string, claimed: string, real: string): [RowSpec, RowSpec] => {
  const make = (twice: string, kind: ChipKind, bad: boolean): RowSpec => ({
    rows: [DELIVERIES, row],
    code: HANDLERS,
    steps: {
      once: { rows: { deliv: [ONE], [row.id]: states(start, once) }, line },
      twice: { rows: { deliv: [ONE, TWO], [row.id]: states(start, once, twice, kind) }, line, bad } satisfies RowStep,
    },
  })
  return [make(claimed, 'bad', true), make(real, 'bad', false)]
}
const CLAIMS: [string, [RowSpec, RowSpec]][] = [
  ['points', pair(POINTS, H.POINTS, '200', '250', '250', '300')],
  ['stock', pair(STOCK, H.STOCK, '5', '15', '15', '25')],
  ['note', pair(NOTES, H.NOTES, '0 notes', '1 note', '1 note', '2 notes')],
]
for (const [id, [claim, reality]] of CLAIMS) Object.assign(SPECS, { [`${id}-claim`]: claim, [`${id}-reality`]: reality })

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
