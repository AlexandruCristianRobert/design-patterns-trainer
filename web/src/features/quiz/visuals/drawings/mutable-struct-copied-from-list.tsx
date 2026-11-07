import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'List<Point> list = [new Point { X = 1 }];',
  'var p = list[0];',
  'p.X = 10;',
  'Console.WriteLine(list[0].X);',
  '',
  'Point[] array = [new Point { X = 1 }];',
  'array[0].X = 10;',
  'Console.WriteLine(array[0].X);',
  '',
  'struct Point { public int X; }',
]
const L = { LIST: 0, GET: 1, SET: 2, PRINT1: 3, ARRAY: 5, ASET: 6, PRINT2: 7, COPY: [1, 2] as [number, number], ARRAY_HALF: [5, 6] as [number, number] }

const regions: Region[] = [
  { id: 'stack', name: 'Locals', sub: 'top-level code', tone: 'ui' },
  { id: 'heap', name: 'Heap', sub: 'objects and arrays', tone: 'pool' },
]
const spec = (steps: Record<string, GraphStep>): GraphSpec => ({ regions, code: CODE, outputName: 'Output', steps })

const pt = (x: string) => `{ X ${x} }`
const inline = (name: string, value: string, kind: Field['kind'] = 'inline'): Field => ({ name, value, kind })
const TARGET: Record<string, string> = { listObj: 'List<Point>', items: 'Point[]', arr: 'Point[]' }
const ref = (name: string, to: string, value = TARGET[to], kind?: Field['kind']): Field => ({ name, ref: to, value, kind })

const locals = (fields: Field[]): Box => ({ id: 'frame', region: 'stack', title: 'locals', fields })
const listObj: Box = { id: 'listObj', region: 'heap', title: 'List<Point>', fields: [ref('_items', 'items'), { name: 'Count', value: '1' }] }
const items = (x: string, kind: Field['kind'] = 'inline'): Box => ({ id: 'items', region: 'heap', title: 'Point[]', sub: "the list's internal array", fields: [inline('[0]', pt(x), kind)] })
const arr = (x: string, kind: Field['kind'] = 'inline'): Box => ({ id: 'arr', region: 'heap', title: 'Point[]', sub: 'array', fields: [inline('[0]', pt(x), kind)] })

const out = (...lines: [string, OutLine['kind']?][]): OutLine[] =>
  lines.length ? lines.map(([text, kind], i) => ({ label: `line ${i + 1}`, text, kind })) : [{ label: '', text: '(nothing yet)', kind: 'muted' }]
const UNKNOWN: OutLine[] = [{ label: '', text: '?', kind: 'muted' }]
const LIST_REF = ref('list', 'listObj')
const ARR_REF = ref('array', 'arr')

/** The list half, step by step: p is a copy in the locals. */
const LH = {
  list: { boxes: [locals([LIST_REF]), listObj, items('1')], line: L.LIST, output: out() },
  get: { boxes: [locals([LIST_REF, inline('p', pt('1'), 'ok')]), listObj, items('1')], line: L.GET, output: out() },
  set: { boxes: [locals([LIST_REF, inline('p', pt('10'))]), listObj, items('1', 'ok')], line: L.SET, output: out() },
  print: { boxes: [locals([LIST_REF, inline('p', pt('10'))]), listObj, items('1', 'ok')], line: L.PRINT1, output: out(['1', 'ok']) },
} satisfies Record<string, GraphStep>
const LIST_DONE = [LIST_REF, inline('p', pt('10'))]
/** The array half, after the list half has printed 1. */
const AH = {
  array: { boxes: [locals([...LIST_DONE, ARR_REF]), listObj, items('1'), arr('1')], line: L.ARRAY, output: out(['1']) },
  set: { boxes: [locals([...LIST_DONE, ARR_REF]), listObj, items('1'), arr('10', 'ok')], line: L.ASET, output: out(['1']) },
  print: { boxes: [locals([...LIST_DONE, ARR_REF]), listObj, items('1'), arr('10', 'ok')], line: L.PRINT2, output: out(['1'], ['10', 'ok']) },
} satisfies Record<string, GraphStep>

/** Compile time: nothing has run, so the data is drawn muted. */
const COMPILED: Box[] = [locals([LIST_REF, ARR_REF]), listObj, items('1'), arr('1')].map((b) => ({ ...b, kind: 'muted' as const }))

const SPECS: Record<string, GraphSpec> = {
  setup: spec({
    list: { boxes: [locals([LIST_REF]), listObj, items('1')], line: L.LIST, output: UNKNOWN },
    copy: { boxes: [locals([LIST_REF, inline('p', '?', 'muted')]), listObj, items('?', 'muted')], line: L.COPY, output: UNKNOWN },
    array: {
      boxes: [locals([LIST_REF, inline('p', '?', 'muted'), ARR_REF]), listObj, items('?', 'muted'), arr('?', 'muted')],
      line: L.ARRAY_HALF,
      output: UNKNOWN,
    },
  }),
  'list-copy': spec(LH),
  'array-in-place': spec({
    array: { boxes: [locals([ARR_REF]), arr('1')], line: L.ARRAY, output: out(['1']) },
    set: { boxes: [locals([ARR_REF]), arr('10', 'ok')], line: L.ASET, output: out(['1']) },
    print: { boxes: [locals([ARR_REF]), arr('10', 'ok')], line: L.PRINT2, output: out(['1'], ['10', 'ok']) },
  }),

  'class-like-claim': spec({
    get: { boxes: [locals([LIST_REF, ref('p', 'items', 'the element', 'bad')]), listObj, items('1')], line: L.GET, output: out() },
    set: { boxes: [locals([LIST_REF, ref('p', 'items', 'the element', 'bad')]), listObj, items('10', 'bad')], line: [2, 3], output: out(['10', 'bad']) },
    array: {
      boxes: [locals([LIST_REF, ref('p', 'items', 'the element', 'bad'), ARR_REF]), listObj, items('10', 'bad'), arr('10')],
      line: L.ARRAY_HALF,
      output: out(['10', 'bad'], ['10']),
    },
  }),
  'class-like-reality': spec({
    get: LH.get,
    set: { ...LH.print, line: [2, 3] },
    array: { ...AH.print, line: L.ARRAY_HALF },
  }),

  'array-copy-claim': spec({
    list: { ...LH.print, line: [1, 3] },
    access: {
      boxes: [
        locals([...LIST_DONE, ARR_REF]),
        { id: 'tmp', region: 'stack', title: 'copy of array[0]', sub: 'as claimed', fields: [inline('value', pt('10'), 'bad')] },
        listObj,
        items('1'),
        arr('1'),
      ],
      line: L.ASET,
      output: out(['1']),
    },
    print: {
      boxes: [
        locals([...LIST_DONE, ARR_REF]),
        { id: 'tmp', region: 'stack', title: 'copy of array[0]', sub: 'as claimed', fields: [inline('value', pt('10'), 'bad')] },
        listObj,
        items('1'),
        arr('1', 'bad'),
      ],
      line: L.PRINT2,
      output: out(['1'], ['1', 'bad']),
    },
  }),
  'array-copy-reality': spec({ list: { ...LH.print, line: [1, 3] }, access: AH.set, print: AH.print }),

  'compile-error-claim': spec({
    check: { boxes: COMPILED, line: L.ASET, output: [{ label: 'build', text: '…', kind: 'muted' }] },
    error: {
      boxes: COMPILED,
      line: L.ASET,
      bad: true,
      output: [{ label: 'build', text: 'fails: compile error', kind: 'bad' }],
    },
  }),
  'compile-error-reality': spec({
    'list-line': { ...LH.get, output: [{ label: 'build', text: 'list[0] copied into p: compiles', kind: 'ok' }] },
    'array-line': { ...AH.set, output: [{ label: 'build', text: 'array[0].X = 10: compiles', kind: 'ok' }] },
    runs: { ...AH.print, output: [{ label: 'build', text: 'succeeds', kind: 'ok' }, ...out(['1'], ['10', 'ok'])] },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
