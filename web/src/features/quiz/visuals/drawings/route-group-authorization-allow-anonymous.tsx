import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { TableStage, type TableDef, type TableSpec, type TableStep, type TChip, type TRow } from '../TableStage'

const CODE = [
  'var admin = app.MapGroup("/admin")',
  '    .RequireAuthorization("AdminOnly");',
  'admin.MapGet("/stats", GetStats);',
  'admin.MapGet("/ping", () => "pong").AllowAnonymous();',
]
const L = { GROUP: [0, 1] as [number, number], STATS: 2, PING: 3, ENDPOINTS: [2, 3] as [number, number] }

const META: TableDef = { id: 'meta', name: 'Endpoints in /admin', sub: 'metadata, and an anonymous request', tone: 'pool', columns: ['Endpoint', 'Policy', 'Anon'] }

type Mark = Pick<TRow, 'mark' | 'markKind'>
const row = (key: string, cells: string[], kind?: TRow['kind'], mark?: Mark): TRow => ({ key, cells, kind, ...mark })
const stats = (policy: string, kind?: TRow['kind'], mark?: Mark) => row('stats', ['/stats', policy, '—'], kind, mark)
const ping = (policy: string, anon: string, kind?: TRow['kind'], mark?: Mark) => row('ping', ['/ping', policy, anon], kind, mark)
const CHALLENGED: Mark = { mark: 'challenged', markKind: 'bad' }
const PONG: Mark = { mark: '"pong"', markKind: 'ok' }
const NEEDS: Mark = { mark: 'needs AdminOnly', markKind: 'bad' }
const UNKNOWN: Mark = { mark: '?', markKind: 'muted' }

const chip = (key: string, label: string, kind: TChip['kind'] = 'run'): TChip => ({ key, label, kind })
const GROUP = chip('group', 'group /admin: RequireAuthorization("AdminOnly")')
const STARTED = chip('app', 'app started', 'ok')

const step = (rows: TRow[], line: TableStep['line'], chips: TChip[] = [GROUP], bad?: boolean): TableStep => ({ tables: { meta: rows }, chips, line, bad })
const spec = (steps: Record<string, TableStep>): TableSpec => ({ tables: [META], code: CODE, steps })

/** Both endpoints carry the group's policy; /admin/ping also carries allow-anonymous metadata. */
const BOTH = [stats('AdminOnly'), ping('AdminOnly', 'yes')]
const SERVED = [stats('AdminOnly', 'bad', CHALLENGED), ping('AdminOnly', 'yes', 'hit', PONG)]

const SPECS: Record<string, TableSpec> = {
  setup: spec({
    group: { tables: {}, chips: [GROUP], line: L.GROUP },
    endpoints: step([row('stats', ['/stats', '?', '?']), row('ping', ['/ping', '?', '?'])], L.ENDPOINTS),
    question: step([row('stats', ['/stats', '?', '?'], 'plain', UNKNOWN), row('ping', ['/ping', '?', '?'], 'plain', UNKNOWN)], L.ENDPOINTS),
  }),

  metadata: spec({
    group: step([stats('AdminOnly', 'new'), ping('AdminOnly', '—', 'new')], L.GROUP),
    own: step([stats('AdminOnly'), ping('AdminOnly', 'yes', 'new')], L.PING),
    starts: step(BOTH, null, [GROUP, STARTED]),
  }),
  requests: spec({
    stats: step([stats('AdminOnly', 'bad', CHALLENGED), ping('AdminOnly', 'yes')], L.STATS, [GROUP, STARTED]),
    ping: step(SERVED, L.PING, [GROUP, STARTED]),
  }),

  'replace-claim': spec({
    order: step([stats('—'), ping('—', 'yes', 'new')], L.PING, [chip('first', '1. endpoint conventions'), chip('then', '2. group conventions')]),
    replace: step([stats('AdminOnly', 'plain', NEEDS), ping('AdminOnly', '—', 'bad', NEEDS)], L.GROUP, [chip('first', '1. endpoint conventions'), chip('then', '2. group conventions: replace')]),
  }),
  'replace-reality': spec({
    order: step([stats('AdminOnly'), ping('AdminOnly', 'yes', 'hit')], L.ENDPOINTS, [GROUP, chip('add', 'conventions only add', 'ok')]),
    replace: step(SERVED, L.PING, [GROUP, chip('add', 'conventions only add', 'ok')]),
  }),

  'prefix-claim': spec({
    prefix: step([row('group', ['/admin', 'AdminOnly', '—'], 'new'), stats('—'), ping('—', 'yes')], L.GROUP),
    requests: step([row('group', ['/admin', 'AdminOnly', '—']), stats('—', 'hit', { mark: 'served', markKind: 'ok' }), ping('—', 'yes', 'hit', PONG)], L.ENDPOINTS),
  }),
  'prefix-reality': spec({
    prefix: step([row('group', ['/admin', '—', '—'], 'muted', { mark: 'not an endpoint', markKind: 'muted' }), stats('AdminOnly', 'new'), ping('AdminOnly', 'yes', 'new')], L.GROUP),
    requests: step([row('group', ['/admin', '—', '—'], 'muted', { mark: 'not an endpoint', markKind: 'muted' }), ...SERVED], L.ENDPOINTS),
  }),

  'startup-claim': spec({
    build: step([stats('AdminOnly'), ping('AdminOnly', 'yes', 'bad', { mark: 'invalid', markKind: 'bad' })], L.PING),
    fails: step([stats('AdminOnly'), ping('AdminOnly', 'yes', 'bad', { mark: 'invalid', markKind: 'bad' })], L.PING, [GROUP, chip('app', 'startup fails', 'bad')], true),
  }),
  'startup-reality': spec({
    build: step([stats('AdminOnly'), ping('AdminOnly', 'yes', 'hit', { mark: 'allowed', markKind: 'ok' })], L.PING),
    fails: step(SERVED, null, [GROUP, STARTED]),
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <TableStage spec={s} {...p} />]),
)
export default drawing
