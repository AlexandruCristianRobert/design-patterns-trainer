import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const ACTORS: SeqActor[] = [
  { id: 'app', name: 'Mobile app', sub: 'HTTP cache', tone: 'ui' },
  { id: 'srv', name: 'Server', sub: '/catalog', tone: 'io' },
]
const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const spec = (steps: Record<string, SeqStep>): SeqSpec => ({ actors: ACTORS, outputName: 'Over the network', steps })
const net = (text: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'response', text, kind }]

const CACHED = row('cached', 'app', 'cached: body, ETag "abc"')
const REQ = row('req', 'app', 'GET /catalog, If-None-Match: "abc"', 'srv')
const SAME = row('same', 'srv', 'current ETag: "abc"')
const BASE = [CACHED, REQ, SAME]
const COMPARE = row('cmp', 'srv', 'matches: condition false')
const R304 = row('r304', 'srv', '304 Not Modified', 'app', 'ok')
const HEADERS = net('304: headers only, no body', 'ok')
/** A claim's response arrow: neutral, only the status the claim names. */
const answer = (label: string) => row('resp', 'srv', label, 'app')

const SPECS: Record<string, SeqSpec> = {
  // ---- Setup: the cached copy, the conditional request, the unchanged catalog; no response drawn ----
  setup: spec({
    cached: { rows: [CACHED] },
    request: { rows: [CACHED, REQ] },
    unchanged: { rows: BASE },
    ask: { rows: [...BASE, row('q', 'srv', '?', undefined, 'muted')] },
  }),

  revalidate: spec({
    compare: { rows: [...BASE, COMPARE] },
    response: { rows: [...BASE, COMPARE, R304], output: HEADERS },
    reuse: { rows: [...BASE, COMPARE, R304, row('use', 'app', 'serves cached body', undefined, 'ok'), row('meta', 'app', 'updates metadata', undefined, 'ok')], output: HEADERS },
  }),

  'precondition-claim': spec({
    cond: { rows: [...BASE, COMPARE] },
    response: { rows: [...BASE, COMPARE, answer('412 Precondition Failed')] },
  }),
  'precondition-reality': spec({
    get: { rows: [...BASE, COMPARE, R304], output: HEADERS },
    put: {
      rows: [...BASE, COMPARE, R304, row('put', 'app', 'PUT, If-None-Match: *', 'srv'), row('exists', 'srv', 'resource exists'), row('r412', 'srv', '412', 'app', 'ok')],
      output: [...HEADERS, { label: 'for the PUT', text: '412 Precondition Failed', kind: 'ok' }],
    },
  }),

  'full-claim': spec({
    'put-only': { rows: [...BASE, row('rule', 'srv', 'header: PUT only')] },
    response: { rows: [...BASE, row('rule', 'srv', 'header: PUT only'), answer('200 OK, full body')], output: net('200: full catalog') },
  }),
  'full-reality': spec({
    'main-use': { rows: [...BASE, row('rule', 'srv', 'GET revalidation', undefined, 'ok'), COMPARE] },
    waste: {
      rows: [...BASE, row('rule', 'srv', 'GET revalidation', undefined, 'ok'), COMPARE, R304],
      output: [{ label: 'with 200', text: 'the full catalog again', kind: 'bad' }, { label: 'with 304', text: 'headers only', kind: 'ok' }],
    },
  }),

  'nocontent-claim': spec({
    nothing: { rows: [...BASE, row('none', 'srv', 'nothing new')] },
    response: { rows: [...BASE, row('none', 'srv', 'nothing new'), answer('204 No Content')] },
  }),
  'nocontent-reality': spec({
    meaning: { rows: [...BASE, row('r204', 'srv', '204 No Content', 'app', 'bad'), row('nouse', 'app', 'must not use cache', undefined, 'bad')] },
    only304: { rows: [...BASE, COMPARE, R304, row('use', 'app', 'serves cached body', undefined, 'ok'), row('meta', 'app', 'updates metadata', undefined, 'ok')], output: HEADERS },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
