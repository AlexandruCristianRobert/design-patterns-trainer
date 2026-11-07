import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'record Order(string Id, List<string> Lines);',
  '',
  'var a = new Order("1", ["apple"]);',
  'var b = a with { Id = "2" };',
  'b.Lines.Add("pear");',
]
const L = { NEW: 2, WITH: 3, ADD: 4 }

const regions = [
  { id: 'stack', name: 'Stack', sub: 'local variables', tone: 'ui' as const },
  { id: 'heap', name: 'Heap', sub: 'objects', tone: 'pool' as const },
]

const locals = (b: boolean): Box => ({
  id: 'locals',
  region: 'stack',
  title: 'locals',
  fields: [{ name: 'a', ref: 'order-a' }, ...(b ? [{ name: 'b', ref: 'order-b' }] : [])],
})
const order = (who: 'a' | 'b', id: string, lines: Pick<Field, 'ref' | 'value' | 'kind'>): Box => ({
  id: `order-${who}`,
  region: 'heap',
  title: 'Order',
  sub: who === 'a' ? 'created by new' : 'created by with',
  fields: [{ name: 'Id', value: `"${id}"` }, { name: 'Lines', ...lines }],
})
const list = (id: string, items: string[], sub: string, kind?: Box['kind']): Box => ({
  id,
  region: 'heap',
  title: 'List<string>',
  sub,
  kind,
  fields: items.map((x, i) => ({ name: `[${i}]`, value: `"${x}"` })),
})
const shared = (items: string[], kind?: Box['kind']) => list('list', items, 'the list from new Order', kind)

const A = order('a', '1', { ref: 'list' })
const aLines = (items: string[], kind: OutLine['kind'] = 'plain'): OutLine => ({ label: 'a.Lines', text: items.map((x) => `"${x}"`).join(', '), kind })

const createA: GraphStep = { boxes: [locals(false), A, shared(['apple'])], line: L.NEW }
/** b is a copy whose Lines points at the one shared list. */
const sharedB = (id: string, items: string[]): Box[] => [locals(true), A, order('b', id, { ref: 'list' }), shared(items)]

const spec = (steps: Record<string, GraphStep>): GraphSpec => ({ regions, code: CODE, outputName: 'Afterwards', steps })

const SPECS: Record<string, GraphSpec> = {
  setup: spec({
    'create-a': createA,
    with: { boxes: [locals(true), A, order('b', '2', { value: '?', kind: 'muted' }), shared(['apple'])], line: L.WITH },
    add: { boxes: [locals(true), A, order('b', '2', { value: '?', kind: 'muted' }), shared(['apple'])], line: L.ADD, output: [{ label: 'a.Lines', text: '?', kind: 'muted' }] },
  }),
  'shallow-copy': spec({
    'create-a': createA,
    copy: { boxes: [locals(false), A, order('b', '1', { ref: 'list' }), shared(['apple'])], line: L.WITH },
    'set-id': { boxes: sharedB('2', ['apple']), line: L.WITH },
    add: { boxes: sharedB('2', ['apple', 'pear']), line: L.ADD },
    result: { boxes: sharedB('2', ['apple', 'pear']), line: L.ADD, output: [aLines(['apple', 'pear'], 'ok')] },
  }),
  'deep-clone-claim': spec({
    'create-a': createA,
    copy: { boxes: [locals(true), A, order('b', '2', { ref: 'list-b' }), shared(['apple']), list('list-b', ['apple'], 'a deep copy for b')], line: L.WITH },
    add: { boxes: [locals(true), A, order('b', '2', { ref: 'list-b' }), shared(['apple']), list('list-b', ['apple', 'pear'], 'a deep copy for b')], line: L.ADD },
    result: {
      boxes: [locals(true), A, order('b', '2', { ref: 'list-b' }), shared(['apple']), list('list-b', ['apple', 'pear'], 'a deep copy for b')],
      line: L.ADD,
      output: [aLines(['apple'])],
    },
  }),
  'deep-clone-reality': spec({
    'create-a': createA,
    copy: { boxes: sharedB('2', ['apple']), line: L.WITH },
    add: { boxes: sharedB('2', ['apple', 'pear']), line: L.ADD },
    result: { boxes: sharedB('2', ['apple', 'pear']), line: L.ADD, output: [aLines(['apple', 'pear'], 'ok')] },
  }),
  'add-throws-claim': spec({
    'create-a': createA,
    copy: { boxes: sharedB('2', ['apple']), line: L.WITH },
    add: {
      boxes: [locals(true), A, order('b', '2', { ref: 'list' }), shared(['apple'], 'bad')],
      line: L.ADD,
      bad: true,
      output: [{ label: 'Add', text: 'throws', kind: 'bad' }],
    },
  }),
  'add-throws-reality': spec({
    'create-a': createA,
    copy: { boxes: sharedB('2', ['apple']), line: L.WITH },
    add: { boxes: sharedB('2', ['apple', 'pear']), line: L.ADD },
    result: { boxes: sharedB('2', ['apple', 'pear']), line: L.ADD, output: [aLines(['apple', 'pear'], 'ok')] },
  }),
  'no-compile-claim': spec({
    'create-a': createA,
    copy: { boxes: [locals(false), A, shared(['apple'])], line: L.WITH, bad: true, output: [{ label: 'Compiler', text: 'error on the with line', kind: 'bad' }] },
  }),
  'no-compile-reality': spec({
    'create-a': createA,
    copy: { boxes: sharedB('2', ['apple']), line: L.WITH },
    add: { boxes: sharedB('2', ['apple', 'pear']), line: L.ADD },
    result: { boxes: sharedB('2', ['apple', 'pear']), line: L.ADD, output: [aLines(['apple', 'pear'], 'ok')] },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
