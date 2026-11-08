import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  '[Fact]',
  'public void Rejects_negative_amount()',
  '{',
  '    var account = new Account();',
  '    Assert.ThrowsAsync<ArgumentOutOfRangeException>(',
  '        () => account.WithdrawAsync(-5));',
  '}',
]
const FIXED = [
  '[Fact]',
  'public async Task Rejects_negative_amount()',
  '{',
  '    var account = new Account();',
  '    await Assert.ThrowsAsync<ArgumentOutOfRangeException>(',
  '        () => account.WithdrawAsync(-5));',
  '}',
]
const L = { SIG: 1, ASSERT: [4, 5] as [number, number], LAMBDA: 5, END: 6 }

const actors: SeqSpec['actors'] = [
  { id: 'xunit', name: 'xUnit', sub: 'runner', tone: 'muted' },
  { id: 'test', name: 'Test', sub: 'the method', tone: 'ui' },
  { id: 'assert', name: 'Assert', tone: 'pool' },
  { id: 'acct', name: 'Account', tone: 'io' },
]
const spec = (steps: Record<string, SeqStep>, code = CODE): SeqSpec => ({ actors, code, outputName: 'Test result', steps })

const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const result = (text: string, kind: OutLine['kind'] = 'plain'): OutLine[] => [{ label: 'Result', text, kind }]

// ---- Shared rows ----
const run = msg('run', 'xunit', 'test', 'run test')
const call = msg('call', 'test', 'assert', 'call with lambda')
const invoke = msg('invoke', 'assert', 'acct', 'invoke lambda')
const done = msg('done', 'acct', 'assert', 'done, no throw')
const faulted = msg('faulted', 'assert', 'test', 'Task: faulted')
const dropped = note('dropped', 'test', 'Task dropped', 'bad')
const returned = msg('returned', 'test', 'xunit', 'returns normally', 'bad')
const VOID = [run, call, invoke, done, faulted, dropped, returned]

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    test: { rows: [run, call], line: L.ASSERT, output: result('?', 'muted') },
    changed: { rows: [run, call, note('changed', 'acct', 'no longer throws')], line: L.LAMBDA, output: result('?', 'muted') },
    passes: { rows: [run, call, note('changed', 'acct', 'no longer throws')], line: { each: [L.SIG, L.ASSERT] }, output: result('Passed') },
  }),

  'void-test': spec({
    invoke: { rows: VOID.slice(0, 3), line: L.ASSERT, output: result('running') },
    'no-throw': { rows: VOID.slice(0, 4), line: L.LAMBDA, output: result('running') },
    faulted: { rows: VOID.slice(0, 5), line: L.ASSERT, output: result('running') },
    dropped: { rows: VOID, line: L.SIG, bad: true, output: result('Passed, wrongly', 'bad') },
  }),
  awaited: spec(
    {
      await: { rows: [msg('run', 'xunit', 'test', 'run, await Task'), msg('call', 'test', 'assert', 'await Assert'), invoke, done], line: [4, 5], output: result('running') },
      fails: {
        rows: [
          msg('run', 'xunit', 'test', 'run, await Task'),
          msg('call', 'test', 'assert', 'await Assert'),
          invoke,
          done,
          msg('faulted', 'assert', 'test', 'No exception was thrown', 'ok'),
          msg('rethrown', 'test', 'xunit', 'exception', 'ok'),
        ],
        line: 4,
        output: result('Failed', 'ok'),
      },
    },
    FIXED,
  ),

  'derived-claim': spec({
    derived: { rows: [run, call, note('rule', 'assert', 'derived types count too', 'bad')], line: L.ASSERT, output: result('?', 'muted') },
    elsewhere: {
      rows: [run, call, note('rule', 'assert', 'derived types count too', 'bad'), msg('other', 'test', 'assert', 'derived exception from elsewhere'), note('ok', 'assert', 'satisfied')],
      line: L.ASSERT,
      output: result('Passed'),
    },
  }),
  'derived-reality': spec({
    derived: { rows: [run, call, note('rule', 'assert', 'exactly T only', 'ok')], line: L.ASSERT, output: result('?', 'muted') },
    elsewhere: { rows: [run, call, invoke, note('none', 'acct', 'throws nothing', 'bad'), faulted, dropped, returned], line: L.SIG, output: result('Passed, wrongly', 'bad') },
  }),

  'warning-claim': spec({
    escape: { rows: [run, call, msg('escape', 'test', 'xunit', 'exception escapes')], line: L.END, output: result('?', 'muted') },
    warning: { rows: [run, call, msg('escape', 'test', 'xunit', 'exception escapes'), note('warn', 'xunit', 'reports a warning', 'bad')], line: L.END, output: result('Passed, with a warning') },
  }),
  'warning-reality': spec({
    escape: { rows: [run, msg('escape', 'test', 'xunit', 'if an exception escaped'), note('fail', 'xunit', 'test fails', 'ok')], line: L.END, output: result('Failed', 'ok') },
    warning: { rows: VOID, line: L.SIG, output: result('Passed, nothing escaped', 'bad') },
  }),

  'expression-claim': spec({
    compiled: { rows: [run, call, note('tree', 'assert', 'Expr tree', 'bad')], line: L.LAMBDA, output: result('?', 'muted') },
    never: {
      rows: [run, call, note('tree', 'assert', 'Expr tree', 'bad'), msg('never', 'assert', 'acct', 'never called', 'skip')],
      line: L.LAMBDA,
      output: result('Passed'),
    },
  }),
  'expression-reality': spec({
    compiled: { rows: [run, call, note('tree', 'assert', 'delegate', 'ok')], line: L.LAMBDA, output: result('?', 'muted') },
    never: { rows: [run, call, note('tree', 'assert', 'delegate', 'ok'), invoke, done, faulted, dropped, returned], line: L.ASSERT, output: result('Passed, wrongly', 'bad') },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
