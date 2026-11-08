import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const LOOP = ['foreach (var order in orders)', '    sb.Append($"{order.Id},{order.Total}");']
const LOWERED = [
  'var h = new StringBuilder.AppendInterpolatedStringHandler(1, 2, sb);',
  'h.AppendFormatted(order.Id);',
  'h.AppendLiteral(",");',
  'h.AppendFormatted(order.Total);',
  'sb.Append(ref h);',
]

const VALS: RowDef = { id: 'vals', name: 'Values', sub: 'this order', tone: 'ui' }
const CALLS: RowDef = { id: 'calls', name: 'Calls', tone: 'pool' }
const SB: RowDef = { id: 'sb', name: 'sb', sub: 'its buffer', tone: 'io' }
const HEAP: RowDef = { id: 'heap', name: 'New objects', sub: 'on the heap', tone: 'muted' }

const c = (key: string, label: string, kind?: Chip['kind']): Chip => ({ key, label, kind })
const VALUES = [c('id', 'Id = 42  int'), c('total', 'Total = 19.99  decimal')]
const PRIOR = c('prior', '…')
/** The buffer after the given parts were written into it. */
const buf = (parts: ('42' | ',' | '19.99')[], kind?: Chip['kind']) => [PRIOR, ...parts.map((p) => c(`p${p}`, p, kind))]
const NONE = c('none', 'none', 'ok')

const spec = (rows: RowDef[], code: string[], steps: Record<string, RowStep>): RowSpec => ({ rows, code, steps })
const ALL_ROWS = [VALS, CALLS, SB, HEAP]

const H = c('h', 'handler(sb)', 'run')
const FID = c('fid', 'AppendFormatted(Id)', 'run')
const LIT = c('lit', 'AppendLiteral(",")', 'run')
const FTOT = c('ftot', 'AppendFormatted(Total)', 'run')

const SPECS: Record<string, RowSpec> = {
  setup: spec([VALS, SB], LOOP, {
    loop: { rows: { vals: VALUES, sb: [PRIOR] }, line: 1 },
    ask: { rows: { vals: VALUES, sb: [PRIOR, c('q', '?')] }, line: 1 },
  }),

  handler: spec(ALL_ROWS, LOWERED, {
    overload: { rows: { vals: VALUES, calls: [H], sb: buf([]) }, line: 0 },
    id: { rows: { vals: VALUES, calls: [H, FID], sb: buf(['42'], 'ok') }, line: 1 },
    literal: { rows: { vals: VALUES, calls: [H, FID, LIT], sb: buf(['42', ','], 'ok') }, line: 2 },
    total: { rows: { vals: VALUES, calls: [H, FID, LIT, FTOT], sb: buf(['42', ',', '19.99'], 'ok') }, line: 3 },
    done: { rows: { vals: VALUES, calls: [H, FID, LIT, FTOT], sb: buf(['42', ',', '19.99'], 'ok'), heap: [NONE] }, line: 4 },
  }),

  'format-claim': spec(ALL_ROWS, LOOP, {
    format: { rows: { vals: VALUES, calls: [c('fmt', 'string.Format')], sb: [PRIOR], heap: [c('b1', 'box 42'), c('b2', 'box 19.99'), c('s', '"42,19.99"')] }, line: 1 },
    copy: {
      rows: { vals: VALUES, calls: [c('fmt', 'string.Format'), c('app', 'Append(string)')], sb: [PRIOR, c('copy', '42,19.99')], heap: [c('b1', 'box 42'), c('b2', 'box 19.99'), c('s', '"42,19.99"')] },
      line: 1,
    },
  }),
  'format-reality': spec(ALL_ROWS, LOWERED, {
    before: { rows: { vals: VALUES, calls: [H, FID, LIT, FTOT], sb: [PRIOR] }, line: [0, 4] },
    direct: { rows: { vals: VALUES, calls: [H, FID, LIT, FTOT], sb: buf(['42', ',', '19.99'], 'ok'), heap: [NONE] }, line: [1, 3] },
  }),

  'lazy-claim': spec(ALL_ROWS, LOOP, {
    object: { rows: { vals: VALUES, sb: [PRIOR], heap: [c('fs', 'FormattableString')] }, line: 1 },
    lazy: { rows: { vals: VALUES, calls: [c('ts', 'ToString()')], sb: [PRIOR, c('later', 'formatted then')], heap: [c('fs', 'FormattableString')] }, line: 1 },
  }),
  'lazy-reality': spec(ALL_ROWS, LOWERED, {
    target: { rows: { vals: VALUES, calls: [H], sb: [PRIOR], heap: [NONE] }, line: 0 },
    now: { rows: { vals: VALUES, calls: [H, FID, LIT, FTOT], sb: buf(['42', ',', '19.99'], 'ok'), heap: [NONE] }, line: [1, 4] },
  }),

  'second-claim': spec(ALL_ROWS, LOOP, {
    second: { rows: { vals: VALUES, sb: [PRIOR], heap: [c('sb2', 'StringBuilder 2: 42,19.99')] }, line: 1 },
    append: { rows: { vals: VALUES, calls: [c('app', 'Append(builder 2)')], sb: [PRIOR, c('copy', '42,19.99')], heap: [c('sb2', 'StringBuilder 2: 42,19.99')] }, line: 1 },
  }),
  'second-reality': spec(ALL_ROWS, LOWERED, {
    wraps: { rows: { vals: VALUES, calls: [H], sb: [PRIOR], heap: [NONE] }, line: 0 },
    direct: { rows: { vals: VALUES, calls: [H, FID, LIT, FTOT], sb: buf(['42', ',', '19.99'], 'ok'), heap: [NONE] }, line: [1, 3] },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
