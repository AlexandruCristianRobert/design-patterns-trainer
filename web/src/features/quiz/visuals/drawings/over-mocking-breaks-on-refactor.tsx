import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const TEST = [
  'var receipt = svc.Checkout(order);',
  'pricing.Verify(p => p.Discount(order), Times.Once);',
  'tax.Verify(t => t.Rate("CH"), Times.Once);',
  'mail.Verify(m => m.Send(receipt), Times.Once);',
]
const OUTCOME_TEST = [
  'var svc = new CheckoutService(RealPricing(), mail);',
  'var receipt = svc.Checkout(order);',
  'Assert.Equal(90m, receipt.Total);',
  'mail.Verify(m => m.Send(receipt), Times.Once);',
]

const mockActors: SeqSpec['actors'] = [
  { id: 'test', name: 'Test', tone: 'ui' },
  { id: 'svc', name: 'Service', tone: 'pool' },
  { id: 'mocks', name: 'Mocks', tone: 'io' },
]
const realActors: SeqSpec['actors'] = [
  { id: 'test', name: 'Test', tone: 'ui' },
  { id: 'svc', name: 'Service', tone: 'pool' },
  { id: 'real', name: 'Real', sub: 'in-process', tone: 'pool' },
  { id: 'gw', name: 'Gateway', sub: 'mock', tone: 'io' },
]
const spec = (steps: Record<string, SeqStep>): SeqSpec => ({ actors: mockActors, code: TEST, outputName: 'Afterwards', steps })

const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind'], both = false): SeqRow => ({ key, from, to, label, kind, both })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
type Val = [text: string, kind?: OutLine['kind']]
const out = (prod: Val, tests: Val): OutLine[] => [
  { label: 'In production', text: prod[0], kind: prod[1] },
  { label: 'Tests', text: tests[0], kind: tests[1] },
]

const checkout = msg('co', 'test', 'svc', 'Checkout()')
const checkoutShort = msg('co', 'test', 'svc', 'Checkout')
const discount = msg('disc', 'svc', 'mocks', 'Discount()')
const rate = msg('rate', 'svc', 'mocks', 'Rate()')
const send = msg('send', 'svc', 'mocks', 'Send()')
const verified = note('verify', 'test', 'verify 3 calls', 'ok')
const BEFORE = [checkout, discount, rate, send]

const total = msg('total', 'svc', 'mocks', 'calc.Total()')
const AFTER = [checkout, total, msg('disc', 'svc', 'mocks', 'Discount()', 'skip'), msg('rate', 'svc', 'mocks', 'Rate()', 'skip'), send]
const failed = note('verify', 'test', '2 verify fail', 'bad')
const SAME: Val = ['same total, email', 'ok']

const SPECS: Record<string, SeqSpec> = {
  setup: {
    actors: mockActors,
    code: TEST,
    outputName: 'Afterwards',
    steps: {
      tests: { rows: [...BEFORE, note('verify', 'test', 'verify each call')], line: [1, 3] },
      refactor: {
        rows: [checkout, note('moved', 'svc', 'logic moved to a new helper')],
        output: [
          { label: 'Behaviour', text: 'unchanged' },
          { label: 'Tests', text: '40 fail', kind: 'bad' },
        ],
      },
    },
  },

  pinned: spec({
    before: { rows: [...BEFORE, verified], line: [1, 3], output: out(['total 90, email'], ['green', 'ok']) },
    bug: {
      rows: [checkout, discount, msg('rate', 'svc', 'mocks', 'Rate(): 0.08'), send, note('canned', 'mocks', 'canned value', 'muted'), verified],
      line: 2,
      output: out(['tax bug', 'bad'], ['green', 'bad']),
    },
    after: { rows: [...AFTER, failed], line: [1, 2], bad: true, output: out(['total 90, email'], ['40 fail', 'bad']) },
    outcome: { rows: [...AFTER, failed], line: [1, 2], bad: true, output: out(SAME, ['40 fail', 'bad']) },
  }),
  'outcome-test': {
    actors: realActors,
    code: OUTCOME_TEST,
    outputName: 'Afterwards',
    steps: {
      real: {
        rows: [checkoutShort, msg('total', 'svc', 'real', 'Total()', undefined, true), msg('send', 'svc', 'gw', 'Send()'), note('assert', 'test', 'total 90, sent', 'ok')],
        line: [2, 3],
        output: out(['total 90, email'], ['green', 'ok']),
      },
      refactor: {
        rows: [checkoutShort, msg('total', 'svc', 'real', 'Total()', undefined, true), note('helper', 'real', 'via helper'), msg('send', 'svc', 'gw', 'Send()'), note('assert', 'test', 'total 90, sent', 'ok')],
        line: [2, 3],
        output: out(SAME, ['green', 'ok']),
      },
      bug: {
        rows: [checkoutShort, msg('total', 'svc', 'real', 'Total()', undefined, true), note('helper', 'real', 'tax bug', 'bad'), msg('send', 'svc', 'gw', 'Send()'), note('assert', 'test', 'caught: 92', 'ok')],
        line: 2,
        bad: true,
        output: out(['tax bug', 'bad'], ['red: caught', 'ok']),
      },
    },
  },

  'broke-claim': spec({
    fail: { rows: [checkout, note('moved', 'svc', 'logic moved to a new helper'), note('verify', 'test', '40 fail')], output: out(['?'], ['40 fail']) },
    broke: { rows: [checkout, note('moved', 'svc', 'logic moved to a new helper'), note('verify', 'test', '40 fail')], output: out(['behaviour changed', 'bad'], ['40 fail']) },
  }),
  'broke-reality': spec({
    fail: { rows: [checkout, note('moved', 'svc', 'logic moved to a new helper'), note('verify', 'test', '40 fail')], output: out(['?'], ['40 fail']) },
    broke: { rows: [...AFTER, failed], line: [1, 2], bad: true, output: out(SAME, ['40 fail']) },
  }),

  'strict-claim': spec({
    strict: { rows: [checkout, total, note('strict', 'mocks', 'strict: error'), note('cause', 'test', 'fails: strict', 'bad')] },
    loose: { rows: [checkout, total, note('strict', 'mocks', 'loose: allowed')] },
  }),
  'strict-reality': spec({
    strict: { rows: [checkout, total, note('strict', 'mocks', 'loose: allowed', 'ok')] },
    loose: { rows: [...AFTER, note('strict', 'mocks', 'loose: allowed', 'ok'), failed], line: [1, 2], bad: true, output: out(SAME, ['still fail', 'bad']) },
  }),

  'internal-claim': spec({
    internal: { rows: [checkout, note('internal', 'svc', 'helper: internal')] },
    pass: { rows: [checkout, note('internal', 'svc', 'helper: internal'), note('verify', 'test', 'all green', 'bad')], output: out(['?'], ['green', 'bad']) },
  }),
  'internal-reality': spec({
    internal: { rows: [checkout, note('internal', 'svc', 'helper: internal')] },
    pass: { rows: [checkout, note('internal', 'svc', 'helper: internal'), ...AFTER.slice(1), failed], line: [1, 2], bad: true, output: out(SAME, ['still fail', 'bad']) },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
