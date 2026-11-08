import { BarStage, type BarSpec, type BarStep, type Mark } from '../BarStage'
import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

/** A schedule of requests on a 40-second axis: marks only, no load bars. */
const schedule = (steps: Record<string, BarStep>): BarSpec => ({
  span: 40,
  width: 1,
  max: 1,
  ticks: [0, 10, 20, 30, 40],
  axis: 'seconds after the first request',
  plot: false,
  outputName: 'Client',
  steps,
})
const mark = (key: string, at: number, label: string, kind: Mark['kind'] = 'plain', line: Mark['line'] = 0, wideOnly?: boolean): Mark => ({ key, at, label, kind, line, wideOnly })
const out = (label: string, text: string, kind?: OutLine['kind']): OutLine => ({ label, text, kind })

const REQ = mark('r0', 0, 'request')
const R429 = mark('r0', 0, '429', 'bad')
const RESPONSE = out('response', '429 Too Many Requests, Retry-After: 30')
const OK30 = mark('r30', 30, '200 OK', 'ok')
const WINDOW = mark('win', 30, 'Retry-After ends', 'muted', 1)
/** The same mark on the first line, for charts whose second line is busy near 30 s. */
const WINDOW_LOW = mark('win', 30, 'Retry-After ends', 'muted', 0)

/** Exponential backoff from 100 ms: retries at 0.1, 0.3, 0.7, 1.5, 3.1, 6.3, 12.7 and 25.5 s. */
/**
 * The first four retries (0.1 to 1.5 s) stand too close for one label each: they share one mark on the second line.
 * The next two are labelled on wide screens only; on a phone they would crowd the 429 (the output names the count).
 */
const retries = (label: string, group: string, kind: Mark['kind']): Mark[] => [
  mark('early', 0.8, group, kind, 1),
  mark('b4', 3.1, label, kind, 0, true),
  mark('b5', 6.3, label, kind, 1, true),
  mark('b6', 12.7, label, kind, 0),
  mark('b7', 25.5, label, kind, 1),
]

const SPECS: Record<string, BarSpec> = {
  // ---- Setup: the request and the response; nothing about when the client sends again ----
  setup: schedule({
    request: { bars: [], marks: [REQ] },
    response: { bars: [], marks: [R429], output: [RESPONSE] },
    ask: { bars: [], marks: [R429], output: [RESPONSE] },
  }),

  wait: schedule({
    meaning: { bars: [], marks: [R429, WINDOW], output: [RESPONSE, out('waits', 'at least 30 s', 'ok')] },
    retry: { bars: [], marks: [R429, WINDOW, OK30], output: [RESPONSE, out('waits', 'at least 30 s', 'ok'), out('retry', 'at 30 s: 200 OK', 'ok')] },
    resilience: {
      bars: [],
      marks: [R429, WINDOW, OK30],
      output: [RESPONSE, out('waits', 'at least 30 s', 'ok'), out('retry', 'at 30 s: 200 OK', 'ok'), out('Resilience', 'retry delay taken from Retry-After by default', 'ok')],
    },
  }),

  'permanent-claim': schedule({
    treat: { bars: [], marks: [R429], output: [RESPONSE, out('treated as', '400 Bad Request')] },
    fail: { bars: [], marks: [R429, mark('stop', 3, 'not repeated', 'plain', 1)], output: [RESPONSE, out('treated as', '400 Bad Request'), out('request', 'not repeated')] },
  }),
  'permanent-reality': schedule({
    transient: { bars: [], marks: [R429, WINDOW], output: [RESPONSE, out('cause', 'the rate, not the content', 'ok')] },
    later: { bars: [], marks: [R429, WINDOW, OK30], output: [RESPONSE, out('cause', 'the rate, not the content', 'ok'), out('same request', 'at 30 s: 200 OK', 'ok')] },
  }),

  'conn-claim': schedule({
    count: { bars: [], marks: [R429], output: [RESPONSE, out('limit', 'counted per connection')] },
    retry: { bars: [], marks: [R429, mark('n1', 2, 'new connection', 'plain', 1)], output: [RESPONSE, out('limit', 'counted per connection'), out('retry', 'at once, new connection')] },
  }),
  'conn-reality': schedule({
    key: { bars: [], marks: [R429, WINDOW], output: [RESPONSE, out('limit', 'keyed on API key, token or IP', 'ok')] },
    again: {
      bars: [],
      marks: [R429, WINDOW, mark('n1', 2, '429 again', 'bad', 1)],
      output: [RESPONSE, out('limit', 'keyed on API key, token or IP', 'ok'), out('retry', 'new connection: 429 again', 'bad')],
    },
  }),

  'backoff-claim': schedule({
    ignore: { bars: [], marks: [R429], output: [RESPONSE, out('Retry-After', 'ignored')] },
    backoff: { bars: [], marks: [R429, ...retries('retry', '4 retries', 'plain')], output: [RESPONSE, out('Retry-After', 'ignored'), out('retries', '0.1, 0.3, 0.7, 1.5, 3.1 … s')] },
  }),
  'backoff-reality': schedule({
    general: { bars: [], marks: [R429, WINDOW_LOW], output: [RESPONSE, out('Retry-After', 'for any client', 'ok')] },
    rejected: { bars: [], marks: [R429, WINDOW_LOW, ...retries('429', '4 × 429', 'bad')], output: [RESPONSE, out('Retry-After', 'for any client', 'ok'), out('retries', '8 inside the 30 s, all 429', 'bad')] },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BarStage spec={s} {...p} />]),
)
export default drawing
