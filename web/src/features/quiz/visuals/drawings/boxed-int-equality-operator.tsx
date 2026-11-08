import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'object a = 42;',
  'object b = 42;',
  'Console.WriteLine(a == b);',
  'Console.WriteLine(a.Equals(b));',
  'Console.WriteLine((int)a == (int)b);',
]
const L = { A: 0, B: 1, EQ: 2, EQUALS: 3, UNBOX: 4 }

const VARS: Region = { id: 'var', name: 'Variables', tone: 'ui' }
const OBJS: Region = { id: 'obj', name: 'Objects', tone: 'pool' }

const spec = (regions: Region[], steps: Record<string, GraphStep>): GraphSpec => ({ regions, code: CODE, outputName: 'Console', steps })

const LABELS = ['line 1', 'line 2', 'line 3']
/** The three printed lines; '?' for a line not printed yet. */
const out = (...texts: string[]): OutLine[] =>
  LABELS.map((label, i) => {
    const text = texts[i] ?? '?'
    return { label, text, kind: text === '?' ? 'muted' : 'plain' }
  })
const outK = (texts: string[], kinds: OutLine['kind'][]): OutLine[] => out(...texts).map((o, i) => (kinds[i] ? { ...o, kind: kinds[i] } : o))

const variable = (name: 'a' | 'b', fields: Field[], kind?: Box['kind']): Box => ({ id: name, region: 'var', title: name, sub: 'object', fields, kind })
const pointsAt = (name: 'a' | 'b', kind?: Field['kind']) => variable(name, [{ name: 'ref', ref: name === 'a' ? 'box1' : 'box2', value: name === 'a' ? 'Box 1' : 'Box 2', kind }])
const box = (n: 1 | 2, kind?: Box['kind']): Box => ({ id: `box${n}`, region: 'obj', title: `Box ${n}`, sub: 'boxed Int32', fields: [{ name: 'value', value: '42', kind: 'inline' }], kind })
const copy = (name: 'a' | 'b', kind?: Box['kind']): Box => ({ id: `int-${name}`, region: 'var', title: `(int)${name}`, sub: 'unboxed copy', fields: [{ name: 'value', value: '42', kind: 'inline' }], kind })

const BOTH = [pointsAt('a'), pointsAt('b'), box(1), box(2)]
const REF_EQ: GraphStep = { boxes: [pointsAt('a', 'bad'), pointsAt('b', 'bad'), box(1), box(2)], line: L.EQ, output: outK(['False'], ['bad']) }
const EQUALS: GraphStep = { boxes: [pointsAt('a'), pointsAt('b'), box(1, 'ok'), box(2, 'ok')], line: L.EQUALS, output: outK(['False', 'True'], [undefined, 'ok']) }
/** The boxes were the point of the step before: not marked again. */
const STILL = BOTH.map((b) => ({ ...b, still: true }))
const UNBOX: GraphStep = { boxes: [...STILL, copy('a', 'ok'), copy('b', 'ok')], line: L.UNBOX, output: outK(['False', 'True', 'True'], [undefined, undefined, 'ok']) }

/** In a claim, a and b are drawn only as the object variables the code declares. */
const declared = (name: 'a' | 'b') => variable(name, [{ name: 'assigned', value: '42' }])
const DECLARED = [declared('a'), declared('b')]

const SPECS: Record<string, GraphSpec> = {
  setup: spec([VARS], {
    assign: { boxes: DECLARED, line: [L.A, L.B] },
    compare: { boxes: DECLARED, line: [L.EQ, L.UNBOX], output: out() },
  }),

  boxes: spec([VARS, OBJS], {
    'box-a': { boxes: [pointsAt('a'), box(1)], line: L.A },
    'box-b': { boxes: BOTH, line: L.B },
    'ref-eq': REF_EQ,
    equals: EQUALS,
    unbox: UNBOX,
  }),

  'value-claim': spec([VARS], {
    eq: { boxes: DECLARED, line: L.EQ, output: out('True') },
    all: { boxes: DECLARED, line: [L.EQ, L.UNBOX], output: out('True', 'True', 'True') },
  }),
  'value-reality': spec([VARS, OBJS], {
    'two-boxes': { boxes: BOTH, line: [L.A, L.B] },
    'ref-eq': REF_EQ,
  }),

  'equals-claim': spec([VARS], {
    equals: { boxes: DECLARED, line: L.EQUALS, output: out('False', 'False') },
    all: { boxes: DECLARED, line: [L.EQ, L.UNBOX], output: out('False', 'False', 'True') },
  }),
  'equals-reality': spec([VARS, OBJS], {
    virtual: { boxes: [pointsAt('a', 'ok'), { ...pointsAt('b'), still: true }, box(1, 'ok'), { ...box(2), still: true }], line: L.EQUALS, output: out('False') },
    values: EQUALS,
  }),

  'unbox-claim': spec([VARS], {
    first: { boxes: DECLARED, line: [L.EQ, L.EQUALS], output: out('False', 'True') },
    unbox: { boxes: DECLARED, line: L.UNBOX, output: out('False', 'True', 'False') },
  }),
  'unbox-reality': spec([VARS, OBJS], {
    copies: { boxes: [...BOTH, copy('a'), copy('b')], line: L.UNBOX, output: out('False', 'True') },
    'int-eq': UNBOX,
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
