import { BarStage, type Bar, type BarSpec, type BarStep, type Mark } from '../BarStage'
import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

/** Bars count the retries that arrive in each half second; the database takes about 800 of them. */
const BASE = {
  width: 0.5,
  max: 2000,
  capacity: { value: 800, label: 'what the recovering database can take' },
  axis: 'seconds after the calls fail',
  outputName: 'Database',
}
/** A schedule: the time axis and its marks only, with no load and no capacity line. */
const schedule = (steps: Record<string, BarStep>): BarSpec => ({ ...chart(steps), capacity: undefined, plot: false })
const chart = (steps: Record<string, BarStep>, span = 16): BarSpec => ({
  ...BASE,
  span,
  ticks: span === 16 ? [0, 4, 8, 12, 16] : [0, 8, 16, 24, 32],
  steps,
})

const failed: Bar = { key: 'fail', at: 0.25, value: 2000, kind: 'muted' }
/** null: no value label (where waves stand too close for one). */
const wave = (at: number, kind: Bar['kind'] = 'bad', label: string | null = '2,000'): Bar => ({ key: `w${at}`, at, value: 2000, kind, label: label ?? undefined })
const mark = (at: number, label: string, kind: Mark['kind'] = 'plain', line: Mark['line'] = 0): Mark => ({ key: `m${at}`, at, label, kind, line })
const db = (text: string, kind: OutLine['kind'] = 'plain'): OutLine[] => [{ label: 'Status', text, kind }]
/** Neighbouring marks alternate between two lines so close waves keep readable labels. */
const down = (...ats: number[]) => ats.map((at, i) => mark(at, 'down', 'bad', (i % 2) as 0 | 1))
const failMark = mark(0, 'fail', 'muted', 1)

const EXP = [1, 3, 7, 15]
const LIN = [1, 3, 6, 10]
const delays = (ats: number[], ds: number[], kind: Mark['kind'] = 'plain') => ats.map((at, i) => mark(at, `+${ds[i]} s`, kind, (i % 2) as 0 | 1))

/** Jitter: the 2,000 first retries spread over about three seconds, every half second under the capacity line. */
const SPREAD = [200, 350, 450, 450, 350, 200].map((value, i): Bar => ({ key: `j${i}`, at: 0.75 + i * 0.5, value, kind: 'ok' }))

const waves = (ats: number[]) => ats.map((at) => wave(at))
const knocked: BarStep = { bars: waves(EXP), marks: down(...EXP), output: db('falls over at every wave', 'bad') }
/** On the 32-second axis the first waves stand too close for value labels. */
const waves32 = EXP.map((at) => wave(at, 'bad', null))
const knocked32: BarStep = { ...knocked, bars: waves32 }

const SPECS: Record<string, BarSpec> = {
  setup: schedule({
    outage: { bars: [], output: db('down for 20 s; 2,000 clients see their call fail', 'bad') },
    schedule: { bars: [], marks: delays(EXP, [1, 2, 4, 8]), output: db('down for 20 s; 2,000 clients see their call fail', 'bad') },
    'falls-over': { bars: [], marks: delays(EXP, [1, 2, 4, 8], 'bad'), output: db('recovers, then falls over again at each mark', 'bad') },
  }),
  exact: chart({
    fail: { bars: [failed], marks: [failMark], output: db('down') },
    'wave-1': { bars: [failed, wave(1)], marks: [failMark, ...down(1)], output: db('falls over at 1 s', 'bad') },
    'wave-2': { bars: [failed, ...waves([1, 3])], marks: [failMark, ...down(1, 3)], output: db('falls over at 1 and 3 s', 'bad') },
    waves: { bars: [failed, ...waves(EXP)], marks: [failMark, ...down(...EXP)], output: db('falls over at 1, 3, 7 and 15 s', 'bad') },
  }),
  jitter: chart({
    fail: { bars: [failed], marks: [failMark], output: db('down') },
    spread: { bars: [failed, ...SPREAD], marks: [failMark], output: db('gets the retries spread out') },
    served: { bars: [failed, ...SPREAD], marks: [failMark, mark(2, 'stays up', 'ok')], output: db('stays up and serves the retries', 'ok') },
  }),

  'more-attempts-claim': chart(
    {
      waves: knocked32,
      more: { ...knocked32, bars: [...waves32, wave(31, 'plain')], marks: [...down(...EXP), mark(31, '+16 s')] },
      recovered: { bars: [...waves32, wave(31, 'ok')], marks: [...down(...EXP), mark(31, 'succeeds', 'ok')], output: db('recovered by the later attempt', 'ok') },
    },
    32,
  ),
  'more-attempts-reality': chart(
    {
      waves: knocked32,
      more: { ...knocked32, bars: [...waves32, wave(31)], marks: [...down(...EXP), mark(31, '+16 s')] },
      recovered: { bars: [...waves32, wave(31)], marks: down(...EXP, 31), output: db('falls over at every wave, the extra one too', 'bad') },
    },
    32,
  ),

  'linear-claim': schedule({
    exponential: { bars: [], marks: delays(EXP, [1, 2, 4, 8], 'muted'), output: [{ label: 'Last retry', text: 'at 15 s', kind: 'muted' }] },
    linear: { bars: [], marks: delays(LIN, [1, 2, 3, 4]), output: [{ label: 'Last retry', text: 'at 10 s' }] },
    sooner: { bars: [], marks: delays(LIN, [1, 2, 3, 4], 'ok'), output: [{ label: 'Last retry', text: 'at 10 s: back sooner', kind: 'ok' }] },
  }),
  'linear-reality': chart({
    exponential: { bars: waves(EXP), output: db('gets 2,000 retries at once, four times') },
    linear: { bars: waves(LIN), marks: delays(LIN, [1, 2, 3, 4]), output: db('gets 2,000 retries at once, four times') },
    sooner: { bars: waves(LIN), marks: down(...LIN), output: db('falls over at every wave, and they come closer together', 'bad') },
  }),

  'timeout-claim': chart({
    waves: knocked,
    'short-timeout': { ...knocked, marks: EXP.map((at, i) => mark(at, '1 s timeout', 'plain', (i % 2) as 0 | 1)) },
    freed: { ...knocked, marks: EXP.map((at, i) => mark(at, 'freed', 'ok', (i % 2) as 0 | 1)) },
  }),
  'timeout-reality': chart({
    waves: knocked,
    'short-timeout': { ...knocked, marks: EXP.map((at, i) => mark(at, '1 s timeout', 'plain', (i % 2) as 0 | 1)), output: db('still gets 2,000 retries at once, four times', 'bad') },
    freed: { ...knocked, output: db('still falls over at every wave', 'bad') },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, spec]) => [stage, (p: StageDrawingProps) => <BarStage spec={spec} {...p} />]),
)
export default drawing
