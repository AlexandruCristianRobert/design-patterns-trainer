import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const RUNNER: SeqActor = { id: 'runner', name: 'Test runner', tone: 'muted' }
const OTHER: SeqActor = { id: 'other', name: 'ReportTests', sub: 'Export', tone: 'pool' }
const OURS: SeqActor = { id: 'ours', name: 'PriceTests', sub: 'Total', tone: 'ui' }
const STATE: SeqActor = { id: 'state', name: 'AppSettings', sub: 'static Currency', tone: 'io' }
const MEMORY: SeqActor = { id: 'mem', name: 'Memory', sub: 'test process', tone: 'muted' }
const JIT: SeqActor = { id: 'jit', name: 'JIT', sub: 'Price.Format', tone: 'muted' }

const CODE = [
  'public static class AppSettings',
  '{',
  '    public static string Currency = "CHF";',
  '}',
  '',
  '// ReportTests',
  '[Fact] public void Export()',
  '{',
  '    AppSettings.Currency = "EUR";  // never reset',
  '    …',
  '}',
  '',
  '// PriceTests',
  '[Fact] public void Total() =>',
  '    Assert.Equal("CHF 10.00", Price.Format(10m));',
]
const L = { STATIC: 2, SET: 8, ASSERT: 14 }
const FIXED_CODE = [
  '// ReportTests: restores what it changed',
  'public class ReportTests : IDisposable',
  '{',
  '    readonly string _old = AppSettings.Currency;',
  '    public void Dispose() => AppSettings.Currency = _old;',
  '    …',
  '}',
  '',
  '// PriceTests: sets the state it needs',
  '[Fact] public void Total()',
  '{',
  '    AppSettings.Currency = "CHF";',
  '    Assert.Equal("CHF 10.00", Price.Format(10m));',
  '}',
]

const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const results = (other: string, ours: string, oursKind?: OutLine['kind'], otherKind?: OutLine['kind']): OutLine[] => [
  { label: 'ReportTests.Export', text: other, kind: otherKind },
  { label: 'PriceTests.Total', text: ours, kind: oursKind },
]
const spec = (actors: SeqActor[], steps: Record<string, SeqStep>, code?: string[]): SeqSpec => ({ actors, code, outputName: 'Results', steps })

// ---- Setup: only the order and the outcomes, nothing about why ----
const runOther = [msg('run-o', 'runner', 'other', 'run'), note('pass-o', 'other', 'passes')]
const runOurs = (kind: SeqRow['kind'], label: string, key = 'ours'): SeqRow[] => [msg(`run-${key}`, 'runner', 'ours', 'run'), note(`res-${key}`, 'ours', label, kind)]

// ---- Reality: the static carries the change from one test to the next ----
const initial = note('init', 'state', 'Currency = "CHF"')
const sets = [msg('set', 'other', 'state', 'Currency = "EUR"'), note('pass-o', 'other', 'passes, never resets')]
const reads = msg('read', 'state', 'ours', 'Currency: "EUR"', 'bad')
const fails = note('fail', 'ours', 'got "EUR 10.00": fails', 'bad')
const LEAK = [initial, ...sets, reads, fails]

const SPECS: Record<string, SeqSpec> = {
  setup: spec([RUNNER, OTHER, OURS], {
    alone: { rows: runOurs('ok', 'passes', 'alone'), output: [{ label: 'PriceTests.Total, alone', text: 'passes', kind: 'ok' }] },
    full: { rows: [...runOther, ...runOurs('bad', 'fails')], output: results('passes', 'fails', 'bad') },
    'other-order': {
      rows: [...runOurs('ok', 'passes', 'first'), msg('run-o2', 'runner', 'other', 'run'), note('pass-o2', 'other', 'passes')],
      output: results('passes', 'passes', 'ok'),
    },
  }),
  leak: spec(
    [OTHER, STATE, OURS],
    {
      initial: { rows: [initial], line: L.STATIC },
      'other-sets': { rows: [initial, ...sets], line: L.SET, output: results('passes', 'not run yet', 'muted') },
      'ours-reads': { rows: [initial, ...sets, reads], line: L.ASSERT, output: results('passes', 'running', 'muted') },
      fails: { rows: LEAK, line: L.ASSERT, bad: true, output: results('passes', 'fails: "EUR 10.00"', 'bad') },
    },
    CODE,
  ),
  isolated: spec(
    [OTHER, STATE, OURS],
    {
      'own-setup': {
        rows: [initial, msg('set', 'other', 'state', 'Currency = "EUR"'), msg('restore', 'other', 'state', 'Dispose: back to "CHF"', 'ok'), msg('own', 'ours', 'state', 'Currency = "CHF"', 'ok')],
        line: { each: [[3, 4], 11] },
      },
      'any-order': {
        rows: [
          initial,
          msg('set', 'other', 'state', 'Currency = "EUR"'),
          msg('restore', 'other', 'state', 'Dispose: back to "CHF"', 'ok'),
          msg('own', 'ours', 'state', 'Currency = "CHF"', 'ok'),
          note('pass', 'ours', 'passes in any order', 'ok'),
        ],
        line: [11, 12],
        output: results('passes', 'passes', 'ok', 'ok'),
      },
    },
    FIXED_CODE,
  ),

  'memory-claim': spec([OTHER, MEMORY, OURS], {
    heavy: { rows: [msg('use', 'other', 'mem', 'uses a lot of memory')], output: results('passes', 'not run yet', 'muted') },
    less: {
      rows: [msg('use', 'other', 'mem', 'uses a lot of memory'), msg('less', 'mem', 'ours', 'runs later: less memory'), note('fail', 'ours', 'fails')],
      output: results('passes', 'fails'),
    },
  }),
  'memory-reality': spec(
    [OTHER, STATE, OURS],
    {
      'no-budget': { rows: [note('one', 'state', 'one process, no budget per test'), note('gc', 'other', 'GC frees what it no longer uses', 'muted')], line: null },
      state: { rows: [initial, ...sets, reads, fails], line: L.SET, bad: true, output: results('passes', 'fails: "EUR 10.00"', 'bad') },
    },
    CODE,
  ),

  'jit-claim': spec([OTHER, JIT, OURS], {
    'first-call': { rows: [msg('call-o', 'other', 'jit', 'calls Price.Format')], output: results('passes', 'not run yet', 'muted') },
    recompiled: {
      rows: [msg('call-o', 'other', 'jit', 'calls Price.Format'), note('re', 'jit', 'compiles it differently'), msg('res', 'jit', 'ours', 'different result'), note('fail', 'ours', 'fails')],
      output: results('passes', 'fails'),
    },
  }),
  'jit-reality': spec(
    [OTHER, STATE, OURS],
    {
      tiers: { rows: [note('tier', 'state', 'recompiled later: faster, same results', 'muted')], line: null },
      state: { rows: LEAK, line: L.SET, bad: true, output: results('passes', 'fails: "EUR 10.00"', 'bad') },
    },
    CODE,
  ),

  'timeout-claim': spec([RUNNER, OTHER, OURS], {
    slow: { rows: [msg('run-o', 'runner', 'other', 'run'), note('slow', 'other', 'longer than the default timeout')] },
    abort: {
      rows: [msg('run-o', 'runner', 'other', 'run'), note('slow', 'other', 'longer than the default timeout'), msg('abort', 'runner', 'ours', 'aborted'), note('fail', 'ours', 'fails')],
      output: results('over the timeout', 'fails'),
    },
  }),
  'timeout-reality': spec(
    [RUNNER, OTHER, OURS],
    {
      'no-timeout': { rows: [msg('run-o', 'runner', 'other', 'run'), note('none', 'runner', 'no default per-test timeout'), note('pass-o', 'other', 'finishes, passes')], line: null },
      runs: {
        rows: [msg('run-o', 'runner', 'other', 'run'), note('none', 'runner', 'no default per-test timeout'), note('pass-o', 'other', 'finishes, passes'), msg('run-u', 'runner', 'ours', 'run'), note('fail', 'ours', 'assertion: got "EUR 10.00"', 'bad')],
        line: L.ASSERT,
        bad: true,
        output: results('passes', 'fails: "EUR 10.00"', 'bad'),
      },
    },
    CODE,
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
