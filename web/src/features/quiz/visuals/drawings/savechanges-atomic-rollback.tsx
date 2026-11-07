import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { TableStage, type TableDef, type TableSpec, type TableStep, type TChip, type TRow } from '../TableStage'

const CODE = [
  '// Users has a unique index on Email; cy@ex.ch is stored',
  'db.Users.Add(new User { Email = "ann@ex.ch" });',
  'db.Users.Add(new User { Email = "bob@ex.ch" });',
  'db.Users.Add(new User { Email = "cy@ex.ch" });',
  'await db.SaveChangesAsync();',
]
const ALWAYS_CODE = ['db.Database.AutoTransactionBehavior =', '    AutoTransactionBehavior.Always;', '', ...CODE.slice(1)]
const L = { ADD: [1, 3] as [number, number], ANN: 1, BOB: 2, CY: 3, SAVE: 4 }

const USERS: TableDef = { id: 'users', name: 'Users table', sub: 'database', tone: 'io', columns: ['Email'] }
const TRACKER: TableDef = { id: 'tracker', name: 'Change tracker', sub: 'DbContext', tone: 'ui', columns: ['Entity', 'State'] }

type Look = [kind: TRow['kind'], mark?: string, markKind?: TRow['markKind']]
const STORED: TRow = { key: 'stored', cells: ['cy@ex.ch'], mark: 'already stored', markKind: 'muted' }
/** The Users table: the stored row, then one row per new user that has a look. */
const users = (ann?: Look, bob?: Look, cy?: Look): TRow[] => [
  STORED,
  ...([
    ['ann', 'ann@ex.ch', ann],
    ['bob', 'bob@ex.ch', bob],
    ['cy', 'cy@ex.ch', cy],
  ] as const)
    .filter(([, , look]) => look)
    .map(([key, email, look]) => ({ key, cells: [email], kind: look![0], mark: look![1], markKind: look![2] })),
]
const UNKNOWN: TRow = { key: 'q', cells: ['?'], kind: 'muted' }
const tracker = (mark?: string): TRow[] =>
  ['ann', 'bob', 'cy'].map((n) => ({ key: n, cells: [`${n}@ex.ch`, 'Added'], kind: mark ? 'read' : 'plain', mark, markKind: mark ? 'bad' : undefined }))

const OPEN: Look = ['new', 'not committed']
const COMMITTED: Look = ['new', 'committed', 'ok']
const REJECTED: Look = ['bad', 'unique index violated', 'bad']
const UNDONE: Look = ['skip', 'rolled back', 'bad']
const BEGIN: TChip = { key: 'tx', label: 'BEGIN TRANSACTION', kind: 'run' }
const ROLLBACK: TChip = { key: 'tx', label: 'ROLLBACK', kind: 'bad' }
const NO_TX: TChip = { key: 'tx', label: 'no transaction', kind: 'run' }
const result = (text: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'SaveChangesAsync', text, kind }]
const THROWS = result('throws DbUpdateException', 'bad')

const spec = (steps: Record<string, TableStep>, code = CODE): TableSpec => ({ tables: [USERS, TRACKER], code, outputName: 'Result', steps })
const st = (users: TRow[], line: TableStep['line'], extra: Partial<TableStep> = {}): TableStep => ({ tables: { users }, line, ...extra })

/** The real run, step by step. */
const R = {
  begin: st(users(), L.SAVE, { chips: [BEGIN], output: result('running…', 'muted') }),
  inserts: st(users(OPEN, OPEN), { each: [L.ANN, L.BOB] }, { chips: [BEGIN], output: result('running…', 'muted') }),
  violate: st(users(OPEN, OPEN, REJECTED), L.CY, { chips: [BEGIN], bad: true, output: result('running…', 'muted') }),
  rollback: st(users(UNDONE, UNDONE, UNDONE), L.SAVE, { chips: [ROLLBACK], bad: true, output: THROWS }),
  after: { tables: { users: users(), tracker: tracker('still Added') }, line: L.SAVE, chips: [ROLLBACK], output: THROWS },
} satisfies Record<string, TableStep>

const SPECS: Record<string, TableSpec> = {
  setup: spec({
    added: { tables: { users: users(), tracker: tracker() }, line: L.ADD },
    save: { tables: { users: [STORED, UNKNOWN], tracker: tracker() }, line: L.SAVE, output: result('?', 'muted') },
  }),
  transaction: spec(R),

  'autocommit-claim': spec({
    ann: st(users(COMMITTED), L.ANN, { chips: [NO_TX] }),
    bob: st(users(COMMITTED, COMMITTED), L.BOB, { chips: [NO_TX] }),
    third: st(users(COMMITTED, COMMITTED, REJECTED), L.CY, { chips: [NO_TX], bad: true }),
  }),
  'autocommit-reality': spec({ begin: R.begin, inserts: R.inserts, rollback: R.rollback }),

  'warning-claim': spec({
    check: st(users(), L.SAVE, { chips: [{ key: 'check', label: 'EF Core checks index: warning', kind: 'wait' }] }),
    saved: st(users(COMMITTED, COMMITTED, ['new', 'saved despite the index', 'ok']), L.SAVE, {
      chips: [{ key: 'check', label: 'EF Core checks index: warning', kind: 'wait' }],
      output: result('completes'),
    }),
  }),
  'warning-reality': spec({
    check: st(users(OPEN, OPEN), L.SAVE, { chips: [BEGIN, { key: 'check', label: 'no index check in EF Core', kind: 'run' }], output: result('running…', 'muted') }),
    saved: st(users(UNDONE, UNDONE, REJECTED), L.SAVE, { chips: [ROLLBACK, { key: 'check', label: 'database enforces the index', kind: 'bad' }], bad: true, output: THROWS }),
  }),

  'always-claim': spec(
    {
      default: { tables: { users: users(COMMITTED, COMMITTED, REJECTED) }, line: null, chips: [{ key: 'mode', label: 'default: no transaction', kind: 'run' }], code: CODE, bad: true },
      always: st(users(UNDONE, UNDONE, REJECTED), [0, 1], { chips: [{ key: 'mode', label: 'Always: one transaction', kind: 'run' }, ROLLBACK] }),
    },
    ALWAYS_CODE,
  ),
  'always-reality': spec(
    {
      default: { tables: { users: users(UNDONE, UNDONE, REJECTED) }, line: L.SAVE, code: CODE, chips: [{ key: 'mode', label: 'default WhenNeeded: one transaction', kind: 'ok' }, ROLLBACK], bad: true, output: THROWS },
      always: st(users(), [0, 1], { chips: [{ key: 'mode', label: 'Always: also for a single statement', kind: 'run' }, { key: 'never', label: 'Never: no transaction', kind: 'wait' }] }),
    },
    ALWAYS_CODE,
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <TableStage spec={s} {...p} />]),
)
export default drawing
