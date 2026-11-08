import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { TableStage, type TableDef, type TableSpec, type TableStep, type TChip, type TRow } from '../TableStage'

const code = (provider: string, extra: string[] = [], second = 'a@x.io', save = ['await Assert.ThrowsAsync<DbUpdateException>(', '  () => db.SaveChangesAsync());']) => [
  '// model: HasIndex(u => u.Email).IsUnique()',
  'var options = new DbContextOptionsBuilder<AppDb>()',
  `  .${provider}.Options;`,
  'using var db = new AppDb(options);',
  ...extra,
  'db.Add(new User { Email = "a@x.io" });',
  `db.Add(new User { Email = "${second}" });`,
  ...save,
]
const MEM = 'UseInMemoryDatabase("signup")'
const CODE = code(MEM)
const L = { MODEL: 0, CONTEXT: [1, 3] as [number, number], ADD: [4, 5] as [number, number], SAVE: [6, 7] as [number, number] }

const REAL_CODE = code('UseSqlServer(containerConnectionString)', ['await db.Database.EnsureCreatedAsync();'])
const RL = { SCHEMA: 4, SAVE: [7, 8] as [number, number] }
const ENSURE_CODE = code(MEM, ['db.Database.EnsureCreated();'])
const EL = { ENSURE: 4, SAVE: [7, 8] as [number, number] }
const TX_CODE = code(MEM, ['using var tx = db.Database.BeginTransaction();'], 'a@x.io', ['db.SaveChanges();', 'tx.Commit();'])
const TX_IGNORED_CODE = code(MEM, ['// options also ignore TransactionIgnoredWarning', 'using var tx = db.Database.BeginTransaction();'], 'a@x.io', ['db.SaveChanges();', 'tx.Commit();'])
const TL = { BEGIN: 4, COMMIT: [7, 8] as [number, number], IGNORED_COMMIT: { each: [4, [8, 9] as [number, number]] } }
const CASE_CODE = code(MEM, [], 'A@x.io')

const STORE: TableDef = { id: 'store', name: 'Users', sub: 'in the in-memory store', tone: 'pool', columns: ['Id', 'Email'] }
const SQL: TableDef = { id: 'store', name: 'Users', sub: 'table in SQL Server', tone: 'io', columns: ['Id', 'Email'] }

const user = (id: number, email = 'a@x.io', kind: TRow['kind'] = 'new', mark?: string, markKind?: TRow['markKind']): TRow => ({ key: `u${id}`, cells: [String(id), email], kind, mark, markKind })
const BOTH: TRow[] = [user(1), user(2)]
const STORED: TRow[] = [user(1, 'a@x.io', 'plain'), user(2, 'a@x.io', 'plain', 'stored too', 'muted')]

const chip = (key: string, label: string, kind: TChip['kind'] = 'run'): TChip => ({ key, label, kind })
const MODEL_INDEX = chip('index', 'model: unique index on Email')
const out = (lines: [string, string, OutLine['kind']?][]): OutLine[] => lines.map(([label, text, kind]) => ({ label, text, kind }))
const SUCCEEDED = out([['SaveChanges', 'succeeded'], ['Assert', 'fails: no exception thrown', 'bad']])

const spec = (steps: Record<string, TableStep>, c = CODE, table = STORE): TableSpec => ({ tables: [table], code: c, outputName: 'Test run', steps })

/** The real InMemory run. */
const M = {
  keys: { tables: { store: BOTH }, chips: [MODEL_INDEX, chip('pk', 'primary keys 1, 2: unique', 'ok')], line: L.SAVE },
  index: {
    tables: { store: [user(1), user(2, 'a@x.io', 'new', 'same email, stored', 'bad')] },
    chips: [MODEL_INDEX, chip('pk', 'primary keys 1, 2: unique', 'ok'), chip('uq', 'unique index: not enforced', 'bad')],
    line: L.SAVE,
    output: SUCCEEDED,
  },
} satisfies Record<string, TableStep>

const SPECS: Record<string, TableSpec> = {
  setup: spec({
    model: { tables: {}, chips: [MODEL_INDEX], line: L.MODEL },
    test: { tables: {}, chips: [MODEL_INDEX], line: L.ADD },
    save: { tables: {}, chips: [MODEL_INDEX], line: L.SAVE, output: SUCCEEDED },
  }),
  inmemory: spec(M),
  'real-db': spec(
    {
      schema: { tables: { store: [] }, chips: [chip('ix', 'IX_Users_Email: unique index', 'ok')], line: RL.SCHEMA },
      insert: {
        tables: { store: [user(1, 'a@x.io', 'skip', 'rolled back', 'muted'), user(2, 'a@x.io', 'bad', 'violates IX_Users_Email', 'bad')] },
        chips: [chip('ix', 'IX_Users_Email: unique index', 'ok')],
        line: RL.SAVE,
        output: out([['SaveChanges', 'throws DbUpdateException', 'ok'], ['Assert', 'passes', 'ok']]),
      },
    },
    REAL_CODE,
    SQL,
  ),

  'ensure-claim': spec(
    {
      missing: { tables: {}, chips: [MODEL_INDEX, chip('store-ix', 'store: index not created yet', 'bad')], line: L.CONTEXT },
      call: {
        tables: { store: [user(1), user(2, 'a@x.io', 'bad', 'rejected', 'bad')] },
        chips: [MODEL_INDEX, chip('store-ix', 'store: index created', 'bad')],
        line: { each: [EL.ENSURE, EL.SAVE] },
        output: out([['SaveChanges', 'throws DbUpdateException', 'bad']]),
      },
    },
    ENSURE_CODE,
  ),
  'ensure-reality': spec(
    {
      missing: { tables: {}, chips: [MODEL_INDEX, chip('store-ix', 'store: no schema at all', 'ok')], line: L.CONTEXT },
      call: {
        tables: { store: STORED },
        chips: [MODEL_INDEX, chip('store-ix', 'store: no schema at all', 'ok'), chip('seed', 'EnsureCreated: seed data only')],
        line: { each: [EL.ENSURE, EL.SAVE] },
        output: SUCCEEDED,
      },
    },
    ENSURE_CODE,
  ),

  'transaction-claim': spec({
    save: { tables: { store: BOTH }, chips: [MODEL_INDEX, chip('check', 'constraints: checked at commit', 'bad')], line: L.SAVE, output: SUCCEEDED },
    commit: {
      tables: { store: [user(1), user(2, 'a@x.io', 'bad', 'rejected at commit', 'bad')] },
      chips: [MODEL_INDEX, chip('check', 'constraints: checked at commit', 'bad')],
      code: TX_CODE,
      line: TL.COMMIT,
      output: out([['Commit', 'throws DbUpdateException', 'bad']]),
    },
  }),
  'transaction-reality': spec(
    {
      save: { tables: {}, chips: [MODEL_INDEX, chip('tx', 'transactions: none')], line: TL.BEGIN, bad: true, output: out([['BeginTransaction', 'throws InvalidOperationException', 'bad']]) },
      commit: {
        tables: { store: STORED },
        chips: [MODEL_INDEX, chip('tx', 'transactions: none'), chip('uq', 'unique index: never checked', 'bad')],
        code: TX_IGNORED_CODE,
        line: TL.IGNORED_COMMIT,
        output: out([['SaveChanges', 'succeeded'], ['Commit', 'succeeded, does nothing']]),
      },
    },
    TX_CODE,
  ),

  'case-claim': spec({
    compare: { tables: {}, chips: [MODEL_INDEX, chip('store-ix', 'store: unique index exists'), chip('cmp', 'strings: compared case-insensitively', 'bad')], line: L.SAVE },
    differ: {
      tables: { store: [user(1), user(2, 'A@x.io', 'bad', 'rejected', 'bad')] },
      chips: [MODEL_INDEX, chip('store-ix', 'store: unique index exists'), chip('cmp', 'strings: compared case-insensitively', 'bad')],
      code: CASE_CODE,
      line: L.ADD,
      output: out([['SaveChanges', 'throws DbUpdateException', 'bad']]),
    },
  }),
  'case-reality': spec({
    compare: { tables: { store: [user(1, 'a@x.io', 'hit'), user(2, 'a@x.io', 'hit', 'identical', 'muted')] }, chips: [MODEL_INDEX], line: L.ADD },
    differ: {
      tables: { store: [user(1, 'a@x.io', 'plain'), user(2, 'A@x.io', 'plain', 'stored too', 'muted')] },
      chips: [MODEL_INDEX, chip('uq', 'unique index: not enforced', 'bad'), chip('cmp', 'strings: case-sensitive', 'ok')],
      code: CASE_CODE,
      line: L.ADD,
      output: out([['SaveChanges', 'succeeded']]),
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <TableStage spec={s} {...p} />]),
)
export default drawing
