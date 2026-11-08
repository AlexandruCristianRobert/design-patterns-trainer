import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const actors: SeqSpec['actors'] = [
  { id: 'client', name: 'Client', tone: 'ui' },
  { id: 'gw', name: 'Gateway', tone: 'pool' },
  { id: 'api', name: 'API', tone: 'io' },
]
const spec = (steps: Record<string, SeqStep>): SeqSpec => ({ actors, outputName: 'Last response', steps })

const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const res = (...lines: [label: string, text: string, kind?: OutLine['kind']][]): OutLine[] => lines.map(([label, text, kind]) => ({ label, text, kind }))

const post = msg('post', 'client', 'api', 'POST /reports')
const export5 = note('export', 'api', 'export ~5 min')
const job = note('export', 'api', 'job 42 started')

const accepted = msg('accepted', 'api', 'client', '202 + Location', 'ok')
const ACCEPTED = res(['Status', '202 Accepted', 'ok'], ['Location', '/reports/jobs/42'], ['Retry-After', '10'])
const poll = (key: string) => msg(key, 'client', 'api', 'GET /reports/jobs/42')
const ASYNC = [post, job, accepted]

const SPECS: Record<string, SeqSpec> = {
  setup: {
    actors,
    steps: {
      post: { rows: [post, export5] },
      timeout: { rows: [post, export5, note('t1', 'client', 'timeout 30 s', 'muted'), note('t2', 'gw', 'timeout 30 s', 'muted'), msg('res', 'api', 'client', '?', 'muted')] },
    },
  },

  async: spec({
    post: { rows: [post, job] },
    accepted: { rows: ASYNC, output: ACCEPTED },
    poll: { rows: [...ASYNC, poll('poll1'), msg('running', 'api', 'client', '200: running 40%')], output: res(['Status', '200 OK'], ['Body', '{ "status": "running" }']) },
    done: {
      rows: [...ASYNC, poll('poll1'), msg('running', 'api', 'client', '200: running 40%'), poll('poll2'), msg('see', 'api', 'client', '303 See Other', 'ok')],
      output: res(['Status', '303 See Other', 'ok'], ['Location', '/reports/42']),
    },
    fetch: {
      rows: [...ASYNC, poll('poll1'), msg('running', 'api', 'client', '200: running 40%'), poll('poll2'), msg('see', 'api', 'client', '303 See Other', 'ok'), msg('get', 'client', 'api', 'GET /reports/42'), msg('report', 'api', 'client', '200: the report', 'ok')],
      output: res(['Status', '200 OK', 'ok'], ['Body', 'the report']),
    },
  }),

  'created-claim': spec({
    created: { rows: [post, job, msg('created', 'api', 'client', '201 + Location')], output: res(['Status', '201 Created'], ['Location', '/reports/42']) },
    poll: {
      rows: [post, job, msg('created', 'api', 'client', '201 + Location'), msg('get', 'client', 'api', 'GET /reports/42'), msg('nf', 'api', 'client', '404 until ready')],
      output: res(['Status', '404 Not Found']),
    },
  }),
  'created-reality': spec({
    created: {
      rows: [post, job, msg('created', 'api', 'client', '201 + Location', 'bad'), note('nothing', 'api', 'no report yet', 'bad')],
      output: res(['Status', '201 Created', 'bad'], ['Location', '/reports/42']),
    },
    poll: {
      rows: [post, job, msg('created', 'api', 'client', '201 + Location', 'bad'), msg('get', 'client', 'api', 'GET /reports/42'), msg('nf', 'api', 'client', '404', 'bad'), note('why', 'client', 'not ready? bad id? failed?', 'bad')],
      output: res(['Status', '404 Not Found', 'bad']),
    },
  }),

  'continue-claim': spec({
    hold: { rows: [post, note('export', 'api', 'exporting…'), note('open', 'gw', 'request open')] },
    ping: {
      rows: [post, note('export', 'api', 'exporting…'), note('open', 'gw', 'request open'), msg('c1', 'api', 'client', '100 Continue (20 s)'), msg('c2', 'api', 'client', '100 Continue (40 s)'), note('alive', 'gw', 'sees traffic')],
      output: res(['Status', '100 Continue']),
    },
  }),
  'continue-reality': spec({
    hold: {
      rows: [msg('post', 'client', 'api', 'POST, Expect: 100-continue'), msg('c1', 'api', 'client', '100 Continue', 'ok'), msg('body', 'client', 'api', 'request body', 'ok')],
      output: res(['Status', '100 Continue (interim)']),
    },
    ping: {
      rows: [post, note('export', 'api', 'exporting…'), note('open', 'gw', 'held 5 min', 'bad'), msg('c2', 'api', 'client', '100 Continue', 'bad'), note('alive', 'gw', 'not a keep-alive', 'bad'), note('drop', 'client', 'hiccup: lost', 'bad')],
      output: res(['Status', 'no final response', 'bad']),
    },
  }),

  'push-claim': spec({
    ok: { rows: [post, job, msg('ok', 'api', 'client', '200 OK, empty')], output: res(['Status', '200 OK'], ['Body', '(empty)']) },
    push: { rows: [post, job, msg('ok', 'api', 'client', '200 OK, empty'), msg('push', 'api', 'client', 'report, 5 min later')], output: res(['Status', '200 OK'], ['Body', '(empty)']) },
  }),
  'push-reality': spec({
    ok: { rows: [post, job, msg('ok', 'api', 'client', '200 OK, empty', 'bad'), note('done', 'client', 'success?', 'bad')], output: res(['Status', '200 OK', 'bad'], ['Body', '(empty)']) },
    push: {
      rows: [post, job, msg('ok', 'api', 'client', '200 OK, empty', 'bad'), note('done', 'client', 'exchange over'), msg('push', 'api', 'client', 'no 2nd response', 'skip')],
      output: res(['Status', '200 OK', 'bad'], ['Body', '(empty)']),
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
