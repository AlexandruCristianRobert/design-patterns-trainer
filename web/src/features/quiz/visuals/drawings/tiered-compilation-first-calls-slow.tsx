import { BarStage, type Bar, type BarSpec, type BarStep, type Mark } from '../BarStage'
import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

/**
 * Time per call (µs) on a call-number axis: calls 1 to 10 stand at 1 to 10, two later calls at 12.5 and 13.5.
 * Times are rounded from one scratch run (.NET 10, Release, a small loop): ~100 µs for call 1, 11–16 µs at tier 0, ~1.5 µs at tier 1.
 */
const chart = (steps: Record<string, BarStep>, outputName = 'Code running'): BarSpec => ({
  span: 14.4,
  width: 0.7,
  max: 30,
  ticks: [],
  axis: 'time per call (µs), by call number',
  outputName,
  steps,
})
/** The Setup draws no bars: only which calls were timed. */
const schedule = (steps: Record<string, BarStep>): BarSpec => ({ ...chart(steps, 'Measurement'), axis: 'call number', plot: false })

const TIER0 = [16, 15, 15, 14, 13, 12, 12, 12, 12]
const LATER = [12.5, 13.5]

const bar = (at: number, value: number, kind?: Bar['kind'], label?: string): Bar => ({ key: `c${at}`, at, value, kind, label })
const mark = (at: number, label: string, kind?: Mark['kind'], line: Mark['line'] = 0, wideOnly?: boolean): Mark => ({ key: `m${at}-${line}`, at, label, kind, line, wideOnly })
const out = (label: string, text: string, kind?: OutLine['kind']): OutLine => ({ label, text, kind })

const call1 = (kind?: Bar['kind']) => bar(1, 100, kind, '~100')
const tier0 = (kind?: Bar['kind'], label = true) => TIER0.map((v, i) => bar(i + 2, v, kind, label && i === 8 ? '~12' : undefined))
const tier1 = (kind?: Bar['kind'], label = '~1.5') => LATER.map((at, i) => bar(at, 1.5, kind, i === 1 ? label : undefined))
/** The claim's bars: one per timed call, all alike. */
const claimed = (value: number, label: string) => Array.from({ length: 10 }, (_, i) => bar(i + 1, value, undefined, i === 0 || i === 9 ? label : undefined))

const ENDS = [mark(1, 'call 1'), mark(10, 'call 10')]
const AXIS_MARKS = [...ENDS, mark(13, 'later', undefined, 0, true)]
const TIMED = [...ENDS, mark(5.5, 'timed', 'plain', 1)]
const HOT = mark(11.8, 'hot: tier 1', 'ok', 1)
const T0_LINE = out('Calls 1–10', 'tier 0: compiled quickly, barely optimized', 'bad')
const FREQ = 'Frequency 10,000,000: 1 tick = 100 ns'

const SPECS: Record<string, BarSpec> = {
  setup: schedule({
    timed: { bars: [], marks: TIMED, output: [out('Stopwatch', 'around each of calls 1 to 10')] },
    conclusion: { bars: [], marks: TIMED, output: [out('Stopwatch', 'around each of calls 1 to 10'), out('Conclusion', '"the new algorithm is slow"')] },
  }),

  tiers: chart({
    first: { bars: [call1('bad')], marks: [mark(1, 'call 1'), mark(1, 'JIT tier 0', 'bad', 1)], output: [out('Calls 1–10', 'tier 0: compiled quickly, barely optimized')] },
    tier0: { bars: [call1(), ...tier0('bad')], marks: TIMED, output: [T0_LINE] },
    promote: { bars: [call1(), ...tier0('bad')], marks: [...AXIS_MARKS, HOT], output: [T0_LINE, out('Background', 'recompiling at tier 1 + PGO', 'ok')] },
    tier1: { bars: [call1(), ...tier0('bad'), ...tier1('ok')], marks: [...AXIS_MARKS, HOT], output: [T0_LINE, out('Later calls', 'tier 1: ~1.5 µs per call', 'ok')] },
  }),
  warmup: chart(
    {
      warm: { bars: [call1('muted'), ...tier0('muted', false)], marks: [mark(5.5, 'warm-up, not measured', 'muted')], output: [out('Result', '(not measured yet)', 'muted')] },
      measure: {
        bars: [call1('muted'), ...tier0('muted', false), ...tier1('ok')],
        marks: [mark(5.5, 'warm-up, not measured', 'muted'), mark(13, 'measured', 'ok')],
        output: [out('Result', '~1.5 µs per call', 'ok')],
      },
    },
    'Benchmark',
  ),

  'rejit-claim': chart({
    every: { bars: claimed(20, 'JIT'), marks: [...ENDS, mark(5.5, 'compiled on every call', 'plain', 1)], output: [out('This run', 'compiles on every call')] },
    disk: { bars: claimed(20, 'JIT'), marks: [...ENDS, mark(5.5, 'compiled on every call', 'plain', 1)], output: [out('This run', 'compiles on every call'), out('Next run', 'loads the result cached on disk')] },
  }),
  'rejit-reality': chart({
    once: { bars: [call1('ok'), ...tier0()], marks: [...ENDS, mark(1, 'JIT tier 0, once', 'ok', 1)], output: [out('This run', 'tier 0 compiled once, before call 1', 'ok')] },
    tier1: { bars: [call1(), ...tier0(undefined, false), ...tier1('ok')], marks: [...AXIS_MARKS, mark(11.8, 'tier 1, once', 'ok', 1)], output: [out('This run', 'tier 0 once, then tier 1 once', 'ok')] },
    'no-disk': { bars: [call1(), ...tier0(undefined, false), ...tier1()], marks: AXIS_MARKS, output: [out('This run', 'tier 0 once, then tier 1 once'), out('Next run', 'starts at tier 0 again: no JIT cache on disk', 'bad')] },
  }),

  'interp-claim': chart({
    interp: { bars: [], marks: [...ENDS, mark(5.5, 'interpreted', 'plain', 1)], output: [out('Calls 1–10', 'run by an IL interpreter')] },
    gc: { bars: [], marks: [...ENDS, mark(5.5, 'interpreted', 'plain', 1), mark(12.5, 'GC, then JIT', 'plain', 1)], output: [out('Calls 1–10', 'run by an IL interpreter'), out('After a GC', 'the JIT starts compiling')] },
  }),
  'interp-reality': chart({
    compiled: { bars: [call1('ok'), ...tier0()], marks: [...ENDS, mark(1, 'JIT tier 0', 'ok', 1)], output: [out('Before call 1', 'compiled at tier 0, no interpreter', 'ok')] },
    counts: { bars: [call1(), ...tier0(undefined, false), ...tier1('ok')], marks: [...AXIS_MARKS, HOT], output: [out('Before call 1', 'compiled at tier 0'), out('Tier 1', 'when the call count says hot, not after a GC', 'ok')] },
  }),

  'tick-claim': chart(
    {
      coarse: { bars: [], marks: ENDS, output: [out('Stopwatch', 'not precise below 1 s')] },
      zero: { bars: claimed(0.1, '0–1 tick'), marks: ENDS, output: [out('Stopwatch', 'not precise below 1 s'), out('Each call', 'zero or one tick')] },
    },
    'Measurement',
  ),
  'tick-reality': chart(
    {
      precise: { bars: [], marks: ENDS, output: [out('Stopwatch', FREQ, 'ok')] },
      real: { bars: [call1(), ...tier0('bad')], marks: [...ENDS, mark(5.5, 'tier 0 code', 'bad', 1)], output: [out('Stopwatch', FREQ), out('Calls 1–10', 'real times, of tier 0 code', 'bad')] },
    },
    'Measurement',
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BarStage spec={s} {...p} />]),
)
export default drawing
