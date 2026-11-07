import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const CODE = [
  'string[] names = ["ann", "bob", "cy"];',
  '',
  'foreach (var (i, n) in names.Index().Skip(1))',
  '    Console.Write($"{i}:{n} ");',
  'Console.WriteLine();',
  '',
  'foreach (var (i, n) in names.Skip(1).Index())',
  '    Console.Write($"{i}:{n} ");',
  'Console.WriteLine();',
]
const L = { NAMES: 0, LOOP1: [2, 4] as [number, number], LOOP2: [6, 8] as [number, number], FOR1: 2, FOR2: 6, WRITE1: [3, 4] as [number, number], WRITE2: [7, 8] as [number, number] }

const NAMES: RowDef = { id: 'names', name: 'names', sub: 'the array', tone: 'muted' }
const LINE1: RowDef = { id: 'line1', name: 'Line 1', sub: 'console', tone: 'io' }
const LINE2: RowDef = { id: 'line2', name: 'Line 2', sub: 'console', tone: 'io' }
/** A pipeline stage; `n` tells the two loops' stages apart. */
const IDX = (n: number): RowDef => ({ id: `idx${n}`, name: 'Index()', sub: 'pairs out', tone: 'pool' })
const SKIP = (n: number): RowDef => ({ id: `skip${n}`, name: 'Skip(1)', sub: 'passes on', tone: 'pool' })

const chip = (key: string, label: string, kind: Chip['kind'] = 'item'): Chip => ({ key, label, kind })
const names = (dropAnn = false): Chip[] => [chip('ann', 'ann', dropAnn ? 'gone' : 'item'), chip('bob', 'bob'), chip('cy', 'cy')]
const pair = (i: number, n: string, kind: Chip['kind'] = 'item'): Chip => chip(`${i}${n}`, `(${i}, ${n})`, kind)
const ASK = [chip('ask', '?', 'wait')]
const printed = (text: string, kind: Chip['kind'] = 'ok'): Chip[] => [chip('out', text, kind)]

const ALL3 = [pair(0, 'ann'), pair(1, 'bob'), pair(2, 'cy')]
const DROP_FIRST = [pair(0, 'ann', 'gone'), pair(1, 'bob'), pair(2, 'cy')]
const TAIL = [chip('bob', 'bob'), chip('cy', 'cy')]

const loop1 = (steps: Record<string, RowStep>): RowSpec => ({ rows: [NAMES, IDX(1), SKIP(1), LINE1], code: CODE, steps })
const loop2 = (steps: Record<string, RowStep>): RowSpec => ({ rows: [NAMES, SKIP(2), IDX(2), LINE2], code: CODE, steps })

const R1 = {
  source: { rows: { names: names() }, line: L.NAMES },
  index: { rows: { names: names(), idx1: ALL3 }, line: L.FOR1 },
  skip: { rows: { names: names(), idx1: ALL3, skip1: DROP_FIRST }, line: L.FOR1 },
  print: { rows: { names: names(), idx1: ALL3, skip1: DROP_FIRST, line1: printed('1:bob 2:cy') }, line: L.WRITE1 },
} satisfies Record<string, RowStep>
const R2 = {
  source: { rows: { names: names() }, line: L.NAMES },
  skip: { rows: { names: names(true), skip2: TAIL }, line: L.FOR2 },
  index: { rows: { names: names(true), skip2: TAIL, idx2: [pair(0, 'bob'), pair(1, 'cy')] }, line: L.FOR2 },
  print: { rows: { names: names(true), skip2: TAIL, idx2: [pair(0, 'bob'), pair(1, 'cy')], line2: printed('0:bob 1:cy') }, line: L.WRITE2 },
} satisfies Record<string, RowStep>

const SPECS: Record<string, RowSpec> = {
  setup: {
    rows: [NAMES, LINE1, LINE2],
    code: CODE,
    steps: {
      source: { rows: { names: names() }, line: L.NAMES },
      first: { rows: { names: names(), line1: ASK }, line: L.LOOP1 },
      second: { rows: { names: names(), line1: ASK, line2: [chip('ask2', '?', 'wait')] }, line: L.LOOP2 },
    },
  },
  'index-first': loop1(R1),
  'skip-first': loop2(R2),

  'original-claim': loop2({
    skip: R2.skip,
    index: { rows: { names: names(true), skip2: TAIL, idx2: [pair(1, 'bob', 'bad'), pair(2, 'cy', 'bad')] }, line: L.FOR2, bad: true },
    print: { rows: { names: names(true), skip2: TAIL, idx2: [pair(1, 'bob', 'bad'), pair(2, 'cy', 'bad')], line2: printed('1:bob 2:cy', 'bad') }, line: L.WRITE2, bad: true },
  }),
  'original-reality': loop2({ skip: R2.skip, index: R2.index, print: R2.print }),

  'renumber-claim': loop1({
    index: R1.index,
    skip: { rows: { names: names(), idx1: ALL3, skip1: [pair(0, 'bob', 'bad'), pair(1, 'cy', 'bad')] }, line: L.FOR1, bad: true },
    print: { rows: { names: names(), idx1: ALL3, skip1: [pair(0, 'bob', 'bad'), pair(1, 'cy', 'bad')], line1: printed('0:bob 1:cy', 'bad') }, line: L.WRITE1, bad: true },
  }),
  'renumber-reality': loop1({ index: R1.index, skip: R1.skip, print: R1.print }),

  'drop-last-claim': loop1({
    index: R1.index,
    skip: { rows: { names: names(), idx1: ALL3, skip1: [pair(0, 'ann'), pair(1, 'bob'), pair(2, 'cy', 'dead')] }, line: L.FOR1, bad: true },
    print: { rows: { names: names(), idx1: ALL3, skip1: [pair(0, 'ann'), pair(1, 'bob'), pair(2, 'cy', 'dead')], line1: printed('0:ann 1:bob', 'bad') }, line: L.WRITE1, bad: true },
  }),
  'drop-last-reality': loop1({ index: R1.index, skip: R1.skip, print: R1.print }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, spec]) => [stage, (p: StageDrawingProps) => <RowStage spec={spec} {...p} />]),
)
export default drawing
