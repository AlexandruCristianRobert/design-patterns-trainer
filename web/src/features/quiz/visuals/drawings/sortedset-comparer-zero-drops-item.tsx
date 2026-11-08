import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const CODE = [
  'var prices = new SortedSet<Product>(',
  '    Comparer<Product>.Create((a, b) => a.Price.CompareTo(b.Price)));',
  'prices.Add(new Product(1, "Mug", 12m));',
  'prices.Add(new Product(2, "Pen", 3m));',
  'prices.Add(new Product(3, "Cup", 12m));',
]
const TIE_CODE = [
  'var prices = new SortedSet<Product>(Comparer<Product>.Create((a, b) =>',
  '{',
  '    int byPrice = a.Price.CompareTo(b.Price);',
  '    return byPrice != 0 ? byPrice : a.Id.CompareTo(b.Id);',
  '}));',
  '…',
  'prices.Add(new Product(3, "Cup", 12m));',
]
const L = { COMPARER: [0, 1] as [number, number], FIRST: [0, 3] as [number, number], ADD: 4 }

const ROWS: RowDef[] = [
  { id: 'set', name: 'prices', sub: 'in order', tone: 'pool' },
  { id: 'add', name: 'Add', sub: 'Cup', tone: 'ui' },
  { id: 'result', name: 'Result', tone: 'io' },
]
const spec2 = (rows: RowDef[], steps: Record<string, RowStep>): RowSpec => ({ rows, code: CODE, steps })
const spec = (steps: Record<string, RowStep>, code = CODE): RowSpec => ({ rows: ROWS, code, steps })

const c = (key: string, label: string, kind?: Chip['kind']): Chip => ({ key, label, kind })
const PEN = c('pen', 'Pen 3')
const MUG = c('mug', 'Mug 12')
const CUP = c('cup', 'Cup 12')
const TWO = [PEN, MUG]
const ZERO = [c('cmp', 'Cup vs Mug: 0', 'run')]
const DROPPED = [...ZERO, c('cup', 'Cup dropped', 'dead')]
const FALSE = [c('ret', 'Add: false', 'bad'), c('count', 'Count 2')]

const SPECS: Record<string, RowSpec> = {
  setup: spec2(ROWS.slice(0, 2), {
    set: { rows: { set: TWO }, line: L.FIRST },
    add: { rows: { set: TWO, add: [c('cup', 'Cup 12 ?')] }, line: L.ADD },
  }),

  zero: spec({
    compare: { rows: { set: TWO, add: ZERO }, line: L.COMPARER },
    same: { rows: { set: TWO, add: DROPPED }, line: L.ADD, bad: true },
    result: { rows: { set: TWO, add: DROPPED, result: FALSE }, line: L.ADD, bad: true },
  }),
  tie: spec(
    {
      compare: { rows: { set: TWO, add: [c('cmp', 'Cup vs Mug: +1', 'ok')] }, line: [2, 3] },
      stored: { rows: { set: [PEN, MUG, c('cup', 'Cup 12')], add: [c('cmp', 'Cup vs Mug: +1', 'ok')], result: [c('ret', 'Add: true', 'ok'), c('count', 'Count 3')] }, line: 6 },
    },
    TIE_CODE,
  ),

  'order-claim': spec({
    add: { rows: { set: TWO, add: [CUP] }, line: L.ADD },
    stored: { rows: { set: [PEN, MUG, c('cup', 'Cup 12', 'bad')], add: [CUP], result: [c('count', 'Count 3')] }, line: L.ADD, bad: true },
  }),
  'order-reality': spec({
    add: { rows: { set: TWO, add: ZERO }, line: L.COMPARER },
    stored: { rows: { set: TWO, add: DROPPED, result: FALSE }, line: L.ADD, bad: true },
  }),

  'replace-claim': spec({
    add: { rows: { set: TWO, add: [CUP] }, line: L.ADD },
    stored: { rows: { set: [PEN, c('mug', 'Cup 12', 'bad')], add: [c('gone', 'Mug out', 'gone')], result: [c('count', 'Count 2')] }, line: L.ADD, bad: true },
  }),
  'replace-reality': spec({
    add: { rows: { set: [PEN, c('mug', 'Mug 12', 'ok')], add: ZERO }, line: L.ADD },
    stored: { rows: { set: [PEN, c('mug', 'Mug 12', 'ok')], add: DROPPED, result: FALSE }, line: L.ADD, bad: true },
  }),

  'throw-claim': spec({
    add: { rows: { set: TWO, add: [CUP] }, line: L.ADD },
    throw: { rows: { set: TWO, add: [CUP], result: [c('ret', 'ArgumentException', 'bad')] }, line: L.ADD, bad: true },
  }),
  'throw-reality': spec({
    add: { rows: { set: TWO, add: ZERO }, line: L.COMPARER },
    throw: { rows: { set: TWO, add: DROPPED, result: [c('ret', 'Add: false', 'bad'), c('ex', 'no exception', 'ok')] }, line: L.ADD, bad: true },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
