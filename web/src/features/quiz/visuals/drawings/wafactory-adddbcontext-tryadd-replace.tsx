import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { TableStage, type TableDef, type TableSpec, type TableStep, type TChip, type TRow } from '../TableStage'

const CODE = [
  '// Program.cs',
  'builder.Services.AddDbContext<ShopDb>(o => o.UseSqlServer(prodConnectionString));',
  '// the test\'s WebApplicationFactory',
  'builder.ConfigureTestServices(services =>',
  '    services.AddDbContext<ShopDb>(o => o.UseNpgsql(testConnectionString)));',
]
const FIX_CODE = [
  'builder.ConfigureTestServices(services =>',
  '{',
  '    services.RemoveAll<DbContextOptions<ShopDb>>();',
  '    services.RemoveAll<IDbContextOptionsConfiguration<ShopDb>>(); // EF Core 9+',
  '    services.AddDbContext<ShopDb>(o => o.UseNpgsql(testConnectionString));',
  '});',
]
const L = { PROGRAM: 1, TEST: [3, 4] as [number, number], FIX_REMOVE: [2, 3] as [number, number], FIX_ADD: 4 }

const SC: TableDef = { id: 'sc', name: 'Service collection', sub: 'registrations for ShopDb', tone: 'ui', columns: ['Service'] }

// Zero-width spaces let the long generic type names wrap at a word boundary on narrow screens.
const ZW = '​'
const OPTIONS = `DbContextOptions${ZW}<ShopDb>`
const CONFIG = `IDbContextOptions${ZW}Configuration${ZW}<ShopDb>`
const PROD = 'SQL Server'
const TEST = 'Npgsql'

/** One registration; the note beside it names the provider it configures and, if any, what the step says about it. */
const r = (key: string, service: string, provider: string | null, kind?: TRow['kind'], mark?: string, markKind?: TRow['markKind']): TRow => ({
  key,
  cells: [service],
  kind,
  mark: [provider, mark].filter(Boolean).join(' · ') || undefined,
  markKind,
})
const ctx = (lifetime?: string, kind?: TRow['kind'], mark?: string, markKind?: TRow['markKind']) =>
  r('ctx', lifetime ? `ShopDb · ${lifetime}` : 'ShopDb', null, kind, mark, markKind)
const appOpts = (kind?: TRow['kind'], mark?: string, markKind?: TRow['markKind']) => r('opts', OPTIONS, PROD, kind, mark, markKind)
const testOpts = (kind?: TRow['kind'], mark?: string, markKind?: TRow['markKind']) => r('topts', OPTIONS, TEST, kind, mark, markKind)
const SKIPPED = testOpts('skip', 'skipped by TryAdd', 'bad')

const out = (db: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'Database used', text: db, kind: db === '?' ? 'muted' : kind }]
const spec = (steps: Record<string, TableStep>, code = CODE): TableSpec => ({ tables: [SC], code, outputName: 'Outcome', steps })
const chip = (key: string, label: string, kind: TChip['kind'] = 'run'): TChip => ({ key, label, kind })

/** The Setup's view: only the two calls, as the stem gives them. */
const CALLS: TableDef = { id: 'calls', name: 'AddDbContext<ShopDb> calls', tone: 'muted', columns: ['Where', 'Provider'] }
const APP_CALL: TRow = { key: 'app', cells: ['Program', 'SQL Server (production)'], kind: 'new' }
const TEST_CALL: TRow = { key: 'test', cells: ['ConfigureTest​Services', 'Npgsql (test)'], kind: 'new' }

/** The real run, step by step. */
const R = {
  program: { tables: { sc: [ctx(undefined, 'new'), appOpts('new')] }, line: L.PROGRAM, output: out('…') },
  test: { tables: { sc: [ctx(), appOpts(), SKIPPED] }, line: L.TEST, output: out('…') },
  ef8: { tables: { sc: [ctx(), appOpts('hit', 'used', 'ok'), SKIPPED] }, line: L.TEST, output: out('production (EF Core 8)', 'bad') },
  ef9: {
    tables: {
      sc: [
        ctx(),
        appOpts('plain', 'applies all configs'),
        SKIPPED,
        r('cfg1', CONFIG, PROD, 'bad', 'from Program', 'bad'),
        r('cfg2', CONFIG, TEST, 'bad', 'from the test', 'bad'),
      ],
    },
    line: L.TEST,
    bad: true,
    output: [{ label: 'Using ShopDb', text: 'fails: two providers (EF Core 9+)', kind: 'bad' }],
  },
} satisfies Record<string, TableStep>

/** The test's registrations after the fix. */
const FIXED = [ctx(), testOpts('new'), r('tcfg', CONFIG, TEST, 'new')]

const SPECS: Record<string, TableSpec> = {
  setup: {
    tables: [CALLS],
    code: CODE,
    outputName: 'Outcome',
    steps: {
      app: { tables: { calls: [APP_CALL] }, line: L.PROGRAM, output: out('…') },
      test: { tables: { calls: [APP_CALL, TEST_CALL] }, line: L.TEST, output: out('…') },
      outcome: {
        tables: { calls: [APP_CALL, TEST_CALL] },
        line: L.TEST,
        output: [
          { label: 'Result', text: 'production DB, or startup fails', kind: 'bad' },
          { label: 'Why', text: '?', kind: 'muted' },
        ],
      },
    },
  },
  register: spec(R),
  fix: spec(
    {
      remove: {
        tables: { sc: [ctx(), appOpts('skip', 'removed', 'ok'), r('cfg1', CONFIG, PROD, 'skip', 'removed (EF Core 9+)', 'ok')] },
        line: L.FIX_REMOVE,
        output: out('…'),
      },
      add: { tables: { sc: FIXED }, line: L.FIX_ADD, output: out('test (Npgsql)', 'ok') },
    },
    FIX_CODE,
  ),

  'order-claim': spec({
    order: { tables: { sc: [testOpts('new')] }, line: L.TEST, bad: true, output: out('…') },
    wins: { tables: { sc: [testOpts('skip', 'overridden', 'bad'), ctx(), appOpts('bad', 'wins', 'bad')] }, line: L.PROGRAM, bad: true, output: out('production', 'bad') },
  }),
  'order-reality': spec({
    order: { tables: { sc: [ctx(), appOpts(), testOpts('new', 'added last')] }, line: L.TEST, output: out('…') },
    wins: { tables: { sc: [ctx(), appOpts('hit', 'kept', 'ok'), SKIPPED] }, line: L.TEST, output: out('production', 'bad') },
  }),

  'singleton-claim': spec({
    lifetime: { tables: { sc: [ctx('Singleton', 'bad'), appOpts()] }, line: L.PROGRAM, bad: true, output: out('…') },
    instance: {
      tables: { sc: [ctx('Singleton', 'bad'), appOpts()] },
      chips: [chip('i0', 'one ShopDb from startup: SQL Server', 'bad')],
      line: L.PROGRAM,
      bad: true,
      output: out('production', 'bad'),
    },
  }),
  'singleton-reality': spec({
    lifetime: { tables: { sc: [ctx('Scoped', 'hit'), appOpts(), SKIPPED] }, line: L.PROGRAM, output: out('…') },
    instance: {
      tables: { sc: [ctx('Scoped'), appOpts('bad', 'still the app’s', 'bad'), SKIPPED] },
      chips: [chip('i1', 'request 1: new ShopDb'), chip('i2', 'request 2: new ShopDb')],
      line: L.PROGRAM,
      output: out('production', 'bad'),
    },
  }),

  'di-claim': spec({
    di: { tables: { sc: [ctx(), appOpts(), testOpts('skip', 'no effect', 'bad')] }, line: L.TEST, bad: true, output: out('production', 'bad') },
    env: {
      tables: { sc: [ctx(), appOpts(), testOpts('skip', 'no effect', 'bad')] },
      chips: [chip('env', 'env var: test connection string', 'bad')],
      line: L.TEST,
      bad: true,
      output: out('test, via the env var', 'bad'),
    },
  }),
  'di-reality': spec(
    {
      di: { tables: { sc: FIXED }, line: { each: [L.FIX_REMOVE, L.FIX_ADD] }, output: out('…') },
      env: { tables: { sc: FIXED }, chips: [chip('env', 'no env var needed', 'ok')], line: L.FIX_ADD, output: out('test (Npgsql)', 'ok') },
    },
    FIX_CODE,
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <TableStage spec={s} {...p} />]),
)
export default drawing
