import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const code = (source: string) => [
  'var undo = new Stack<string>();',
  'undo.Push("a");',
  'undo.Push("b");',
  'undo.Push("c");',
  'Console.WriteLine(string.Join(",", undo));',
  '',
  `var copy = new Stack<string>(${source});`,
  'Console.WriteLine(copy.Pop());',
]
const CODE = code('undo')
const CLONE_CODE = code('undo.Reverse()')
const L = { PUSH: [0, 3] as [number, number], JOIN: 4, COPY: 6, POP: 7, PRINTS: { each: [4, 7] } }

const UNDO: RowDef = { id: 'undo', name: 'undo', sub: 'Stack<string>', tone: 'pool', slots: 3, ends: ['bottom', 'top'] }
const READ: RowDef = { id: 'read', name: 'Read order', sub: 'enumerating undo', tone: 'muted' }
const REV: RowDef = { id: 'read', name: 'Read order', sub: 'undo.Reverse()', tone: 'muted' }
const COPY: RowDef = { id: 'copy', name: 'copy', sub: 'Stack<string>', tone: 'pool', slots: 3, ends: ['bottom', 'top'] }
const LINE1: RowDef = { id: 'line1', name: 'Line 1', sub: 'console', tone: 'io' }
const LINE2: RowDef = { id: 'line2', name: 'Line 2', sub: 'console', tone: 'io' }

const chip = (label: string, kind: Chip['kind'] = 'item', key = label): Chip => ({ key, label, kind })
const chips = (labels: string, kind: Chip['kind'] = 'item'): Chip[] => [...labels].map((l) => chip(l, kind))
const ASK: Chip[] = [chip('?', 'wait')]
const printed = (text: string, kind: Chip['kind'] = 'ok'): Chip[] => [chip(text, kind, 'out')]
/** `copy` after Pop: the popped top is faded. */
const popped = (labels: string): Chip[] => [...labels].map((l, i) => chip(l, i === labels.length - 1 ? 'gone' : 'item'))

const UNDO_ABC = chips('abc')
const rows = (r: RowStep['rows']): RowStep['rows'] => ({ undo: UNDO_ABC, read: [], copy: [], line1: [], line2: [], ...r })
const spec = (steps: Record<string, RowStep>, read = READ, c = CODE): RowSpec => ({ rows: [UNDO, read, COPY, LINE1, LINE2], code: c, steps })

const R = {
  push: { rows: rows({}), line: L.PUSH },
  enumerate: { rows: rows({ read: chips('cba'), line1: printed('c,b,a') }), line: L.JOIN },
  copyFirst: { rows: rows({ read: chips('cba'), copy: chips('c'), line1: printed('c,b,a') }), line: L.COPY },
  copyRest: { rows: rows({ read: chips('cba'), copy: chips('cba'), line1: printed('c,b,a') }), line: L.COPY },
  pop: { rows: rows({ read: chips('cba'), copy: popped('cba'), line1: printed('c,b,a'), line2: printed('a') }), line: L.POP },
} satisfies Record<string, RowStep>

const WRONG_JOIN = { rows: rows({ read: chips('abc', 'bad'), line1: printed('a,b,c', 'bad') }), line: L.JOIN, bad: true }

const SPECS: Record<string, RowSpec> = {
  setup: spec({
    push: { rows: rows({}), line: L.PUSH },
    join: { rows: rows({ line1: ASK }), line: L.JOIN },
    copy: { rows: rows({ copy: ASK, line1: ASK, line2: ASK }), line: [6, 7] },
  }),

  reverse: spec({ push: R.push, enumerate: R.enumerate, 'copy-first': R.copyFirst, 'copy-rest': R.copyRest, pop: R.pop }),
  'same-top': spec(
    {
      reverse: { rows: rows({ read: chips('abc'), line1: printed('c,b,a', 'item') }), line: L.COPY },
      copy: { rows: rows({ read: chips('abc'), copy: chips('abc', 'ok'), line1: printed('c,b,a', 'item') }), line: L.COPY },
      pop: { rows: rows({ read: chips('abc'), copy: [chip('a', 'ok'), chip('b', 'ok'), chip('c', 'gone')], line1: printed('c,b,a', 'item'), line2: printed('c') }), line: L.POP },
    },
    REV,
    CLONE_CODE,
  ),

  'insertion-claim': spec({
    join: WRONG_JOIN,
    pop: { rows: rows({ read: chips('abc', 'bad'), line1: printed('a,b,c', 'bad'), line2: printed('c', 'bad') }), line: L.POP, bad: true },
  }),
  'insertion-reality': spec({ join: R.enumerate, pop: R.pop }),

  'clone-claim': spec({
    join: R.enumerate,
    copy: { rows: rows({ read: chips('cba'), copy: chips('abc', 'dead'), line1: printed('c,b,a') }), line: L.COPY, bad: true },
    pop: { rows: rows({ read: chips('cba'), copy: [chip('a', 'dead'), chip('b', 'dead'), chip('c', 'gone')], line1: printed('c,b,a'), line2: printed('c', 'bad') }), line: L.POP, bad: true },
  }),
  'clone-reality': spec({ join: R.enumerate, copy: R.copyRest, pop: R.pop }),

  'half-claim': spec({
    join: WRONG_JOIN,
    pop: { rows: rows({ read: chips('abc', 'bad'), line1: printed('a,b,c', 'bad'), line2: printed('a', 'item') }), line: L.POP },
  }),
  'half-reality': spec({ join: R.enumerate, pop: R.pop }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
