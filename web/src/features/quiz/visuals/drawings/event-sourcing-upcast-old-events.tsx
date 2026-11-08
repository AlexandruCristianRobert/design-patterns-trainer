import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { TableStage, type TableDef, type TableSpec, type TChip, type TRow } from '../TableStage'

const SETUP = [
  '// stored since 2019',
  'record OrderPlaced(Guid OrderId, decimal Amount);',
  '',
  '// new requirement: Currency',
  '// (every old order was in CHF)',
]
const UPCAST = [
  'record OrderPlacedV1(Guid OrderId, decimal Amount);',
  'record OrderPlaced(Guid OrderId, decimal Amount,',
  '    string Currency);',
  '',
  '// upcaster, runs as events are read',
  'OrderPlaced Upcast(OrderPlacedV1 e) =>',
  '    new(e.OrderId, e.Amount, "CHF");',
]
const U = { V1: 0, V2: [1, 2] as [number, number], UP: [4, 6] as [number, number] }
const MIGRATION = [
  '-- one-off migration',
  'UPDATE events',
  "SET payload = payload || '{\"Currency\":\"CHF\"}'",
  "WHERE type = 'OrderPlaced';",
]
const CHANGED = [
  '// changed in place: old events fail to deserialise',
  'record OrderPlaced(Guid OrderId, decimal Amount,',
  '    string Currency);',
]

const STORE: TableDef = { id: 'store', name: 'Event store', sub: 'as written', tone: 'io', columns: ['Order', 'Event', 'Data'] }
const LOADED: TableDef = { id: 'loaded', name: 'Loaded OrderPlaced', sub: 'what domain code gets', tone: 'ok', columns: ['Order', 'Amount', 'Currency'] }
const SUMMARY: TableDef = { id: 'summary', name: 'OrderSummaries', sub: 'read model', tone: 'pool', columns: ['Order', 'Total'] }
const REBUILT: TableDef = { id: 'rebuilt', name: 'Rebuilt order', sub: 'from the read model', tone: 'muted', columns: ['Order', 'Known'] }
const SNAPS: TableDef = { id: 'snaps', name: 'Snapshots', sub: 'current state', tone: 'pool', columns: ['Order', 'State'] }

type Look = [kind?: TRow['kind'], mark?: string, markKind?: TRow['markKind']]
const row = (key: string, cells: string[], [kind, mark, markKind]: Look = []): TRow => ({ key, cells, kind, mark, markKind })

const OLD = [
  ['p1', '1', 'OrderPlaced', '120'],
  ['l1', '1', 'LineAdded', '+30'],
  ['a1', '1', 'AddressSet', 'Bern'],
  ['p2', '2', 'OrderPlaced', '80'],
] as const
type OldKey = (typeof OLD)[number][0]
const store = (looks: Partial<Record<OldKey, Look>> = {}, rest: Look = [], extra: TRow[] = []): TRow[] => [
  ...OLD.map(([key, ...cells]) => row(key, cells, looks[key] ?? rest)),
  ...extra,
]
const v2 = (look: Look = ['new', 'new version']) => row('p3', ['3', 'OrderPlaced v2', '45 EUR'], look)
const UNTOUCHED: Look = ['plain', 'untouched', 'ok']
const PLACED_UNTOUCHED = { p1: UNTOUCHED, p2: UNTOUCHED }

const chip = (key: string, label: string, kind: TChip['kind'] = 'run'): TChip => ({ key, label, kind })
const loaded = (key: string, order: string, amount: string, currency: string, look: Look = []) => row(key, [order, amount, currency], look)

const SUMMARY_ROWS = [row('s1', ['1', '150']), row('s2', ['2', '80'])]
const SNAP_ROWS: TRow[] = [row('n1', ['1', 'total 150, Bern'], ['new']), row('n2', ['2', 'total 80'], ['new'])]
const DELETED: Look = ['skip', 'deleted', 'bad']

const SPECS: Record<string, TableSpec> = {
  setup: {
    tables: [STORE],
    code: SETUP,
    steps: {
      stored: { tables: { store: store() }, chips: [chip('years', 'stored since 2019')], line: [0, 1] },
      currency: { tables: { store: store() }, chips: [chip('years', 'stored since 2019'), chip('new', 'new: Currency, old orders all CHF')], line: [3, 4] },
    },
  },

  upcast: {
    tables: [STORE, LOADED],
    code: UPCAST,
    steps: {
      version: { tables: { store: store({}, [], [v2()]) }, line: U.V2 },
      untouched: { tables: { store: store(PLACED_UNTOUCHED, [], [v2(['plain'])]) }, line: U.V1 },
      read: {
        tables: { store: store({ p1: ['read', 'read as V1'], p2: UNTOUCHED }, [], [v2(['plain'])]), loaded: [loaded('o1', '1', '120', 'CHF', ['new', 'upcast'])] },
        line: U.UP,
      },
      domain: {
        tables: {
          store: store(PLACED_UNTOUCHED, [], [v2(['plain'])]),
          loaded: [loaded('o1', '1', '120', 'CHF', ['hit', 'upcast']), loaded('o2', '2', '80', 'CHF', ['hit', 'upcast']), loaded('o3', '3', '45', 'EUR', ['hit', 'as stored'])],
        },
        chips: [chip('one', 'domain code: one version', 'ok'), chip('hist', 'history intact', 'ok')],
        line: U.V2,
      },
    },
  },

  'rewrite-claim': {
    tables: [STORE],
    code: MIGRATION,
    steps: {
      before: { tables: { store: store() } },
      migrate: {
        tables: { store: store({ p1: ['new', 'rewritten'], p2: ['new', 'rewritten'] }).map((r) => (r.kind === 'new' ? { ...r, cells: [r.cells[0], r.cells[1], `${r.cells[2]}, CHF`] } : r)) },
        line: [1, 3],
      },
    },
  },
  'rewrite-reality': {
    tables: [STORE],
    code: MIGRATION,
    steps: {
      before: { tables: { store: store({}, ['plain', 'as written', 'ok']) }, chips: [chip('only', 'the only record of what happened')] },
      migrate: {
        tables: { store: store({ p1: ['bad', 'original gone', 'bad'], p2: ['bad', 'original gone', 'bad'] }).map((r) => (r.kind === 'bad' ? { ...r, cells: [r.cells[0], r.cells[1], `${r.cells[2]}, CHF`] } : r)) },
        chips: [chip('bug', 'a bug here damages the only copy', 'bad')],
        line: [1, 3],
        bad: true,
      },
    },
  },

  'rebuild-claim': {
    tables: [STORE, SUMMARY],
    code: CHANGED,
    steps: {
      change: { tables: { store: store({ p1: ['skip', 'fails to load'], p2: ['skip', 'fails to load'] }), summary: SUMMARY_ROWS }, line: [1, 2] },
      rebuild: {
        tables: { store: store({ p1: ['skip', 'fails to load'], p2: ['skip', 'fails to load'] }), summary: SUMMARY_ROWS.map((r) => ({ ...r, kind: 'read' as const, mark: 'source' })) },
        chips: [chip('rebuild', 'orders rebuilt from the read model')],
        line: [1, 2],
      },
    },
  },
  'rebuild-reality': {
    tables: [STORE, SUMMARY, REBUILT],
    code: CHANGED,
    steps: {
      change: {
        tables: { store: store({ p1: ['skip', 'fails to load', 'bad'], p2: ['skip', 'fails to load', 'bad'] }), summary: [row('s1', ['1', '150'], ['read', 'from the events']), row('s2', ['2', '80'])] },
        line: [1, 2],
      },
      rebuild: {
        tables: {
          store: store({ p1: ['skip', 'fails to load', 'bad'], p2: ['skip', 'fails to load', 'bad'] }),
          summary: SUMMARY_ROWS,
          rebuilt: [row('r1', ['1', 'total 150'], ['bad', 'lines, address lost', 'bad'])],
        },
        chips: [chip('dir', 'derived data used as the source', 'bad')],
        line: [1, 2],
        bad: true,
      },
    },
  },

  'snapshot-claim': {
    tables: [STORE, SNAPS],
    steps: {
      snapshot: { tables: { store: store(), snaps: SNAP_ROWS } },
      delete: { tables: { store: store({}, ['skip', 'deleted']), snaps: SNAP_ROWS.map((r) => ({ ...r, kind: 'plain' as const })) } },
    },
  },
  'snapshot-reality': {
    tables: [STORE, SNAPS],
    steps: {
      snapshot: { tables: { store: store({}, ['plain', 'the source']), snaps: SNAP_ROWS.map((r) => ({ ...r, mark: 'load shortcut' })) } },
      delete: {
        tables: { store: store({}, DELETED), snaps: SNAP_ROWS.map((r) => ({ ...r, kind: 'plain' as const })) },
        chips: [chip('audit', 'audit trail gone', 'bad'), chip('proj', 'revenue per month: no history', 'bad')],
      },
    },
  },
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <TableStage spec={s} {...p} />]),
)
export default drawing
