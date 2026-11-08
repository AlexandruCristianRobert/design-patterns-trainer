import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { TableStage, type TableDef, type TableSpec, type TableStep, type TChip, type TRow } from '../TableStage'

const CODE = [
  'int[] ids = [3, 5, 5];',
  '',
  'Console.WriteLine(ids.FirstOrDefault(i => i > 10));',
  'Console.WriteLine(ids.First(i => i == 5));',
  '',
  'try',
  '{',
  '    Console.WriteLine(ids.SingleOrDefault(i => i == 5));',
  '}',
  'catch (InvalidOperationException)',
  '{',
  '    Console.WriteLine("error");',
  '}',
]
const L = { ARRAY: 0, FOD: 2, FIRST: 3, SOD: 7, CATCH: [9, 11] as [number, number] }

const IDS: TableDef = { id: 'ids', name: 'ids', sub: 'int[]', tone: 'pool', columns: ['index', 'value'] }
const FIRSTS: TableDef = { id: 'firsts', name: 'First', sub: 'and FirstOrDefault', tone: 'muted', columns: ['matches', 'First', 'OrDefault'] }
const SINGLES: TableDef = { id: 'singles', name: 'Single', sub: 'and SingleOrDefault', tone: 'muted', columns: ['matches', 'Single', 'OrDefault'] }

type K = TRow['kind']
const el = (i: number, kind?: K, mark?: string, markKind?: TRow['markKind']): TRow => ({ key: `e${i}`, cells: [String(i), String([3, 5, 5][i])], kind, mark, markKind })
const PLAIN = [el(0), el(1), el(2)]
const NO_MATCH = [el(0, 'skip'), el(1, 'skip'), el(2, 'skip')]
const FIRST = [el(0, 'skip'), el(1, 'hit', 'first match', 'ok'), el(2, 'muted', 'not read', 'muted')]
const TWO = [el(0, 'skip'), el(1, 'hit', 'match'), el(2, 'bad', 'second match', 'bad')]

const line = (n: number, text: string, kind?: OutLine['kind']): OutLine => ({ label: `line ${n}`, text, kind })
const chip = (key: string, label: string, kind?: TChip['kind']): TChip => ({ key, label, kind })
const THROW = chip('ex', 'InvalidOperationException', 'bad')

const spec = (tables: TableDef[], steps: Record<string, TableStep>): TableSpec => ({ tables, code: CODE, outputName: 'Console', steps })
const OK3 = [line(1, '0', 'ok'), line(2, '5', 'ok'), line(3, 'error', 'ok')]

const rule = (key: string, cells: string[], kind?: K): TRow => ({ key, cells, kind })
const R_FIRST = [rule('none', ['none', 'throws', 'default']), rule('one', ['one', 'first', 'first']), rule('many', ['several', 'first', 'first'])]
const R_SINGLE = [rule('none', ['none', 'throws', 'default']), rule('one', ['one', 'the one', 'the one']), rule('many', ['several', 'throws', 'throws'], 'bad')]

const SPECS: Record<string, TableSpec> = {
  // ---- Setup: the array and the three calls; no matches marked, no output ----
  setup: spec([IDS], {
    array: { tables: { ids: PLAIN }, line: L.ARRAY },
    calls: { tables: { ids: PLAIN }, line: { each: [L.FOD, L.FIRST, L.SOD] } },
    ask: { tables: { ids: PLAIN }, line: { each: [L.FOD, L.FIRST, [5, 12]] } },
  }),

  calls: spec([IDS], {
    fod: { tables: { ids: NO_MATCH }, chips: [chip('d', 'no match: default 0', 'ok')], line: L.FOD, output: [line(1, '0', 'ok')] },
    first: { tables: { ids: FIRST }, line: L.FIRST, output: [line(1, '0', 'ok'), line(2, '5', 'ok')] },
    sod: { tables: { ids: TWO }, chips: [THROW], line: L.SOD, bad: true, output: [line(1, '0', 'ok'), line(2, '5', 'ok')] },
    catch: { tables: { ids: TWO }, chips: [THROW, chip('c', 'caught', 'ok')], line: L.CATCH, output: OK3 },
  }),
  rules: spec([FIRSTS, SINGLES], {
    first: { tables: { firsts: R_FIRST }, line: { each: [L.FOD, L.FIRST] } },
    single: { tables: { firsts: R_FIRST, singles: R_SINGLE }, line: L.SOD },
  }),

  'fallback-claim': spec([IDS], {
    fallback: { tables: { ids: [el(0, 'skip'), el(1, 'hit', 'taken'), el(2, 'read', 'also matches')] }, line: L.SOD },
    output: { tables: { ids: [el(0, 'skip'), el(1, 'hit', 'taken'), el(2, 'read', 'also matches')] }, line: L.SOD, output: [line(1, '0'), line(2, '5'), line(3, '5')] },
  }),
  'fallback-reality': spec([IDS], {
    second: { tables: { ids: TWO }, chips: [THROW], line: L.SOD, bad: true },
    output: { tables: { ids: TWO }, chips: [THROW, chip('c', 'caught', 'ok')], line: L.CATCH, output: OK3 },
  }),

  'throws-claim': spec([IDS], {
    throws: { tables: { ids: NO_MATCH }, chips: [chip('ex', 'InvalidOperationException')], line: L.FOD },
    crash: { tables: { ids: NO_MATCH }, chips: [chip('ex', 'InvalidOperationException'), chip('un', 'unhandled')], line: L.FOD, output: [{ label: 'Console', text: 'nothing' }] },
  }),
  'throws-reality': spec([IDS], {
    default: { tables: { ids: NO_MATCH }, chips: [chip('d', 'no match: default 0', 'ok')], line: L.FOD, output: [line(1, '0', 'ok')] },
    output: { tables: { ids: TWO }, chips: [chip('d', 'no match: default 0', 'ok'), THROW, chip('c', 'caught', 'ok')], line: L.CATCH, output: OK3 },
  }),

  'none-claim': spec([IDS], {
    none: { tables: { ids: [el(0, 'skip'), el(1, 'read', 'match'), el(2, 'read', 'match')] }, chips: [chip('d', 'two matches: default 0')], line: L.SOD },
    output: {
      tables: { ids: [el(0, 'skip'), el(1, 'read', 'match'), el(2, 'read', 'match')] },
      chips: [chip('d', 'two matches: default 0')],
      line: L.SOD,
      output: [line(1, '0'), line(2, '5'), line(3, '0')],
    },
  }),
  'none-reality': spec([IDS], {
    second: { tables: { ids: TWO }, chips: [THROW], line: L.SOD, bad: true },
    output: { tables: { ids: TWO }, chips: [THROW, chip('c', 'caught', 'ok')], line: L.CATCH, output: OK3 },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <TableStage spec={s} {...p} />]),
)
export default drawing
