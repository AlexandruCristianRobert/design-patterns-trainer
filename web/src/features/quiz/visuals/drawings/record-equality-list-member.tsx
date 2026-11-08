import { BoxGraph, type Box, type FieldKind, type GraphSpec, type GraphStep, type OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'var a = new Cart("c1", ["apple"]);',
  'var b = new Cart("c1", ["apple"]);',
  'var c = a with { };',
  'Console.WriteLine($"{a == b} {a == c}");',
  '',
  'record Cart(string Id, List<string> Items);',
]
const L = { NEW: [0, 1] as [number, number], WITH: 2, PRINT: 3 }

const regions = [
  { id: 'stack', name: 'Stack', sub: 'local variables', tone: 'ui' as const },
  { id: 'heap', name: 'Heap', sub: 'objects', tone: 'pool' as const },
]

/** c: drawn with its arrow, unknown ('?') or not declared yet. */
const locals = (c: boolean | 'unknown'): Box => ({
  id: 'locals',
  region: 'stack',
  title: 'locals',
  fields: [
    { name: 'a', ref: 'cart1', value: 'Cart #1' },
    { name: 'b', ref: 'cart2', value: 'Cart #2' },
    ...(c === 'unknown' ? [{ name: 'c', value: '?', kind: 'muted' as const }] : c ? [{ name: 'c', ref: 'cart3', value: 'Cart #3' }] : []),
  ],
})
type Marks = { id?: FieldKind; items?: FieldKind }
const cart = (n: 1 | 2 | 3, m: Marks = {}): Box => ({
  id: `cart${n}`,
  region: 'heap',
  title: `Cart #${n}`,
  sub: n === 3 ? 'created by with' : 'created by new',
  fields: [
    { name: 'Id', value: '"c1"', kind: m.id },
    { name: 'Items', ref: n === 2 ? 'list2' : 'list1', value: n === 2 ? 'List #2' : 'List #1', kind: m.items },
  ],
})
const list = (n: 1 | 2): Box => ({ id: `list${n}`, region: 'heap', title: `List #${n}`, sub: 'List<string>', fields: [{ name: '[0]', value: '"apple"' }] })

type Pair = { ab?: Marks; ac?: Marks }
/** With c: every box; m marks the fields of the pairs compared so far (Cart #1 shows the a/c result once there is one). */
const all = (m: Pair = {}): Box[] => [
  locals(true),
  cart(1, m.ac ?? m.ab),
  cart(2, m.ab),
  cart(3, m.ac),
  list(1),
  list(2),
]
const before = (c: boolean | 'unknown'): Box[] => [locals(c), cart(1), cart(2), list(1), list(2)]

const res = (ab: string | null, ac: string | null, kinds: [OutLine['kind']?, OutLine['kind']?] = []): OutLine[] => [
  { label: 'a == b', text: ab ?? '?', kind: ab === null ? 'muted' : kinds[0] },
  { label: 'a == c', text: ac ?? '?', kind: ac === null ? 'muted' : kinds[1] },
]
const EQ: Marks = { id: 'ok', items: 'ok' }
const NE: Marks = { id: 'ok', items: 'bad' }

const spec = (steps: Record<string, GraphStep>): GraphSpec => ({ regions, code: CODE, outputName: 'Printed', steps })

const CARTS: GraphStep = { boxes: before(false), line: L.NEW }
const COPY: GraphStep = { boxes: all(), line: L.WITH }
const AB_FALSE: GraphStep = { boxes: all({ ab: NE }), line: L.PRINT, output: res('False', null, ['ok']) }
const AC_TRUE: GraphStep = { boxes: all({ ab: NE, ac: EQ }), line: L.PRINT, output: res('False', 'True', ['ok', 'ok']) }

const SPECS: Record<string, GraphSpec> = {
  setup: spec({
    carts: CARTS,
    copy: { boxes: before('unknown'), line: L.WITH },
    print: { boxes: before('unknown'), line: L.PRINT, output: res(null, null) },
  }),
  equality: spec({
    carts: CARTS,
    copy: COPY,
    'a-b': AB_FALSE,
    'a-c': AC_TRUE,
  }),

  'contents-claim': spec({
    copy: COPY,
    'a-b': { boxes: all(), line: L.PRINT, output: res('True', null, ['bad']) },
    'a-c': { boxes: all(), line: L.PRINT, output: res('True', 'True', ['bad']) },
  }),
  'contents-reality': spec({
    copy: COPY,
    'a-b': AB_FALSE,
    'a-c': AC_TRUE,
  }),

  'reference-claim': spec({
    copy: COPY,
    'a-c': { boxes: all(), line: L.PRINT, output: res(null, 'False', [undefined, 'bad']) },
    print: { boxes: all(), line: L.PRINT, output: res('False', 'False', [undefined, 'bad']) },
  }),
  'reference-reality': spec({
    copy: COPY,
    'a-c': { boxes: all({ ac: EQ }), line: L.PRINT, output: res(null, 'True', [undefined, 'ok']) },
    print: { boxes: all({ ab: NE, ac: EQ }), line: L.PRINT, output: res('False', 'True', ['ok', 'ok']) },
  }),

  'reversed-claim': spec({
    'a-b': { boxes: all(), line: L.PRINT, output: res('True', null, ['bad']) },
    'a-c': { boxes: all(), line: L.PRINT, output: res('True', 'False', ['bad', 'bad']) },
  }),
  'reversed-reality': spec({
    'a-b': AB_FALSE,
    'a-c': AC_TRUE,
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
