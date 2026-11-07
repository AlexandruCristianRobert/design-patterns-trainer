import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'public class PricingTests',
  '{',
  '    [Fact] public void Discount() { FeatureFlags.Current = Flags.A; … }',
  '    [Fact] public void Rounding() { FeatureFlags.Current = Flags.C; … }',
  '}',
  'public class InvoiceTests',
  '{',
  '    [Fact] public void Totals() { FeatureFlags.Current = Flags.B; … }',
  '}',
]
const L = { PRICING: [0, 4] as [number, number], INVOICE: [5, 8] as [number, number], DISCOUNT: 2, ROUNDING: 3, TOTALS: 7, CLASSES: { each: [0, 5] } }
const FIX_CODE = ['[Collection("FeatureFlags")]', ...CODE.slice(0, 5), '[Collection("FeatureFlags")]', ...CODE.slice(5)]
const F = { ATTR: { each: [0, 6] } }

const actor = (id: string, name: string, tone: SeqActor['tone'], sub?: string): SeqActor => ({ id, name, sub, tone })
const flag = actor('f', 'FeatureFlags', 'pool', '.Current, static')
const pricing = (sub?: string) => actor('p', 'PricingTests', 'ui', sub)
const invoice = (sub?: string) => actor('i', 'InvoiceTests', 'io', sub)
const MAIN = [pricing(), flag, invoice()]

const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const both = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind, both: true })
const out = (label: string, text: string, kind?: OutLine['kind']): OutLine => ({ label, text, kind })
const spec = (actors: SeqActor[], steps: Record<string, SeqStep>, code = CODE): SeqSpec => ({ actors, code, outputName: 'Test runs', steps })

const COLLECTIONS = [row('c1', 'p', 'collection 1'), row('c2', 'i', 'collection 2')]
const PARALLEL = [...COLLECTIONS, row('seq', 'p', 'its tests one by one'), both('par', 'p', 'i', 'in parallel')]
const RACE = [row('setA', 'p', 'Discount: Current = A', 'f'), row('setB', 'i', 'Totals: Current = B', 'f', 'bad'), row('read', 'f', 'Discount reads B', 'p', 'bad'), row('fail', 'p', 'assert fails', undefined, 'bad')]
const RUNS = [out('Run 1', 'pass'), out('Run 2', 'Discount fails', 'bad'), out('Run 3', 'pass')]
const SETS = [row('setA', 'p', 'Current = A', 'f'), row('setB', 'i', 'Current = B', 'f', 'bad')]

const SPECS: Record<string, SeqSpec> = {
  setup: spec([pricing(), flag, invoice()], {
    alone: {
      rows: [row('p', 'p', 'sets Current', 'f'), row('i', 'i', 'sets Current', 'f')],
      line: L.CLASSES,
      output: [out('PricingTests alone', 'pass'), out('InvoiceTests alone', 'pass')],
    },
    full: {
      rows: [row('p', 'p', 'sets Current', 'f'), row('i', 'i', 'sets Current', 'f')],
      line: null,
      output: [out('PricingTests alone', 'pass'), out('InvoiceTests alone', 'pass'), out('Full run', 'fails now and then', 'bad')],
    },
    question: {
      rows: [row('p', 'p', 'sets Current', 'f'), row('i', 'i', 'sets Current', 'f')],
      line: null,
      output: [out('PricingTests alone', 'pass'), out('InvoiceTests alone', 'pass'), out('Full run', 'fails now and then', 'bad')],
    },
  }),
  'default-run': spec(MAIN, {
    collections: { rows: COLLECTIONS, line: L.CLASSES },
    parallel: { rows: PARALLEL, line: L.CLASSES },
    race: { rows: [...PARALLEL, ...RACE], line: { each: [L.DISCOUNT, L.TOTALS] }, bad: true, output: RUNS },
  }),
  'same-collection': spec(
    MAIN,
    {
      attr: { rows: [row('c1', 'p', 'same collection'), row('c2', 'i', 'same collection')], line: F.ATTR },
      sequential: {
        rows: [
          row('c1', 'p', 'same collection'),
          row('c2', 'i', 'same collection'),
          row('p', 'p', 'its tests: set, assert', 'f', 'ok'),
          row('i', 'i', 'then its tests: set, assert', 'f', 'ok'),
        ],
        line: F.ATTR,
        output: [out('Every run', 'pass', 'ok')],
      },
    },
    FIX_CODE,
  ),

  'in-class-claim': spec([actor('d', 'Discount', 'ui', 'PricingTests'), flag, actor('r', 'Rounding', 'ui', 'PricingTests')], {
    parallel: { rows: [both('par', 'd', 'r', 'in parallel', 'bad')], line: [L.DISCOUNT, L.ROUNDING], bad: true },
    race: { rows: [both('par', 'd', 'r', 'in parallel', 'bad'), row('setA', 'd', 'Current = A', 'f'), row('setC', 'r', 'Current = C', 'f')], line: [L.DISCOUNT, L.ROUNDING], bad: true },
  }),
  'in-class-reality': spec(MAIN, {
    parallel: { rows: [row('seq', 'p', 'one test at a time', undefined, 'ok')], line: [L.DISCOUNT, L.ROUNDING] },
    race: { rows: [row('seq', 'p', 'one test at a time', undefined, 'ok'), both('par', 'p', 'i', 'in parallel'), ...SETS], line: { each: [L.DISCOUNT, L.TOTALS] }, bad: true },
  }),

  'process-claim': spec([actor('p1', 'Process 1', 'ui', 'Discount'), actor('p2', 'Process 2', 'io', 'Totals')], {
    process: { rows: [row('own1', 'p1', 'own process', undefined, 'bad'), row('own2', 'p2', 'own process', undefined, 'bad')], line: { each: [L.DISCOUNT, L.TOTALS] } },
    static: {
      rows: [row('own1', 'p1', 'own process', undefined, 'bad'), row('own2', 'p2', 'own process', undefined, 'bad'), row('v1', 'p1', 'own Current = A', undefined, 'bad'), row('v2', 'p2', 'own Current = B', undefined, 'bad')],
      line: { each: [L.DISCOUNT, L.TOTALS] },
    },
  }),
  'process-reality': spec([pricing(), flag, invoice()], {
    process: { rows: [row('one', 'f', 'one process', undefined, 'ok')], line: { each: [L.DISCOUNT, L.TOTALS] } },
    static: { rows: [row('one', 'f', 'one process', undefined, 'ok'), row('shared', 'f', 'one static for all', undefined, 'bad'), ...SETS], line: { each: [L.DISCOUNT, L.TOTALS] }, bad: true },
  }),

  'order-claim': spec([pricing(), flag, invoice()], {
    order: { rows: [row('o1', 'i', '1st: alphabetical', undefined, 'bad'), row('o2', 'p', '2nd', undefined, 'bad')], line: L.CLASSES },
    leftover: {
      rows: [row('o1', 'i', '1st: alphabetical', undefined, 'bad'), row('o2', 'p', '2nd', undefined, 'bad'), row('left', 'f', 'always the leftover flag', 'i', 'bad')],
      line: L.TOTALS,
    },
  }),
  'order-reality': spec(MAIN, {
    order: { rows: [row('o1', 'i', 'no fixed order'), row('o2', 'p', 'no fixed order'), both('par', 'p', 'i', 'in parallel')], line: L.CLASSES },
    leftover: { rows: [row('o1', 'i', 'no fixed order'), row('o2', 'p', 'no fixed order'), both('par', 'p', 'i', 'in parallel'), ...SETS], line: { each: [L.DISCOUNT, L.TOTALS] }, bad: true, output: RUNS },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
