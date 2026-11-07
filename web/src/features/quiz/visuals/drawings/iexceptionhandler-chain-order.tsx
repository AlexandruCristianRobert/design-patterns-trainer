import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const SETUP_CODE = [
  'builder.Services.AddExceptionHandler<TimeoutHandler>();',
  'builder.Services.AddExceptionHandler<FallbackHandler>();',
  'var app = builder.Build();',
  'app.UseExceptionHandler();',
]
const CODE = [
  ...SETUP_CODE,
  '',
  '// inside the middleware, simplified',
  'foreach (var h in handlers) // in order',
  '    if (await h.TryHandleAsync(ctx, ex, ct))',
  '        return; // handled: chain ends',
  '// all false: the configured fallback',
]
const L = { REG: [0, 1] as [number, number], USE: 3, LOOP: [6, 7] as [number, number], RETURN: 8, FALLBACK: 9 }

const CLIENT: SeqActor = { id: 'client', name: 'Client', tone: 'muted' }
const MW: SeqActor = { id: 'mw', name: 'Middleware', tone: 'ui' }
const TIMEOUT: SeqActor = { id: 'timeout', name: 'Timeout', sub: 'Handler', tone: 'pool' }
const FALLBACK: SeqActor = { id: 'fallback', name: 'Fallback', sub: 'Handler', tone: 'pool' }

const spec = (steps: Record<string, SeqStep>, code = CODE, actors = [CLIENT, MW, TIMEOUT, FALLBACK]): SeqSpec => ({ actors, code, outputName: 'Outcome', steps })
const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const resp = (text: string, kind: OutLine['kind'] = 'plain'): OutLine[] => [{ label: 'Response', text, kind }]
const PENDING = resp('…', 'muted')

const req = row('req', 'client', 'request', 'mw')
const caught = row('caught', 'mw', 'exception', undefined, 'bad')
const callT = row('call-t', 'mw', 'TryHandleAsync', 'timeout')
const falseT = row('false-t', 'timeout', 'false', 'mw')
const callF = row('call-f', 'mw', 'TryHandleAsync', 'fallback')
const writesF = row('writes-f', 'fallback', 'writes')
const trueF = row('true-f', 'fallback', 'true', 'mw', 'ok')
const ends = row('ends', 'mw', 'chain ends', undefined, 'ok')
const toClient = row('resp', 'mw', 'response', 'client', 'ok')
const FALLBACK_RESP = resp('written by FallbackHandler', 'ok')

const START = [req, caught]
const CHAIN = {
  throws: { rows: START, line: L.USE, output: PENDING },
  first: { rows: [...START, callT, falseT], line: L.LOOP, output: PENDING },
  second: { rows: [...START, callT, falseT, callF, writesF, trueF], line: L.LOOP, output: PENDING },
  stop: { rows: [...START, callT, falseT, callF, writesF, trueF, ends, toClient], line: L.RETURN, output: FALLBACK_RESP },
} satisfies Record<string, SeqStep>

// Another exception, one that TimeoutHandler handles.
const other = [req, row('caught', 'mw', 'other error', undefined, 'bad'), callT, row('writes-t', 'timeout', 'writes'), row('true-t', 'timeout', 'true', 'mw', 'ok')]

const SETUP_ACTORS = [CLIENT, MW, { ...TIMEOUT, sub: 'registered 1st' }, { ...FALLBACK, sub: 'registered 2nd' }]
const setupRows: SeqRow[] = []

const SPECS: Record<string, SeqSpec> = {
  setup: spec(
    {
      registered: { rows: setupRows, line: { each: [L.REG, L.USE] }, output: resp('?', 'muted') },
      exception: { rows: [...setupRows, req, caught], line: L.USE, output: resp('?', 'muted') },
      question: {
        rows: [...setupRows, req, caught],
        line: L.USE,
        output: [
          { label: 'TimeoutHandler', text: 'returns false' },
          { label: 'FallbackHandler', text: 'writes a response, returns true' },
          { label: 'Response', text: '?', kind: 'muted' },
        ],
      },
    },
    SETUP_CODE,
    SETUP_ACTORS,
  ),
  chain: spec(CHAIN),

  'wrap-claim': spec({
    order: { rows: [...START, row('call-f', 'mw', 'TryHandleAsync', 'fallback', 'bad')], line: L.REG, bad: true, output: PENDING },
    handled: {
      rows: [...START, row('call-f', 'mw', 'TryHandleAsync', 'fallback', 'bad'), writesF, trueF, row('skip-t', 'timeout', 'never runs', undefined, 'skip')],
      line: L.REG,
      bad: true,
      output: FALLBACK_RESP,
    },
  }),
  'wrap-reality': spec({
    order: { rows: [...START, row('call-t', 'mw', 'TryHandleAsync', 'timeout', 'ok')], line: L.LOOP, output: PENDING },
    handled: { rows: [...START, row('call-t', 'mw', 'TryHandleAsync', 'timeout', 'ok'), falseT, callF, writesF, trueF], line: L.LOOP, output: FALLBACK_RESP },
  }),

  'rethrow-claim': spec({
    first: CHAIN.first,
    rethrow: {
      rows: [...START, callT, falseT, row('rethrow', 'mw', 'rethrows at once', undefined, 'bad'), row('skip-f', 'fallback', 'never runs', undefined, 'skip'), row('resp', 'mw', '500', 'client', 'bad')],
      line: L.LOOP,
      bad: true,
      output: resp('the server’s default 500 page', 'bad'),
    },
  }),
  'rethrow-reality': spec({
    first: CHAIN.first,
    rethrow: { rows: [...START, callT, falseT, callF, writesF, trueF, toClient], line: L.LOOP, output: FALLBACK_RESP },
  }),

  'both-claim': spec({
    always: {
      rows: [...START, row('every', 'mw', 'calls all', undefined, 'bad'), callT, falseT, callF, writesF, trueF],
      line: L.LOOP,
      bad: true,
      output: FALLBACK_RESP,
    },
    overwrite: {
      rows: [...other, row('call-f', 'mw', 'TryHandleAsync', 'fallback', 'bad'), row('writes-f', 'fallback', 'overwrites', undefined, 'bad')],
      line: L.LOOP,
      bad: true,
      output: resp('overwritten by FallbackHandler', 'bad'),
    },
  }),
  'both-reality': spec({
    always: { rows: [...START, callT, falseT, callF, writesF, trueF, ends], line: L.RETURN, output: FALLBACK_RESP },
    overwrite: {
      rows: [...other, ends, row('skip-f', 'fallback', 'never runs', undefined, 'skip'), row('resp', 'mw', 'response', 'client', 'ok')],
      line: L.RETURN,
      output: resp('written by TimeoutHandler', 'ok'),
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
