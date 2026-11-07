import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const client: SeqActor = { id: 'c', name: 'Client', tone: 'ui' }
const api: SeqActor = { id: 'api', name: 'Payment API', tone: 'io' }
const store: SeqActor = { id: 's', name: 'Key store', sub: 'shared, durable', tone: 'pool' }
const cdn: SeqActor = { id: 'cdn', name: 'CDN', sub: 'shared cache', tone: 'muted' }
const lb: SeqActor = { id: 'lb', name: 'Load balancer', tone: 'muted' }
const instA: SeqActor = { id: 'a', name: 'Instance 1', tone: 'io' }
const instB: SeqActor = { id: 'b', name: 'Instance 2', tone: 'io' }

const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const charges = (n: number, kind?: OutLine['kind']): OutLine[] => [{ label: 'Card charged', text: n === 0 ? 'not yet' : `${n} × 50 CHF`, kind: n === 0 ? 'muted' : kind }]
const spec = (actors: SeqActor[], steps: Record<string, SeqStep>): SeqSpec => ({ actors, outputName: 'Outcome', steps })

// ---- Reality ----
const NO_KEY = [row('post', 'c', 'POST /payments 50 CHF', 'api'), row('charge', 'api', 'charge 50 CHF')]
const NO_KEY_LOST = [...NO_KEY, row('lost', 'api', '201: lost', 'c', 'skip'), row('timeout', 'c', 'timeout: paid?')]
const KEYED = [row('post', 'c', 'POST, key k1', 'api'), row('charge', 'api', 'charge 50 CHF'), row('save', 'api', 'save 201 as k1', 's')]
const KEYED_LOST = [...KEYED, row('lost', 'api', '201: lost', 'c', 'skip'), row('timeout', 'c', 'timeout: paid?')]
const KEYED_RETRY = [...KEYED_LOST, row('retry', 'c', 'retry, key k1', 'api'), row('find', 'api', 'k1?', 's'), row('found', 's', 'stored 201', 'api', 'ok')]

// ---- CDN ----
const THROUGH = [row('post', 'c', 'POST, key k1', 'cdn'), row('fwd', 'cdn', 'POST, key k1', 'api'), row('res', 'api', '201', 'cdn'), row('res2', 'cdn', '201', 'c')]

// ---- CSRF ----
const PAGE = row('page', 'api', 'page + key k1', 'c', 'bad')
const OWN_KEY = row('own', 'c', 'new random key k1', undefined, 'ok')

// ---- Sticky routing ----
const FIRST = [row('post', 'c', 'POST k1', 'lb'), row('route', 'lb', 'POST k1', 'a'), row('charge', 'a', 'charge')]
const CRASH = [...FIRST, row('save', 'a', 'save k1 in store'), row('crash', 'a', 'crashes', undefined, 'bad')]
const TO_B = [...CRASH, row('retry', 'c', 'retry k1', 'lb'), row('toB', 'lb', 'retry k1', 'b')]

const SPECS: Record<string, SeqSpec> = {
  setup: spec([client, api], {
    send: { rows: [row('post', 'c', 'POST /payments, Idempotency-Key: k1', 'api')] },
    question: { rows: [row('post', 'c', 'POST /payments, Idempotency-Key: k1', 'api'), row('q', 'api', 'why the key?', undefined, 'muted')] },
  }),
  'without-key': spec([client, api], {
    post: { rows: NO_KEY, output: charges(1) },
    timeout: { rows: NO_KEY_LOST, output: charges(1) },
    retry: { rows: [...NO_KEY_LOST, row('retry', 'c', 'POST /payments 50 CHF', 'api'), row('again', 'api', 'charge 50 CHF again', undefined, 'bad')], output: charges(2, 'bad') },
  }),
  'with-key': spec([client, api, store], {
    post: { rows: KEYED, output: charges(1) },
    timeout: { rows: KEYED_LOST, output: charges(1) },
    retry: { rows: KEYED_RETRY, output: charges(1) },
    replay: { rows: [...KEYED_RETRY, row('replay', 'api', 'stored 201, no charge', 'c', 'ok')], output: charges(1, 'ok') },
  }),

  'cache-claim': spec([client, cdn, api], {
    post: { rows: THROUGH },
    store: { rows: [...THROUGH, row('keep', 'cdn', 'caches the 201 under k1', undefined, 'bad')] },
    retry: { rows: [...THROUGH, row('keep', 'cdn', 'caches the 201 under k1', undefined, 'bad'), row('retry', 'c', 'POST, key k1', 'cdn'), row('hit', 'cdn', 'cached 201', 'c', 'bad')] },
  }),
  'cache-reality': spec([client, cdn, api], {
    post: { rows: THROUGH },
    store: { rows: [...THROUGH, row('keep', 'cdn', 'POST: nothing served from cache', undefined, 'ok')] },
    retry: {
      rows: [
        ...THROUGH,
        row('keep', 'cdn', 'POST: nothing served from cache', undefined, 'ok'),
        row('retry', 'c', 'POST, key k1', 'cdn'),
        row('fwd2', 'cdn', 'POST, key k1', 'api'),
        row('dedup', 'api', 'k1 seen: stored 201', undefined, 'ok'),
        row('back', 'api', 'stored 201', 'cdn'),
        row('back2', 'cdn', 'stored 201', 'c', 'ok'),
      ],
    },
  }),

  'csrf-claim': spec([client, api], {
    issue: { rows: [PAGE] },
    check: { rows: [PAGE, row('post', 'c', 'POST, key k1', 'api'), row('check', 'api', 'from our page: allow', undefined, 'bad')] },
  }),
  'csrf-reality': spec([client, api], {
    issue: { rows: [OWN_KEY] },
    check: { rows: [OWN_KEY, row('post', 'c', 'POST, key k1', 'api'), row('check', 'api', 'k1 new: charge, store result')] },
    retry: {
      rows: [OWN_KEY, row('post', 'c', 'POST, key k1', 'api'), row('check', 'api', 'k1 new: charge, store result'), row('retry', 'c', 'retry, key k1', 'api'), row('dedup', 'api', 'stored 201', 'c', 'ok')],
      output: charges(1, 'ok'),
    },
  }),

  'sticky-claim': spec([client, lb, instA, instB], {
    first: { rows: FIRST, output: charges(1) },
    retry: { rows: [...FIRST, row('retry', 'c', 'retry k1', 'lb'), row('same', 'lb', 'same instance', 'a', 'bad')], output: charges(1) },
  }),
  'sticky-reality': spec([client, lb, instA, instB], {
    first: { rows: CRASH, output: charges(1) },
    retry: { rows: TO_B, output: charges(1) },
    lookup: { rows: [...TO_B, row('find', 'b', 'k1 in store', undefined, 'ok'), row('back', 'b', 'stored 201', 'lb'), row('back2', 'lb', 'stored 201', 'c', 'ok')], output: charges(1, 'ok') },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
