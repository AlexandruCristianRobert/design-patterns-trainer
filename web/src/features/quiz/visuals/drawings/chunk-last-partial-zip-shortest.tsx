import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const CODE = [
  'int[] nums = [1, 2, 3, 4, 5, 6, 7];',
  'Console.WriteLine(string.Join(" ", nums.Chunk(3).Select(c => c.Length)));',
  '',
  'string[] names = ["a", "b", "c"];',
  'int[] scores = [10, 20];',
  'Console.WriteLine(string.Join(",", names.Zip(scores, (n, s) => n + s)));',
]
const L = { NUMS: 0, CHUNK: 1, ZIP_IN: [3, 4] as [number, number], ZIP: 5, PRINTS: { each: [1, 5] } }

const NUMS: RowDef = { id: 'nums', name: 'nums', sub: 'source', tone: 'muted' }
const CHUNKS: RowDef = { id: 'chunks', name: 'Chunk(3)', sub: 'arrays out', tone: 'pool' }
const NAMES: RowDef = { id: 'names', name: 'names', sub: 'first', tone: 'muted' }
const SCORES: RowDef = { id: 'scores', name: 'scores', sub: 'second', tone: 'muted' }
const PAIRS: RowDef = { id: 'pairs', name: 'Zip', sub: 'pairs out', tone: 'pool' }
const LINE1: RowDef = { id: 'line1', name: 'Line 1', sub: 'console', tone: 'io' }
const LINE2: RowDef = { id: 'line2', name: 'Line 2', sub: 'console', tone: 'io' }

/** Source items; the first `used` are already taken (faded). */
const items = (labels: string[], used = 0): Chip[] => labels.map((label, i) => ({ key: label, label, kind: i < used ? 'gone' : 'item' }))
const NUM_LABELS = ['1', '2', '3', '4', '5', '6', '7']
const nums = (used = 0) => items(NUM_LABELS, used)
const names = (used = 0, dropped = false): Chip[] => items(['a', 'b', 'c'], used).map((c) => (dropped && c.key === 'c' ? { ...c, label: 'c: no pair', kind: 'dead' } : c))
const scores = (used = 0) => items(['10', '20'], used)
const chip = (key: string, label: string, kind: Chip['kind'] = 'item'): Chip => ({ key, label, kind })
const ASK: Chip[] = [chip('ask', '?', 'wait')]

const C1 = chip('c1', '[1, 2, 3]')
const C2 = chip('c2', '[4, 5, 6]')
const C3 = chip('c3', '[7]', 'ok')
const P1 = chip('p1', 'a10')
const P2 = chip('p2', 'b20')
const printed = (text: string, kind: Chip['kind'] = 'ok'): Chip[] => [chip('out', text, kind)]

const R = {
  chunk: {
    input: { rows: { nums: nums(), chunks: [], line1: [] }, line: L.NUMS },
    first: { rows: { nums: nums(3), chunks: [C1], line1: [] }, line: L.CHUNK },
    second: { rows: { nums: nums(6), chunks: [C1, C2], line1: [] }, line: L.CHUNK },
    last: { rows: { nums: nums(7), chunks: [C1, C2, C3], line1: [] }, line: L.CHUNK },
    print: { rows: { nums: nums(7), chunks: [C1, C2, C3], line1: printed('3 3 1') }, line: L.CHUNK },
  },
  zip: {
    input: { rows: { names: names(), scores: scores(), pairs: [], line2: [] }, line: L.ZIP_IN },
    pair1: { rows: { names: names(1), scores: scores(1), pairs: [P1], line2: [] }, line: L.ZIP },
    pair2: { rows: { names: names(2), scores: scores(2), pairs: [P1, P2], line2: [] }, line: L.ZIP },
    stop: { rows: { names: names(2, true), scores: scores(2), pairs: [P1, P2], line2: [] }, line: L.ZIP },
    print: { rows: { names: names(2, true), scores: scores(2), pairs: [P1, P2], line2: printed('a10,b20') }, line: L.ZIP },
  },
} satisfies Record<string, Record<string, RowStep>>

const chunkSpec = (steps: Record<string, RowStep>): RowSpec => ({ rows: [NUMS, CHUNKS, LINE1], code: CODE, steps })
const zipSpec = (steps: Record<string, RowStep>): RowSpec => ({ rows: [NAMES, SCORES, PAIRS, LINE2], code: CODE, steps })
const FULL = { rows: { nums: nums(6), chunks: [C1, C2], line1: [] }, line: L.CHUNK }

const SPECS: Record<string, RowSpec> = {
  setup: {
    rows: [NUMS, CHUNKS, NAMES, SCORES, PAIRS, LINE1, LINE2],
    code: CODE,
    steps: {
      chunk: { rows: { nums: nums(), chunks: ASK, names: [], scores: [], pairs: [], line1: ASK, line2: [] }, line: L.CHUNK },
      zip: { rows: { nums: nums(), chunks: ASK, names: names(), scores: scores(), pairs: ASK, line1: ASK, line2: ASK }, line: L.ZIP },
      question: { rows: { nums: nums(), chunks: ASK, names: names(), scores: scores(), pairs: ASK, line1: ASK, line2: ASK }, line: L.PRINTS },
    },
  },
  chunk: chunkSpec(R.chunk),
  zip: zipSpec({ input: R.zip.input, 'pair-1': R.zip.pair1, 'pair-2': R.zip.pair2, stop: R.zip.stop, print: R.zip.print }),

  'padded-claim': chunkSpec({
    full: FULL,
    last: { rows: { nums: nums(7), chunks: [C1, C2, chip('c3', '[7, pad, pad]', 'bad')], line1: [] }, line: L.CHUNK, bad: true },
    print: { rows: { nums: nums(7), chunks: [C1, C2, chip('c3', '[7, pad, pad]', 'bad')], line1: printed('3 3 3', 'bad') }, line: L.CHUNK, bad: true },
  }),
  'padded-reality': chunkSpec({ full: FULL, last: R.chunk.last, print: R.chunk.print }),

  'dropped-claim': chunkSpec({
    full: FULL,
    last: { rows: { nums: nums(7), chunks: [C1, C2, chip('c3', '[7] dropped', 'dead')], line1: [] }, line: L.CHUNK, bad: true },
    print: { rows: { nums: nums(7), chunks: [C1, C2, chip('c3', '[7] dropped', 'dead')], line1: printed('3 3', 'bad') }, line: L.CHUNK, bad: true },
  }),
  'dropped-reality': chunkSpec({ full: FULL, last: R.chunk.last, print: R.chunk.print }),

  'zip-fills-claim': zipSpec({
    pairs: R.zip.pair2,
    extra: { rows: { names: names(3), scores: [...scores(2), chip('d', 'default 0', 'bad')], pairs: [P1, P2, chip('p3', 'c0', 'bad')], line2: [] }, line: L.ZIP, bad: true },
    print: {
      rows: { names: names(3), scores: [...scores(2), chip('d', 'default 0', 'bad')], pairs: [P1, P2, chip('p3', 'c0', 'bad')], line2: printed('a10,b20,c0', 'bad') },
      line: L.ZIP,
      bad: true,
    },
  }),
  'zip-fills-reality': zipSpec({ pairs: R.zip.pair2, extra: R.zip.stop, print: R.zip.print }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
