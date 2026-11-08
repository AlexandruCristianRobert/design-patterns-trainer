import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type RowSpec } from '../RowStage'

const CODE = [
  'Counter<int>.Hit();',
  'Counter<int>.Hit();',
  'Counter<string>.Hit();',
  'Console.WriteLine($"{Counter<int>.Hits} {Counter<string>.Hits} {Counter<object>.Hits}");',
  '',
  'static class Counter<T>',
  '{',
  '    public static int Hits;',
  '    public static void Hit() => Hits++;',
  '}',
]
const L = { INT: [0, 1] as [number, number], STRING: 2, CALLS: [0, 2] as [number, number], PRINT: 3, FIELD: 7, CLASS: [5, 9] as [number, number] }

// ---- Setup: the calls and the reads, nothing about where Hits lives ----
const c = (key: string, label: string, kind?: Chip['kind']): Chip => ({ key, label, kind })
const SETUP: RowSpec = {
  rows: [
    { id: 'calls', name: 'Hit()', sub: 'calls', tone: 'ui' },
    { id: 'printed', name: 'Printed', tone: 'io' },
  ],
  code: CODE,
  steps: {
    calls: { rows: { calls: [c('a', 'Counter<int>'), c('b', 'Counter<int>'), c('s', 'Counter<string>')] }, line: L.CALLS },
    print: {
      rows: { calls: [c('a', 'Counter<int>'), c('b', 'Counter<int>'), c('s', 'Counter<string>')], printed: [c('i', '<int>: ?'), c('t', '<string>: ?'), c('o', '<object>: ?')] },
      line: L.PRINT,
    },
  },
}

// ---- Types and their static storage ----
const REGIONS: Region[] = [
  { id: 'types', name: 'Types', tone: 'ui' },
  { id: 'statics', name: 'Statics', sub: 'static storage', tone: 'pool' },
]
const graph = (steps: Record<string, GraphStep>): GraphSpec => ({ regions: REGIONS, code: CODE, outputName: 'Console', steps })

type Arg = 'int' | 'string' | 'object'
const CALLS: Record<Arg, string> = { int: '2', string: '1', object: '0' }
const type = (arg: Arg, store: string, extra: Field[] = [], kind?: Box['kind']): Box => ({
  id: `t-${arg}`,
  region: 'types',
  title: `Counter<${arg}>`,
  kind,
  fields: [{ name: 'Hit() calls', value: CALLS[arg] }, ...extra, { name: 'Hits', value: store === `s-${arg}` ? 'own' : 'shared', ref: store }],
})
const store = (id: string, sub: string, value: string, kind?: Box['kind']): Box => ({ id, region: 'statics', title: 'Hits', sub, kind, fields: [{ name: 'value', value, kind: kind === 'bad' ? 'bad' : kind === 'ok' ? 'ok' : undefined }] })
const own = (arg: Arg, kind?: Box['kind']) => store(`s-${arg}`, `of Counter<${arg}>`, CALLS[arg], kind)

const out = (text: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'Output', text, kind }]
const PER_TYPE = [type('int', 's-int'), type('string', 's-string'), type('object', 's-object'), own('int'), own('string'), own('object')]
const PER_TYPE_OK = [type('int', 's-int'), type('string', 's-string'), type('object', 's-object'), own('int', 'ok'), own('string', 'ok'), own('object', 'ok')]

// Claimed sharing: every type's Hits points at the given storage box.
const ONE = [type('int', 's-all'), type('string', 's-all'), type('object', 's-all')]
const USED = [type('int', 's-used'), type('string', 's-used'), type('object', 's-object')]
const code = (arg: Arg) => ({ name: 'code', value: arg === 'int' ? 'own Hit()' : 'shared Hit()' })
const REF_TYPES = (stores: Record<Arg, string>) => (['int', 'string', 'object'] as Arg[]).map((a) => type(a, stores[a], [code(a)]))

const SPECS: Record<string, GraphSpec> = {
  'per-type': graph({
    int: { boxes: [type('int', 's-int'), own('int')], line: L.INT },
    string: { boxes: [type('int', 's-int'), type('string', 's-string'), own('int'), own('string')], line: L.STRING },
    object: { boxes: PER_TYPE, line: L.PRINT },
    print: { boxes: PER_TYPE_OK, line: L.PRINT, output: out('2 1 0', 'ok') },
  }),

  'one-claim': graph({
    share: { boxes: [...ONE, store('s-all', 'one field', '?')], line: L.FIELD },
    print: { boxes: [...ONE, store('s-all', 'one field', '3', 'bad')], line: L.PRINT, bad: true, output: out('3 3 3', 'bad') },
  }),
  'one-reality': graph({
    share: { boxes: PER_TYPE, line: L.FIELD },
    print: { boxes: PER_TYPE_OK, line: L.PRINT, output: out('2 1 0', 'ok') },
  }),

  'ref-claim': graph({
    code: { boxes: REF_TYPES({ int: 's-int', string: 's-ref', object: 's-ref' }).map((b) => ({ ...b, fields: b.fields!.slice(0, 2) })), line: L.CLASS },
    print: {
      boxes: [...REF_TYPES({ int: 's-int', string: 's-ref', object: 's-ref' }), own('int'), store('s-ref', 'ref types', '1', 'bad')],
      line: L.PRINT,
      bad: true,
      output: out('2 1 1', 'bad'),
    },
  }),
  'ref-reality': graph({
    code: { boxes: REF_TYPES({ int: 's-int', string: 's-string', object: 's-object' }).map((b) => ({ ...b, fields: b.fields!.slice(0, 2) })), line: L.CLASS },
    print: {
      boxes: [...REF_TYPES({ int: 's-int', string: 's-string', object: 's-object' }), own('int', 'ok'), own('string', 'ok'), own('object', 'ok')],
      line: L.PRINT,
      output: out('2 1 0', 'ok'),
    },
  }),

  'used-claim': graph({
    share: { boxes: [...USED, store('s-used', 'int, string', '?'), store('s-object', 'of Counter<object>', '?')], line: L.CALLS },
    print: { boxes: [...USED, store('s-used', 'int, string', '3', 'bad'), own('object')], line: L.PRINT, bad: true, output: out('3 3 0', 'bad') },
  }),
  'used-reality': graph({
    share: { boxes: [type('int', 's-int'), type('string', 's-string'), type('object', 's-object'), own('int', 'ok'), own('string', 'ok'), own('object')], line: L.CALLS },
    print: { boxes: PER_TYPE_OK, line: L.PRINT, output: out('2 1 0', 'ok') },
  }),
}

const drawing: QuestionDrawing = {
  setup: (p: StageDrawingProps) => <RowStage spec={SETUP} {...p} />,
  ...Object.fromEntries(Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />])),
}
export default drawing
