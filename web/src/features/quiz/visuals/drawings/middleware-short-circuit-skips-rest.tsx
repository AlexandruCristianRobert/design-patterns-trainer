import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'app.Use(async (ctx, next) =>',
  '{',
  '    logger.LogInformation("A before");',
  '    await next(ctx);',
  '    logger.LogInformation("A after");',
  '});',
  'app.Use(async (ctx, next) =>',
  '{',
  '    if (ctx.Request.Path == "/blocked")',
  '    {',
  '        ctx.Response.StatusCode = 403;',
  '        return;',
  '    }',
  '    await next(ctx);',
  '});',
  'app.MapGet("/blocked", () => "secret");',
]
const L = { A: [0, 5] as [number, number], BEFORE: [2, 3] as [number, number], AFTER: 4, B: [8, 11] as [number, number], MAP: 15 }

const actors: SeqSpec['actors'] = [
  { id: 'client', name: 'Client', tone: 'muted' },
  { id: 'a', name: 'Middleware 1', sub: 'logs A', tone: 'ui' },
  { id: 'b', name: 'Middleware 2', sub: 'checks path', tone: 'pool' },
  { id: 'end', name: 'Endpoint', sub: 'MapGet', tone: 'io' },
]
const spec = (steps: Record<string, SeqStep>): SeqSpec => ({ actors, code: CODE, steps })

const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const request = row('req', 'client', 'GET /blocked', 'a')
const before = [request, row('before', 'a', 'log "A before"'), row('next', 'a', 'next(ctx)', 'b')]
const blocked = [...before, row('b403', 'b', 'set 403, return')]
const never = row('end', 'end', 'never runs', undefined, 'skip')
const unwound = [...blocked, never, row('ret', 'b', 'returns', 'a'), row('after', 'a', 'log "A after"')]
const answered = [...unwound, row('resp', 'a', '403', 'client', 'ok')]

const log = (...lines: string[]): OutLine[] => lines.map((t) => ({ label: 'Log', text: t, kind: t === '?' ? 'muted' : 'plain' }))
const resp = (text: string, kind: OutLine['kind'] = 'plain'): OutLine => ({ label: 'Response', text, kind })

const R = {
  request: { rows: [request], line: null, output: [resp('…')] },
  aBefore: { rows: before, line: L.BEFORE, output: [...log('A before'), resp('…')] },
  bReturns: { rows: [...blocked, never], line: L.B, output: [...log('A before'), resp('…')] },
  unwind: { rows: unwound, line: L.AFTER, output: [...log('A before', 'A after'), resp('…')] },
  response: { rows: answered, line: L.AFTER, output: [...log('A before', 'A after'), resp('403, empty body', 'ok')] },
} satisfies Record<string, SeqStep>

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    request: { rows: [request], line: null, output: [resp('?', 'muted')] },
    'a-before': { rows: before, line: L.BEFORE, output: [...log('A before'), resp('?', 'muted')] },
    'b-returns': { rows: [...blocked, row('end', 'end', '?', undefined, 'muted')], line: L.B, output: [...log('A before'), resp('?', 'muted')] },
  }),
  'short-circuit': spec({ request: R.request, 'a-before': R.aBefore, 'b-returns': R.bReturns, unwind: R.unwind, response: R.response }),

  'after-skipped-claim': spec({
    'a-before': R.aBefore,
    'b-returns': R.bReturns,
    unwind: { rows: [...blocked, never, row('after', 'a', 'A after: skipped', undefined, 'skip')], line: L.AFTER, output: [...log('A before'), resp('…')] },
    response: {
      rows: [...blocked, never, row('after', 'a', 'A after: skipped', undefined, 'skip'), row('resp', 'b', '403', 'client', 'ok')],
      line: L.AFTER,
      output: [...log('A before'), resp('403, empty body', 'ok')],
    },
  }),
  'after-skipped-reality': spec({ 'a-before': R.aBefore, 'b-returns': R.bReturns, unwind: R.unwind, response: R.response }),

  'endpoint-runs-claim': spec({
    'a-before': R.aBefore,
    'b-returns': { rows: blocked, line: L.B, output: [...log('A before'), resp('…')] },
    endpoint: { rows: [...blocked, row('end', 'end', 'runs: "secret"', undefined, 'bad')], line: L.MAP, output: [...log('A before'), resp('…')] },
  }),
  'endpoint-runs-reality': spec({
    'a-before': R.aBefore,
    'b-returns': { rows: blocked, line: L.B, output: [...log('A before'), resp('…')] },
    endpoint: { ...R.response, line: L.MAP },
  }),

  'error-500-claim': spec({
    'a-before': R.aBefore,
    'b-returns': { rows: blocked, line: L.B, output: [...log('A before'), resp('…')] },
    response: { rows: [...blocked, row('err', 'b', 'error: no next, no body', undefined, 'bad'), row('resp', 'b', '500', 'client', 'bad')], line: L.B, bad: true, output: [...log('A before'), resp('500', 'bad')] },
  }),
  'error-500-reality': spec({
    'a-before': R.aBefore,
    'b-returns': { rows: blocked, line: L.B, output: [...log('A before'), resp('…')] },
    response: R.response,
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
