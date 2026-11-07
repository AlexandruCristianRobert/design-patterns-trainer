import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'var sku = new Sku { Code = "OLD" };',
  'var dict = new Dictionary<Sku, int>();',
  'dict.Add(sku, 5);',
  'sku.Code = "NEW";',
  'bool found = dict.ContainsKey(sku);',
  '',
  'class Sku',
  '{',
  '  public string Code { get; set; } = "";',
  '  public override bool Equals(object? o)',
  '    => o is Sku s && s.Code == Code;',
  '  public override int GetHashCode()',
  '    => Code.GetHashCode();',
  '}',
]
const L = { ADD: [0, 2] as [number, number], MUTATE: 3, LOOKUP: 4 }

const regions: Region[] = [
  { id: 'locals', name: 'Locals', sub: 'your code', tone: 'ui' },
  { id: 'heap', name: 'Heap', sub: 'the key object', tone: 'io' },
  { id: 'dict', name: 'dict', sub: 'Dictionary<Sku, int>', tone: 'pool' },
]
const spec = (steps: Record<string, GraphStep>): GraphSpec => ({ regions, code: CODE, outputName: 'Result', steps })

const H_OLD = 'h("OLD")'
const H_NEW = 'h("NEW")'
const sku = (code: string): Box => ({ id: 'skuObj', region: 'heap', title: 'Sku', fields: [{ name: 'Code', value: `"${code}"` }] })
const vars = (found: Field = { name: 'found', value: '?', kind: 'muted' }): Box => ({ id: 'vars', region: 'locals', title: 'locals', fields: [{ name: 'sku', ref: 'skuObj', value: 'Sku' }, found] })
const empty = (name: string): Field => ({ name, value: 'empty', kind: 'muted' })
const buckets = (at: 1 | 2 = 1, kind?: Field['kind']): Box => ({
  id: 'buckets',
  region: 'dict',
  title: 'buckets',
  sub: 'hash code mod 3',
  fields: [empty('[0]'), at === 1 ? { name: '[1]', ref: 'entry', value: 'entries[0]', kind } : empty('[1]'), at === 2 ? { name: '[2]', ref: 'entry', value: 'entries[0]', kind } : empty('[2]')],
})
const entry = (hash = H_OLD, kind?: Field['kind']): Box => ({
  id: 'entry',
  region: 'dict',
  title: 'entries[0]',
  fields: [
    { name: 'hashCode', value: hash, kind },
    { name: 'key', ref: 'skuObj', value: 'Sku' },
    { name: 'value', value: '5' },
  ],
})
const lookup = (fields: Field[]): Box => ({ id: 'lookup', region: 'locals', title: 'ContainsKey(sku)', fields })
const HASH: Field = { name: 'hash', value: H_NEW }
const BUCKET2: Field = { name: 'bucket', value: '[2]: empty', kind: 'bad' }

const res = (text: string, kind: OutLine['kind'] = 'plain'): OutLine => ({ label: 'ContainsKey', text, kind })
const NONE: OutLine[] = [res('?', 'muted')]
const found = (value: string, kind: Field['kind']): Field => ({ name: 'found', value, kind })

const R = {
  add: { boxes: [vars(), buckets(), entry(), sku('OLD')], line: L.ADD, output: NONE },
  mutate: { boxes: [vars(), buckets(), entry(), sku('NEW')], line: L.MUTATE, output: NONE },
  hash: { boxes: [vars(), lookup([HASH]), buckets(), entry(), sku('NEW')], line: L.LOOKUP, output: NONE },
  miss: { boxes: [vars(found('false', 'bad')), lookup([HASH, BUCKET2]), buckets(), entry(H_OLD, 'ok'), sku('NEW')], line: L.LOOKUP, output: [res('false', 'bad')] },
} satisfies Record<string, GraphStep>

/** Setup: the dictionary as a black box holding one entry; nothing about how it finds keys. */
const opaque: Box = { id: 'dictbox', region: 'dict', title: 'dict', sub: '1 entry', fields: [{ name: 'key', ref: 'skuObj', value: 'Sku' }, { name: 'value', value: '5' }] }

const SPECS: Record<string, GraphSpec> = {
  setup: spec({
    add: { boxes: [vars(), opaque, sku('OLD')], line: L.ADD, output: NONE },
    mutate: { boxes: [vars(), opaque, sku('NEW')], line: L.MUTATE, output: NONE },
    lookup: { boxes: [vars(), opaque, sku('NEW')], line: L.LOOKUP, output: NONE },
  }),
  lookup: spec({
    ...R,
    'still-there': {
      boxes: [vars(found('false', 'bad')), buckets(1, 'ok'), entry(H_OLD, 'ok'), sku('NEW')],
      line: null,
      output: [res('false', 'bad'), { label: 'foreach', text: '[Sku "NEW"] = 5', kind: 'ok' }],
    },
  }),

  'reference-first-claim': spec({
    mutate: R.mutate,
    compare: {
      boxes: [vars(found('true', 'bad')), lookup([{ name: 'compare', ref: 'skuObj', value: 'same object', kind: 'bad' }]), buckets(), entry(), sku('NEW')],
      line: L.LOOKUP,
      output: [res('true', 'bad')],
    },
  }),
  'reference-first-reality': spec({ mutate: { ...R.mutate, boxes: [vars(), buckets(1, 'ok'), entry(), sku('NEW')] }, hash: R.hash, miss: R.miss }),

  'rehash-claim': spec({
    mutate: R.mutate,
    moved: { boxes: [vars(), buckets(2, 'bad'), entry(H_NEW, 'bad'), sku('NEW')], line: L.MUTATE, output: NONE },
    found: {
      boxes: [vars(found('true', 'bad')), lookup([HASH, { name: 'bucket', value: '[2]: entry', kind: 'bad' }]), buckets(2, 'bad'), entry(H_NEW, 'bad'), sku('NEW')],
      line: L.LOOKUP,
      output: [res('true', 'bad')],
    },
  }),
  'rehash-reality': spec({
    mutate: R.mutate,
    moved: { boxes: [vars(), buckets(1, 'ok'), entry(H_OLD, 'ok'), sku('NEW')], line: L.MUTATE, output: NONE },
    found: R.miss,
  }),

  'throws-claim': spec({
    mutate: R.mutate,
    lookup: { boxes: [vars({ name: 'found', value: 'never set', kind: 'muted' }), buckets(), entry(), sku('NEW')], line: L.LOOKUP, bad: true, output: [res('throws InvalidOperationException', 'bad')] },
  }),
  'throws-reality': spec({ mutate: R.mutate, lookup: R.miss }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
