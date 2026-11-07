import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type ChipKind, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const CODE = [
  'int[] source = [3, 1, 2];',
  '',
  'var piped = source',
  '    .Where(n => { Console.Write($"W{n} "); return true; })',
  '    .Select(n => { Console.Write($"S{n} "); return n; });',
  'foreach (var n in piped) { }',
  'Console.WriteLine();',
  '',
  'var sorted = source',
  '    .Select(n => { Console.Write($"S{n} "); return n; })',
  '    .OrderBy(n => n);',
  'foreach (var n in sorted) Console.Write($"[{n}] ");',
  'Console.WriteLine();',
]
const L = {
  SOURCE: 0,
  PIPED: [2, 6] as [number, number],
  WHERE: 3,
  SELECT1: 4,
  LOOP1: 5,
  CHAIN1: [3, 4] as [number, number],
  SORTED: [8, 12] as [number, number],
  SELECT2: 9,
  ORDER: 10,
  LOOP2: 11,
}

const SOURCE: RowDef = { id: 'source', name: 'source', sub: 'the array', tone: 'io' }
const WHERE: RowDef = { id: 'where', name: 'Where', sub: 'writes W', tone: 'pool' }
const SELECT: RowDef = { id: 'select', name: 'Select', sub: 'writes S', tone: 'pool' }
const BUFFER: RowDef = { id: 'buffer', name: 'OrderBy', sub: 'its buffer', tone: 'pool', slots: 3 }
const LOOP: RowDef = { id: 'loop', name: 'foreach', sub: 'gets', tone: 'ui' }
const LINE1: RowDef = { id: 'line1', name: 'Console', sub: 'line 1', tone: 'ui' }
const LINE2: RowDef = { id: 'line2', name: 'Console', sub: 'line 2', tone: 'ui' }

const ORDER = [3, 1, 2]
/** The array, with the elements already read drawn as gone. */
const source = (read: number): Chip[] => ORDER.map((n, i) => ({ key: `src${n}`, label: String(n), kind: i < read ? 'gone' : 'item' }))
/** The array, with the given elements already read (in any order). */
const sourceRead = (...read: number[]): Chip[] => ORDER.map((n) => ({ key: `src${n}`, label: String(n), kind: read.includes(n) ? 'gone' : 'item' }))
const vals = (prefix: string, ns: number[], kind: ChipKind = 'item'): Chip[] => ns.map((n) => ({ key: `${prefix}${n}`, label: String(n), kind }))
/** Console output as one chip per write, e.g. "W3", "[1]". */
const con = (tokens: string[]): Chip[] => tokens.map((t) => ({ key: t, label: t, kind: 'item' }))
const ask: Chip = { key: 'ask', label: 'MoveNext()', kind: 'wait' }
const sortedBuf = (kind: ChipKind = 'ok'): Chip[] => [1, 2, 3].map((n) => ({ key: `s${n}`, label: String(n), kind }))

const spec = (rows: RowDef[], steps: Record<string, RowStep>): RowSpec => ({ rows, code: CODE, steps })
const STREAM_ROWS = [SOURCE, WHERE, SELECT, LOOP, LINE1]
const BUFFER_ROWS = [SOURCE, SELECT, BUFFER, LOOP, LINE2]

const LINE1_TOKENS = ['W3', 'S3', 'W1', 'S1', 'W2', 'S2']
/** Line 1, element by element: the element in each operator, and the console so far. */
const streamed = (k: number): RowStep => {
  const n = ORDER[k - 1]
  return { rows: { source: source(k), where: vals('w', [n]), select: vals('s', [n]), loop: vals('l', [n]), line1: con(LINE1_TOKENS.slice(0, 2 * k)) }, line: L.CHAIN1 }
}
const REAL_LINE2 = ['S3', 'S1', 'S2', '[1]', '[2]', '[3]']
/** Line 2, as OrderBy reads element k through Select into its buffer. */
const buffered = (k: number): RowStep => ({
  rows: { source: source(k), select: vals('s', [ORDER[k - 1]]), buffer: vals('b', ORDER.slice(0, k)), loop: [ask], line2: con(REAL_LINE2.slice(0, k)) },
  line: L.SELECT2,
})
/** All three elements read through Select into the buffer, in source order. */
const ALL_READ: RowStep = { ...buffered(3), rows: { ...buffered(3).rows, select: vals('s', ORDER) } }
const SORT: RowStep = { rows: { source: source(3), buffer: sortedBuf(), loop: [ask], line2: con(REAL_LINE2.slice(0, 3)) }, line: L.ORDER }
const YIELD: RowStep = { rows: { source: source(3), buffer: sortedBuf('item'), loop: vals('l', [1, 2, 3]), line2: con(REAL_LINE2) }, line: L.LOOP2 }

const SPECS: Record<string, RowSpec> = {
  setup: spec([SOURCE, LINE1, LINE2], {
    source: { rows: { source: source(0) }, line: L.SOURCE },
    piped: { rows: { source: source(0), line1: [{ key: 'q1', label: '?', kind: 'gone' }] }, line: L.PIPED },
    sorted: { rows: { source: source(0), line1: [{ key: 'q1', label: '?', kind: 'gone' }], line2: [{ key: 'q2', label: '?', kind: 'gone' }] }, line: L.SORTED },
  }),

  streaming: spec(STREAM_ROWS, {
    pull: { rows: { source: source(0), loop: [ask] }, line: L.LOOP1 },
    'el-3': streamed(1),
    'el-1': streamed(2),
    'el-2': streamed(3),
  }),
  buffering: spec(BUFFER_ROWS, {
    ask: { rows: { source: source(0), loop: [ask] }, line: L.LOOP2 },
    'pull-3': buffered(1),
    'pull-1': buffered(2),
    'pull-2': buffered(3),
    sort: SORT,
    yield: YIELD,
  }),

  'whole-claim': spec(STREAM_ROWS, {
    'where-all': { rows: { source: source(3), where: vals('w', ORDER), line1: con(['W3', 'W1', 'W2']) }, line: L.WHERE, bad: true },
    'select-all': {
      rows: { source: source(3), where: vals('w', ORDER), select: vals('s', ORDER), loop: vals('l', ORDER), line1: con(['W3', 'W1', 'W2', 'S3', 'S1', 'S2']) },
      line: L.SELECT1,
      bad: true,
    },
  }),
  'whole-reality': spec(STREAM_ROWS, {
    'where-all': streamed(1),
    'select-all': streamed(3),
  }),

  'stream-sort-claim': spec([SOURCE, SELECT, LOOP, LINE2], {
    'ask-1': { rows: { source: sourceRead(1), select: vals('s', [1]), loop: vals('l', [1]), line2: con(['S1', '[1]']) }, line: L.ORDER, bad: true },
    'ask-2': { rows: { source: sourceRead(1, 2), select: vals('s', [2]), loop: vals('l', [1, 2]), line2: con(['S1', '[1]', 'S2', '[2]']) }, line: L.ORDER, bad: true },
    'ask-3': {
      rows: { source: source(3), select: vals('s', [3]), loop: vals('l', [1, 2, 3]), line2: con(['S1', '[1]', 'S2', '[2]', 'S3', '[3]']) },
      line: L.LOOP2,
      bad: true,
    },
  }),
  'stream-sort-reality': spec(BUFFER_ROWS, {
    'ask-1': { ...ALL_READ, line: L.ORDER },
    'ask-2': YIELD,
  }),

  'sort-first-claim': spec([SOURCE, BUFFER, SELECT, LOOP, LINE2], {
    sort: { rows: { source: source(3), buffer: sortedBuf('bad') }, line: L.ORDER, bad: true },
    select: {
      rows: { source: source(3), buffer: sortedBuf('bad'), select: vals('s', [1, 2, 3]), loop: vals('l', [1, 2, 3]), line2: con(['S1', 'S2', 'S3', '[1]', '[2]', '[3]']) },
      line: L.SELECT2,
      bad: true,
    },
  }),
  'sort-first-reality': spec(BUFFER_ROWS, {
    sort: ALL_READ,
    select: YIELD,
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
