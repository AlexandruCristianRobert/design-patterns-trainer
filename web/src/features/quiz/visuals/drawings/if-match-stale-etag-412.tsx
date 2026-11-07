import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const actors: SeqActor[] = [
  { id: 'a', name: 'Admin A', tone: 'ui' },
  { id: 'api', name: 'API', sub: 'product 7', tone: 'io' },
  { id: 'b', name: 'Admin B', tone: 'pool' },
]
const B_PUT = ['PUT /products/7 HTTP/1.1', 'If-Match: "v5"', 'Content-Type: application/json', '', '{ "price": 15 }']
const B_412 = [...B_PUT, '', 'HTTP/1.1 412 Precondition Failed']
const B_200 = [...B_PUT, '', 'HTTP/1.1 200 OK']
const B_304 = [...B_PUT, '', 'HTTP/1.1 304 Not Modified']
const B_409 = [...B_PUT, '', 'HTTP/1.1 409 Conflict']
const A_GET_304 = ['GET /products/7 HTTP/1.1', 'If-None-Match: "v6"', '', 'HTTP/1.1 304 Not Modified']
const RULES = [
  '-- RFC 9110 preconditions',
  'If-Match false, any method           412',
  'If-None-Match false, GET or HEAD     304',
  'If-None-Match false, other methods   412',
]
const L = { IF_MATCH: 1, STATUS: 6 }

const spec = (steps: Record<string, SeqStep>, code = B_PUT): SeqSpec => ({ actors, code, outputName: 'Product 7 on the server', steps })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const product = (etag: string, price: string, extra: OutLine[] = []): OutLine[] => [
  { label: 'ETag', text: etag },
  { label: 'Price', text: price },
  ...extra,
]
const V5 = product('"v5"', '10')
const V6 = product('"v6"', '12')

const loads = [msg('get-a', 'api', 'a', '200, ETag "v5"'), msg('get-b', 'api', 'b', '200, ETag "v5"')]
const saveA = [msg('put-a', 'a', 'api', 'PUT, If-Match "v5"'), msg('ok-a', 'api', 'a', '200, ETag "v6"', 'ok')]
const putB = msg('put-b', 'b', 'api', 'PUT, If-Match "v5"')
const before = [...loads, ...saveA, putB]
const check = note('check', 'api', '"v5" vs current "v6": no match', 'bad')
const r412 = msg('r412', 'api', 'b', '412 Precondition Failed', 'ok')

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    load: { rows: loads, line: null, output: V5 },
    'save-a': { rows: [...loads, ...saveA], line: null, output: V6 },
    'put-b': { rows: [...before, note('q', 'api', '?', 'muted')], line: null, output: product('"v6"', '12', [{ label: 'Response to B', text: '?', kind: 'muted' }]) },
  }),
  precondition: spec({
    load: { rows: loads, line: null, output: V5 },
    'save-a': { rows: [...loads, ...saveA], line: null, output: V6 },
    'check-b': { rows: [...before, check], line: L.IF_MATCH, output: V6 },
    reject: { rows: [...before, check, r412], line: L.STATUS, code: B_412, output: product('"v6"', '12', [{ label: 'Change', text: 'none, A\'s edit kept', kind: 'ok' }]) },
    refetch: {
      rows: [...before, check, r412, msg('get-b2', 'api', 'b', '200, ETag "v6", price 12'), msg('put-b2', 'b', 'api', 'PUT, If-Match "v6"'), msg('ok-b2', 'api', 'b', '200, ETag "v7"', 'ok')],
      line: null,
      code: B_412,
      output: product('"v7"', "B's new price"),
    },
  }),

  'cache-claim': spec({
    'put-b': { rows: [...before, note('hint', 'api', 'If-Match: only a hint for caches')], line: L.IF_MATCH, output: V6 },
    apply: { rows: [...before, note('hint', 'api', 'If-Match: only a hint for caches'), msg('r200', 'api', 'b', '200 OK')], line: L.STATUS, code: B_200, output: product('"v7"', '15') },
  }),
  'cache-reality': spec({
    'put-b': { rows: [...before, note('must', 'api', 'If-Match: a precondition to evaluate')], line: L.IF_MATCH, output: V6 },
    ignored: {
      rows: [...before, note('must', 'api', 'If-Match: a precondition to evaluate'), note('lost', 'api', "if ignored: 15 overwrites A's 12", 'skip')],
      line: L.IF_MATCH,
      output: product('"v6"', '12', [{ label: 'If ignored', text: "price 15, A's edit lost", kind: 'bad' }]),
    },
    reject: {
      rows: [...before, note('must', 'api', 'If-Match: a precondition to evaluate'), note('lost', 'api', "if ignored: 15 overwrites A's 12", 'skip'), check, r412],
      line: L.STATUS,
      code: B_412,
      output: product('"v6"', '12', [{ label: 'Change', text: 'none', kind: 'ok' }]),
    },
  }),

  'not-modified-claim': spec({
    'put-b': { rows: before, line: L.IF_MATCH, output: V6 },
    reply: { rows: [...before, msg('r304', 'api', 'b', '304 Not Modified')], line: L.STATUS, code: B_304, output: V6 },
  }),
  'not-modified-reality': spec(
    {
      'get-304': { rows: [msg('get-a', 'a', 'api', 'GET, If-None-Match "v6"'), msg('r304', 'api', 'a', '304: your copy is current', 'ok')], line: [1, 3], output: V6 },
      'put-412': {
        rows: [msg('get-a', 'a', 'api', 'GET, If-None-Match "v6"'), msg('r304', 'api', 'a', '304: your copy is current', 'ok'), putB, check, r412],
        line: L.STATUS,
        code: B_412,
        output: product('"v6"', '12', [{ label: 'Change', text: 'none' }]),
      },
    },
    A_GET_304,
  ),

  'conflict-claim': spec({
    reserved: { rows: [...before, note('res', 'api', '412: only for GET with If-None-Match')], line: L.IF_MATCH, output: V6 },
    reply: { rows: [...before, note('res', 'api', '412: only for GET with If-None-Match'), msg('r409', 'api', 'b', '409 Conflict')], line: L.STATUS, code: B_409, output: V6 },
  }),
  'conflict-reality': spec(
    {
      'if-match': { rows: [...before, check, r412], line: 1, output: V6 },
      'if-none-match': { rows: [...before, check, r412, note('get', 'a', 'GET, If-None-Match "v6": 304', 'ok')], line: [2, 3], output: V6 },
    },
    RULES,
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
