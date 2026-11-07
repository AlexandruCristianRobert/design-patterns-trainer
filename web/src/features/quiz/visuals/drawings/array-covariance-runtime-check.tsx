import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = ['object[] items = new string[2];', 'items[0] = 42;']
const L = { NEW: 0, STORE: 1, BOTH: [0, 1] as [number, number] }

const REGIONS: Region[] = [
  { id: 'stack', name: 'Stack', sub: 'locals', tone: 'ui' },
  { id: 'heap', name: 'Heap', sub: 'objects', tone: 'pool' },
]
const spec = (steps: Record<string, GraphStep>): GraphSpec => ({ regions: REGIONS, code: CODE, outputName: 'Outcome', steps })

const items = (value: Pick<Field, 'ref' | 'value' | 'kind'>): Box => ({ id: 'items', region: 'stack', title: 'items', sub: 'object[]', fields: [{ name: 'refers to', ...value }] })
const ITEMS_NONE = items({ value: '?', kind: 'muted' })
const ITEMS_ARR = items({ ref: 'arr', value: 'the array' })
/** The array object; `typed` shows the element type it carries at run time. */
const arr = (opts: { typed?: boolean; elementKind?: Field['kind']; first?: Field; kind?: Box['kind']; title?: string } = {}): Box => ({
  id: 'arr',
  region: 'heap',
  title: opts.title ?? 'string[2]',
  kind: opts.kind,
  fields: [
    ...(opts.typed === false ? [] : [{ name: 'element type', value: 'string', kind: opts.elementKind }]),
    opts.first ?? { name: '[0]', value: 'null' },
    { name: '[1]', value: 'null' },
  ],
})
const boxed = (kind?: Box['kind']): Box => ({ id: 'boxed', region: 'heap', title: 'boxed int', kind, fields: [{ name: 'value', value: '42' }] })

const out = (compiles: string, line1: string, line2: string, kinds: [OutLine['kind'], OutLine['kind'], OutLine['kind']] = ['plain', 'plain', 'plain']): OutLine[] => [
  { label: 'Compiles', text: compiles, kind: compiles === '?' ? 'muted' : kinds[0] },
  { label: 'Line 1', text: line1, kind: line1 === '?' || line1 === '…' ? 'muted' : kinds[1] },
  { label: 'Line 2', text: line2, kind: line2 === '?' || line2 === '…' ? 'muted' : kinds[2] },
]
const UNKNOWN = out('?', '?', '?')
const THROWS: OutLine[] = out('yes', 'runs', 'ArrayTypeMismatchException', ['ok', 'ok', 'bad'])

const R = {
  compile: { boxes: [ITEMS_NONE], line: L.BOTH, output: out('yes', '…', '…', ['ok', 'plain', 'plain']) },
  create: { boxes: [ITEMS_ARR, arr()], line: L.NEW, output: out('yes', 'runs', '…', ['ok', 'ok', 'plain']) },
  box: { boxes: [ITEMS_ARR, arr(), boxed()], line: L.STORE, output: out('yes', 'runs', '…', ['ok', 'ok', 'plain']) },
  check: { boxes: [ITEMS_ARR, arr({ elementKind: 'bad' }), boxed('gone')], line: L.STORE, bad: true, output: THROWS },
} satisfies Record<string, GraphStep>

const SPECS: Record<string, GraphSpec> = {
  setup: spec({
    declare: { boxes: [ITEMS_NONE], line: L.NEW, output: UNKNOWN },
    store: { boxes: [ITEMS_NONE], line: L.STORE, output: UNKNOWN },
  }),
  'store-check': spec({
    ...R,
    cost: {
      boxes: [ITEMS_ARR, arr({ elementKind: 'ok' }), boxed('gone')],
      line: L.STORE,
      bad: true,
      output: [...THROWS, { label: 'Every store', text: 'checked: a string passes, an int fails' }],
    },
  }),

  'compile-claim': spec({
    convert: { boxes: [ITEMS_NONE], line: L.NEW, bad: true, output: out('no: cannot convert string[] to object[]', '…', '…', ['bad', 'plain', 'plain']) },
    error: { boxes: [ITEMS_NONE], line: L.NEW, bad: true, output: out('no: cannot convert string[] to object[]', 'never runs', 'never runs', ['bad', 'bad', 'bad']) },
  }),
  'compile-reality': spec({
    convert: { boxes: [ITEMS_ARR, arr()], line: L.NEW, output: out('yes', 'runs', '…', ['ok', 'ok', 'plain']) },
    error: R.check,
  }),

  'boxed-claim': spec({
    create: { boxes: [ITEMS_ARR, arr({ typed: false, title: 'array, 2 slots' })], line: L.NEW, output: out('yes', 'runs', '…', ['ok', 'ok', 'plain']) },
    store: {
      boxes: [ITEMS_ARR, arr({ typed: false, title: 'array, 2 slots', first: { name: '[0]', ref: 'boxed', value: 'boxed 42', kind: 'bad' } }), boxed('bad')],
      line: L.STORE,
      bad: true,
      output: out('yes', 'runs', 'no error', ['ok', 'ok', 'bad']),
    },
  }),
  'boxed-reality': spec({
    create: R.create,
    store: R.check,
  }),

  'cast-claim': spec({
    create: { boxes: [ITEMS_NONE, arr()], line: L.NEW, output: out('yes', '…', '…', ['ok', 'plain', 'plain']) },
    convert: { boxes: [items({ value: 'never set', kind: 'bad' }), arr()], line: L.NEW, bad: true, output: out('yes', 'InvalidCastException', 'never runs', ['ok', 'bad', 'bad']) },
  }),
  'cast-reality': spec({
    create: { boxes: [ITEMS_NONE, arr()], line: L.NEW, output: out('yes', '…', '…', ['ok', 'plain', 'plain']) },
    convert: { boxes: [ITEMS_ARR, arr({ elementKind: 'bad' }), boxed('gone')], line: L.STORE, bad: true, output: THROWS },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
