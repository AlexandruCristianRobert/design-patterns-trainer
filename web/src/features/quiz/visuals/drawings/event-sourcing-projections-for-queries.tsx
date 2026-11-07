import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { TableStage, type TableDef, type TableSpec, type TChip, type TRow } from '../TableStage'

const SCAN = [
  'foreach (var id in allOrderIds)',
  '{',
  '    var order = await store.LoadAsync(id);',
  '    if (order.IsOpen && order.Total > 10_000) result.Add(order);',
  '}',
]
const SNAP = ['// LoadAsync: latest snapshot + the events after it', ...SCAN]
const WHENALL = [
  'var orders = await Task.WhenAll(',
  '    allOrderIds.Select(id => store.LoadAsync(id)));',
  'var result = orders.Where(o => o.IsOpen && o.Total > 10_000);',
]
const PROJ = [
  '// projection: each event updates one read-model row',
  'OrderPlaced e  => Insert(e.OrderId, "Open", e.Total)',
  'LineAdded e    => Row(e.OrderId).Total += e.Amount',
  'OrderShipped e => Row(e.OrderId).Status = "Shipped"',
]
const QUERY = ['-- index on OrderSummaries (Status, Total)', 'SELECT OrderId, Total FROM OrderSummaries', "WHERE Status = 'Open' AND Total > 10000;"]
const PAYLOAD = [
  "-- index on the events' JSON payload (PostgreSQL)",
  "CREATE INDEX ON events (((payload->>'total')::numeric));",
  '-- ...and the same for the status',
  '',
  'SELECT stream_id FROM events',
  "WHERE (payload->>'total')::numeric > 10000;",
]

const EVENTS: TableDef = { id: 'events', name: 'Event store', sub: 'one stream per order', tone: 'io', columns: ['Order', 'Event', 'Amount'] }
const SUMMARY: TableDef = { id: 'summary', name: 'OrderSummaries', sub: 'read model', tone: 'ok', columns: ['Order', 'Status', 'Total'] }
const SNAPSHOTS: TableDef = { id: 'snaps', name: 'Snapshots', sub: 'latest per stream', tone: 'pool', columns: ['Order', 'State'] }

type Look = [kind: TRow['kind'], mark?: string, markKind?: TRow['markKind']]
const E = [
  ['p1', '1', 'OrderPlaced', '4,000'],
  ['l1', '1', 'LineAdded', '+8,000'],
  ['p2', '2', 'OrderPlaced', '12,500'],
  ['s2', '2', 'OrderShipped', '-'],
  ['p3', '3', 'OrderPlaced', '15,000'],
] as const
type EventKey = (typeof E)[number][0]
/** The event store; `looks` styles events by key, the rest get `rest`. `more` adds the streams of later orders. */
const events = (looks: Partial<Record<EventKey, Look>> = {}, rest: Look = ['plain'], more?: Look): TRow[] => [
  ...E.map(([key, stream, event, data]) => {
    const look = looks[key] ?? rest
    return { key, cells: [stream, event, data], kind: look[0], mark: look[1], markKind: look[2] }
  }),
  ...(more ? [{ key: 'more', cells: ['4 … N', '…', '…'], kind: more[0], mark: more[1], markKind: more[2] }] : []),
]
const row = (key: string, cells: string[], look: Look = ['plain']): TRow => ({ key, cells, kind: look[0], mark: look[1], markKind: look[2] })
const SNAPS: [string, string][] = [
  ['1', 'Open, 12,000'],
  ['2', 'Shipped, 12,500'],
  ['3', 'Open, 15,000'],
]
const snaps = (look: (i: number) => Look, more?: Look): TRow[] => [
  ...SNAPS.map(([s, state], i) => row(s, [s, state], look(i))),
  ...(more ? [row('more', ['4 … N', '…'], more)] : []),
]

const chip = (key: string, label: string, kind: TChip['kind'] = 'run'): TChip => ({ key, label, kind })
const SCREEN = chip('screen', 'screen: open orders > 10,000 CHF', 'run')
const READ: Look = ['read', 'loaded', 'bad']

const SPECS: Record<string, TableSpec> = {
  setup: {
    tables: [EVENTS],
    code: SCAN,
    steps: {
      streams: { tables: { events: events() }, chips: [chip('streams', '3 orders, 3 streams')] },
      screen: { tables: { events: events() }, chips: [SCREEN, chip('today', 'today: load each stream: minutes', 'bad')], line: [0, 4] },
    },
  },

  projection: {
    tables: [EVENTS, SUMMARY],
    code: PROJ,
    steps: {
      placed: { tables: { events: events({ p1: ['read', 'projected'] }), summary: [row('o1', ['1', 'Open', '4,000'], ['new'])] }, line: 1 },
      'line-added': {
        tables: { events: events({ p1: ['plain', 'projected', 'muted'], l1: ['read', 'projected'] }), summary: [row('o1', ['1', 'Open', '12,000'], ['new'])] },
        line: 2,
      },
      rest: {
        tables: {
          events: events({ p1: ['plain', 'projected', 'muted'], l1: ['plain', 'projected', 'muted'] }, ['read', 'projected']),
          summary: [row('o1', ['1', 'Open', '12,000'], ['new']), row('o2', ['2', 'Shipped', '12,500'], ['new']), row('o3', ['3', 'Open', '15,000'], ['new'])],
        },
        line: { each: [1, 3] },
      },
      query: {
        tables: {
          events: events({}, ['muted']),
          summary: [row('o1', ['1', 'Open', '12,000'], ['hit', 'returned', 'ok']), row('o2', ['2', 'Shipped', '12,500'], ['muted']), row('o3', ['3', 'Open', '15,000'], ['hit', 'returned', 'ok'])],
        },
        chips: [SCREEN, chip('cost', 'one indexed query, no stream loaded', 'ok')],
        code: QUERY,
        line: [1, 2],
      },
    },
  },

  'snapshot-claim': {
    tables: [EVENTS, SNAPSHOTS],
    code: SNAP,
    steps: {
      snapshots: { tables: { events: events(), snaps: snaps(() => ['new']) }, line: 0 },
      load: { tables: { events: events({}, ['muted']), snaps: snaps(() => ['read', 'rebuilt from here', 'ok']) }, chips: [chip('load', 'an order: snapshot, no full replay', 'ok')], line: 3 },
    },
  },
  'snapshot-reality': {
    tables: [SNAPSHOTS],
    code: SNAP,
    steps: {
      snapshots: { tables: { snaps: snaps(() => READ) }, chips: [SCREEN, chip('n', 'loads 3 of 3 orders', 'bad')], line: [1, 5] },
      load: { tables: { snaps: snaps(() => READ, READ) }, chips: [SCREEN, chip('n', 'full scan: N of N orders', 'bad')], line: [1, 5] },
    },
  },

  'parallel-claim': {
    tables: [EVENTS],
    code: WHENALL,
    steps: {
      parallel: { tables: { events: events({}, ['read', 'loading at once']) }, line: [0, 1] },
      faster: { tables: { events: events({}, ['read', 'loading at once']) }, chips: [chip('time', 'a fraction of the time', 'ok')], line: [0, 2] },
    },
  },
  'parallel-reality': {
    tables: [EVENTS],
    code: WHENALL,
    steps: {
      parallel: { tables: { events: events({}, READ) }, chips: [SCREEN, chip('n', 'reads every stream', 'bad')], line: [0, 1] },
      faster: { tables: { events: events({}, READ, READ) }, chips: [SCREEN, chip('n', 'every page view: N streams', 'bad')], line: [0, 1] },
    },
  },

  'payload-index-claim': {
    tables: [EVENTS],
    code: PAYLOAD,
    steps: {
      index: { tables: { events: events() }, chips: [chip('idx', 'index on the JSON payload')], line: [1, 2] },
      filter: { tables: { events: events() }, chips: [chip('idx', 'index on the JSON payload'), chip('answer', 'screen answered from the index', 'ok')], line: [4, 5] },
    },
  },
  'payload-index-reality': {
    tables: [EVENTS],
    code: PAYLOAD,
    steps: {
      index: {
        tables: { events: events({ p1: ['read', '4,000'], l1: ['read', '+8,000'] }, ['muted']) },
        chips: [chip('o1', 'order 1: 12,000 in no single event', 'bad')],
        line: [1, 2],
      },
      filter: {
        tables: {
          events: events(
            { p1: ['skip', 'missed', 'bad'], l1: ['skip', 'missed', 'bad'], p2: ['bad', 'found, but shipped', 'bad'], s2: ['muted'], p3: ['hit', 'found', 'ok'] },
            ['muted'],
          ),
        },
        chips: [chip('state', 'no event holds the current state', 'bad')],
        line: [4, 5],
        bad: true,
      },
    },
  },
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <TableStage spec={s} {...p} />]),
)
export default drawing
