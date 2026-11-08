import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'int? none = null;',
  'int? some = 5;',
  'object boxedNone = none;',
  'object boxedSome = some;',
  'Console.WriteLine($"{boxedNone is null} {boxedSome.GetType() == typeof(int?)} {boxedSome is int}");',
]
const L = { NONE: 0, SOME: 1, BNONE: 2, BSOME: 3, PRINT: 4 }

const VARS: Region = { id: 'var', name: 'Variables', tone: 'ui' }
const OBJS: Region = { id: 'obj', name: 'Objects', tone: 'pool' }

const spec = (regions: Region[], steps: Record<string, GraphStep>): GraphSpec => ({ regions, code: CODE, outputName: 'Console', steps })

const LABELS = ['is null', '== int?', 'is int']
/** The three printed values; '?' for one not printed yet. */
const out = (texts: string[], kinds: OutLine['kind'][] = []): OutLine[] =>
  LABELS.map((label, i) => {
    const text = texts[i] ?? '?'
    return { label, text, kind: kinds[i] ?? (text === '?' ? 'muted' : 'plain') }
  })

const none: Box = { id: 'none', region: 'var', title: 'none', sub: 'int?', fields: [{ name: 'HasValue', value: 'false', kind: 'inline' }] }
const some: Box = {
  id: 'some',
  region: 'var',
  title: 'some',
  sub: 'int?',
  fields: [
    { name: 'HasValue', value: 'true', kind: 'inline' },
    { name: 'Value', value: '5', kind: 'inline' },
  ],
}
const NULLABLES = [none, some]
const STILL_NULLABLES = NULLABLES.map((b) => ({ ...b, still: true }))
const obj = (name: 'boxedNone' | 'boxedSome', f: Field, kind?: Box['kind']): Box => ({ id: name, region: 'var', title: name, sub: 'object', fields: [f], kind })
const unknown = (name: 'boxedNone' | 'boxedSome') => obj(name, { name: 'value', value: '?', kind: 'muted' })

// ---- Reality ----
const nullRef = (kind?: Field['kind']) => obj('boxedNone', { name: 'ref', value: 'null', kind: kind ?? 'ok' })
const intRef = (kind?: Field['kind']) => obj('boxedSome', { name: 'ref', ref: 'int-box', value: 'box', kind })
const intBox = (kind?: Box['kind'], still?: boolean): Box => ({ id: 'int-box', region: 'obj', title: 'Box', sub: 'boxed Int32', fields: [{ name: 'value', value: '5', kind: 'inline' }], kind, still })
const BOXED = [...STILL_NULLABLES, nullRef(), intRef(), intBox()]
const BOXED_STILL = [...STILL_NULLABLES, { ...nullRef(), still: true }, { ...intRef(), still: true }, intBox(undefined, true)]

// ---- Claims ----
const wrapBox = (id: string, title: string, fields: Field[]): Box => ({ id, region: 'obj', title, sub: 'boxed Nullable<int>', fields })
const wrapNone = wrapBox('wrap-none', 'Box 1', [{ name: 'HasValue', value: 'false', kind: 'inline' }])
const wrapSome = wrapBox('wrap-some', 'Box 2', [
  { name: 'HasValue', value: 'true', kind: 'inline' },
  { name: 'Value', value: '5', kind: 'inline' },
])
const WRAPPED = [...STILL_NULLABLES, obj('boxedNone', { name: 'ref', ref: 'wrap-none', value: 'Box 1' }), obj('boxedSome', { name: 'ref', ref: 'wrap-some', value: 'Box 2' }), wrapNone, wrapSome]
const noValueBox: Box = { id: 'no-value', region: 'obj', title: 'Box', sub: '"no value"', fields: [] }
const NO_VALUE = [...STILL_NULLABLES, obj('boxedNone', { name: 'ref', ref: 'no-value', value: 'box' }), unknown('boxedSome'), noValueBox]

const SPECS: Record<string, GraphSpec> = {
  setup: spec([VARS], {
    nullables: { boxes: NULLABLES, line: [L.NONE, L.SOME] },
    assign: { boxes: [...STILL_NULLABLES, unknown('boxedNone'), unknown('boxedSome')], line: [L.BNONE, L.BSOME] },
    print: { boxes: [...STILL_NULLABLES, { ...unknown('boxedNone'), still: true }, { ...unknown('boxedSome'), still: true }], line: L.PRINT, output: out([]) },
  }),

  boxing: spec([VARS, OBJS], {
    nullables: { boxes: NULLABLES, line: [L.NONE, L.SOME] },
    'box-none': { boxes: [...STILL_NULLABLES, nullRef()], line: L.BNONE },
    'box-some': { boxes: BOXED, line: L.BSOME },
    'is-null': { boxes: [...STILL_NULLABLES, nullRef(), { ...intRef(), still: true }, intBox(undefined, true)], line: L.PRINT, output: out(['True'], ['ok']) },
    'get-type': { boxes: [...STILL_NULLABLES, { ...nullRef(), still: true }, intRef(), intBox('ok')], line: L.PRINT, output: out(['True', 'False'], [undefined, 'ok']) },
    'is-int': { boxes: BOXED_STILL, line: L.PRINT, output: out(['True', 'False', 'True'], [undefined, undefined, 'ok']) },
  }),

  'wrapper-claim': spec([VARS, OBJS], {
    boxes: { boxes: WRAPPED, line: [L.BNONE, L.BSOME] },
    print: { boxes: WRAPPED.map((b) => ({ ...b, still: true })), line: L.PRINT, output: out(['False', 'True', 'False']) },
  }),
  'wrapper-reality': spec([VARS, OBJS], {
    none: { boxes: [...STILL_NULLABLES, nullRef()], line: L.BNONE, output: out(['True'], ['ok']) },
    some: { boxes: [...STILL_NULLABLES, { ...nullRef(), still: true }, intRef(), intBox('ok')], line: L.BSOME, output: out(['True', 'False', 'True'], [undefined, 'ok', 'ok']) },
  }),

  'novalue-claim': spec([VARS, OBJS], {
    none: { boxes: NO_VALUE, line: L.BNONE, output: out(['False']) },
    print: { boxes: NO_VALUE.map((b) => ({ ...b, still: true })), line: L.PRINT, output: out(['False', 'True', 'True']) },
  }),
  'novalue-reality': spec([VARS, OBJS], {
    none: { boxes: [...STILL_NULLABLES, nullRef()], line: L.BNONE, output: out(['True'], ['ok']) },
    some: { boxes: [...STILL_NULLABLES, { ...nullRef(), still: true }, intRef(), intBox('ok')], line: L.PRINT, output: out(['True', 'False', 'True'], [undefined, 'ok']) },
  }),

  'type-claim': spec([VARS], {
    none: { boxes: [...STILL_NULLABLES, unknown('boxedNone'), unknown('boxedSome')], line: L.PRINT, output: out(['True']) },
    type: { boxes: [...STILL_NULLABLES, { ...unknown('boxedNone'), still: true }, { ...unknown('boxedSome'), still: true }], line: L.PRINT, output: out(['True', 'True', 'True']) },
  }),
  'type-reality': spec([VARS, OBJS], {
    box: { boxes: [...STILL_NULLABLES, { ...nullRef(), still: true }, intRef(), intBox('ok')], line: L.BSOME, output: out(['True']) },
    type: { boxes: BOXED_STILL, line: L.PRINT, output: out(['True', 'False', 'True'], [undefined, 'ok']) },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
