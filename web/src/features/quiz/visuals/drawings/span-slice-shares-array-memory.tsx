import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'int[] data = [1, 2, 3, 4, 5];',
  'Span<int> middle = data.AsSpan(1, 3);',
  'middle[0] = 20;',
  '',
  'int[] copy = middle.ToArray();',
  'copy[1] = 30;',
  '',
  'Console.WriteLine(string.Join(",", data));',
  'Console.WriteLine(string.Join(",", copy));',
]
const L = { DATA: 0, SLICE: 1, WRITE: 2, SPAN: [1, 2] as [number, number], TO_ARRAY: 4, WRITE_COPY: 5, COPY: [4, 5] as [number, number], PRINT: [7, 8] as [number, number] }

const regions: Region[] = [
  { id: 'stack', name: 'Stack', sub: 'locals', tone: 'ui' },
  { id: 'heap', name: 'Heap', sub: 'arrays', tone: 'pool' },
]

type Mark = Field['kind']
/** A local: an arrow to its target, '?' when the Setup leaves it open, or absent. */
type Local = string | '?' | null
const locals = (copy: Local): Box => ({
  id: 'locals',
  region: 'stack',
  title: 'locals',
  fields: [
    { name: 'data', ref: 'data', value: 'int[]' },
    ...(copy === null ? [] : copy === '?' ? [{ name: 'copy', value: '?', kind: 'muted' as const }] : [{ name: 'copy', ref: copy, value: 'int[]' }]),
  ],
})

/** middle: a span pointing at `target` (offset label shown), with values inline, or unknown. */
const spanInto = (target: string, at: string): Box => ({
  id: 'middle',
  region: 'stack',
  title: 'middle',
  sub: 'Span<int>, a struct',
  fields: [
    { name: 'ref', ref: target, value: at },
    { name: 'Length', value: '3' },
  ],
})
const spanUnknown: Box = { id: 'middle', region: 'stack', title: 'middle', sub: 'Span<int>', fields: [{ name: 'covers', value: '?', kind: 'muted' }] }
const spanValues = (values: string[]): Box => ({
  id: 'middle',
  region: 'stack',
  title: 'middle',
  sub: 'Span<int>',
  fields: values.map((v, i) => ({ name: `[${i}]`, value: v })),
})

/** cells: [value, mark?]; view: index of the first element middle covers in this array (labels the covered cells). */
const arr = (id: string, title: string, sub: string, cells: [string, Mark?][], view: number | null = null): Box => ({
  id,
  region: 'heap',
  title,
  sub,
  fields: cells.map(([v, kind], i) => ({
    name: view !== null && i >= view && i < view + 3 ? `[${i}] · middle[${i - view}]` : `[${i}]`,
    value: v,
    kind: kind ?? 'plain',
  })),
})
const cells = (values: string, marks: Record<number, Mark> = {}): [string, Mark?][] => values.split(',').map((v, i) => [v, marks[i]])

const DATA = (values = '1,2,3,4,5', marks: Record<number, Mark> = {}, view: number | null = null) => arr('data', 'int[5]', 'the array data refers to', cells(values, marks), view)
const COPY = (values = '20,3,4', marks: Record<number, Mark> = {}) => arr('copy', 'int[3]', 'new, from ToArray', cells(values, marks))

const out = (data: string, copy: string, kind: OutLine['kind'] = 'plain'): OutLine[] => [
  { label: 'data', text: data, kind: data === '?' ? 'muted' : kind },
  { label: 'copy', text: copy, kind: copy === '?' ? 'muted' : kind },
]

const spec = (steps: Record<string, GraphStep>): GraphSpec => ({ regions, code: CODE, outputName: 'Printed', steps })

const SPAN = spanInto('data', '&data[1]')
/** The real run. */
const R = {
  data: { boxes: [locals(null), DATA()], line: L.DATA },
  slice: { boxes: [SPAN, locals(null), DATA('1,2,3,4,5', {}, 1)], line: L.SLICE },
  writeSpan: { boxes: [SPAN, locals(null), DATA('1,20,3,4,5', { 1: 'ok' }, 1)], line: L.WRITE },
  toArray: { boxes: [SPAN, locals('copy'), DATA('1,20,3,4,5', {}, 1), COPY()], line: L.TO_ARRAY },
  writeCopy: { boxes: [SPAN, locals('copy'), DATA('1,20,3,4,5', {}, 1), COPY('20,30,4', { 1: 'ok' })], line: L.WRITE_COPY },
  print: { boxes: [SPAN, locals('copy'), DATA('1,20,3,4,5', {}, 1), COPY('20,30,4')], line: L.PRINT, output: out('1,20,3,4,5', '20,30,4', 'ok') },
} satisfies Record<string, GraphStep>

/** Option 1's picture: middle covers its own copy of the three elements. */
const OWN = (values: string, marks: Record<number, Mark> = {}) => arr('own', 'int[3]', 'claimed copy for middle', cells(values, marks), 0)
const SPAN_OWN = spanInto('own', 'own copy')

/** Option 2's picture: copy is a second view into data. */
const copyView: Box = { id: 'copy-view', region: 'stack', title: 'copy', sub: 'claimed view', fields: [{ name: 'ref', ref: 'data', value: '&data[1]' }, { name: 'Length', value: '3' }] }

const SPECS: Record<string, GraphSpec> = {
  setup: spec({
    data: R.data,
    span: { boxes: [spanUnknown, locals(null), DATA()], line: L.SPAN },
    copy: { boxes: [spanUnknown, locals('?'), DATA()], line: L.COPY, output: out('?', '?') },
  }),
  'view-then-copy': spec({ data: R.data, slice: R.slice, 'write-span': R.writeSpan, 'to-array': R.toArray, 'write-copy': R.writeCopy, print: R.print }),

  'slice-copies-claim': spec({
    data: R.data,
    slice: { boxes: [SPAN_OWN, locals(null), DATA(), OWN('2,3,4')], line: L.SLICE },
    'write-span': { boxes: [SPAN_OWN, locals(null), DATA('1,2,3,4,5', { 1: 'bad' }), OWN('20,3,4', { 0: 'ok' })], line: L.WRITE },
    'to-array': { boxes: [SPAN_OWN, locals('copy'), DATA(), OWN('20,3,4'), COPY('20,30,4', { 1: 'ok' })], line: L.COPY },
    print: { boxes: [SPAN_OWN, locals('copy'), DATA('1,2,3,4,5', { 1: 'bad' }), OWN('20,3,4'), COPY('20,30,4')], line: L.PRINT, bad: true, output: [...out('1,2,3,4,5', '20,30,4').map((o, i): OutLine => (i === 0 ? { ...o, kind: 'bad' } : o))] },
  }),
  'slice-copies-reality': spec({
    data: R.data,
    slice: R.slice,
    'write-span': R.writeSpan,
    'to-array': { ...R.writeCopy, line: L.COPY },
    print: R.print,
  }),

  'toarray-view-claim': spec({
    'write-span': R.writeSpan,
    'to-array': { boxes: [SPAN, copyView, locals(null), DATA('1,20,3,4,5', {}, 1)], line: L.TO_ARRAY, bad: true },
    'write-copy': { boxes: [SPAN, copyView, locals(null), DATA('1,20,30,4,5', { 2: 'bad' }, 1)], line: L.WRITE_COPY },
    print: { boxes: [SPAN, copyView, locals(null), DATA('1,20,30,4,5', {}, 1)], line: L.PRINT, output: out('1,20,30,4,5', '20,30,4', 'bad') },
  }),
  'toarray-view-reality': spec({ 'write-span': R.writeSpan, 'to-array': R.toArray, 'write-copy': R.writeCopy, print: R.print }),

  'both-lost-claim': spec({
    'write-span': { boxes: [spanValues(['20', '3', '4']), locals(null), DATA('1,2,3,4,5', { 1: 'bad' })], line: L.WRITE },
    'to-array': { boxes: [spanValues(['20', '3', '4']), locals('copy'), DATA(), COPY()], line: L.TO_ARRAY },
    'write-copy': { boxes: [spanValues(['20', '3', '4']), locals('copy'), DATA(), COPY('20,3,4', { 1: 'bad' })], line: L.WRITE_COPY, bad: true },
    print: { boxes: [spanValues(['20', '3', '4']), locals('copy'), DATA(), COPY()], line: L.PRINT, output: out('1,2,3,4,5', '20,3,4', 'bad') },
  }),
  'both-lost-reality': spec({ 'write-span': R.writeSpan, 'to-array': R.toArray, 'write-copy': R.writeCopy, print: R.print }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
