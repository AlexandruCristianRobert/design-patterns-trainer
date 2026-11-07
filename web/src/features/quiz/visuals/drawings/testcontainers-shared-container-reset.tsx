import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const SETUP_CODE = [
  '[Fact] async Task A_saves_an_order() { … }',
  '[Fact] async Task B_sees_no_orders() { … }',
  '// … more tests',
]
const RESPAWN_CODE = [
  '// once, in the fixture',
  'await container.StartAsync();',
  'respawner = await Respawner.CreateAsync(conn,',
  '    new() { DbAdapter = DbAdapter.Postgres });',
  '',
  '// before each test',
  'await respawner.ResetAsync(conn);',
]
const R = { START: [1, 3] as [number, number], RESET: 6 }
const TX_CODE = [
  '// in each test',
  'await using var tx = await conn.BeginTransactionAsync();',
  'await SaveOrderAsync(conn, tx);  // the test\'s work',
  'await tx.RollbackAsync();',
]
const T = { BEGIN: 1, WORK: 2, ROLLBACK: 3 }
const PER_TEST_CODE = [
  'public OrderTests()',
  '{',
  '    _db = new PostgreSqlBuilder().Build();',
  '    _db.StartAsync().GetAwaiter().GetResult();',
  '}',
]
const P = { CTOR: [2, 3] as [number, number] }
const INMEMORY_CODE = [
  'var options = onCi',
  '    ? builder.UseNpgsql(container.GetConnectionString())',
  '    : builder.UseInMemoryDatabase("tests");',
]
const I = { CI: 1, LOCAL: 2 }
const ORDER_CODE = [
  '[Fact] async Task A_saves_an_order() { … }',
  '[Fact] async Task B_ships_that_order() { … }',
]

const DOCKER: RowDef = { id: 'docker', name: 'Docker', sub: 'PostgreSQL', tone: 'io' }
const ORDERS: RowDef = { id: 'db', name: 'orders table', sub: 'rows in the database', tone: 'pool' }
const TESTS: RowDef = { id: 'tests', name: 'Tests', sub: 'in run order', tone: 'ui' }
const STARTS: RowDef = { id: 'cost', name: 'Start-ups paid', sub: 'several seconds each', tone: 'muted' }
const ROWS = [TESTS, DOCKER, ORDERS, STARTS]

const c = (key: string, label: string, kind?: Chip['kind']): Chip => ({ key, label, kind })
const spec = (code: string[] | undefined, steps: Record<string, RowStep>, rows: RowDef[] = ROWS): RowSpec => ({ rows, code, steps })

const PG = c('pg', 'PostgreSQL: ready', 'ok')
/** The Setup: the situation only; how containers and data are handled is left open. */
const SETUP_ROWS: RowStep['rows'] = { tests: [c('a', 'A: saves an order', 'run'), c('b', 'B: expects no orders', 'run')], docker: [c('pg', '?', 'gone')], db: [c('q', '?', 'gone')] }
const START1 = c('s1', 'start-up', 'run')
const ORDER1 = c('o1', 'order 1', 'item')
const EMPTY = c('empty', 'empty', 'gone')
const A_OK = c('a', 'A ✓', 'ok')
const B_OK = c('b', 'B ✓', 'ok')
const RESET = c('reset', 'reset', 'run')

const SPECS: Record<string, RowSpec> = {
  setup: spec(
    SETUP_CODE,
    {
      tests: { rows: SETUP_ROWS, line: [0, 1] },
      startup: { rows: SETUP_ROWS, line: null },
      question: { rows: SETUP_ROWS, line: [0, 2] },
    },
    [TESTS, DOCKER, ORDERS],
  ),

  respawn: spec(RESPAWN_CODE, {
    fixture: { rows: { docker: [PG], db: [EMPTY], cost: [START1] }, line: R.START },
    'test-a': { rows: { tests: [A_OK], docker: [PG], db: [ORDER1], cost: [START1] }, line: null },
    reset: { rows: { tests: [A_OK, RESET], docker: [PG], db: [c('o1', 'order 1: deleted', 'gone')], cost: [START1] }, line: R.RESET },
    'test-b': { rows: { tests: [A_OK, RESET, B_OK], docker: [PG], db: [EMPTY], cost: [START1] }, line: null },
  }),
  rollback: spec(TX_CODE, {
    begin: { rows: { tests: [c('a', 'A: BEGIN', 'run')], docker: [PG], db: [EMPTY], cost: [START1] }, line: T.BEGIN },
    'test-a': { rows: { tests: [c('a', 'A: saves', 'run')], docker: [PG], db: [c('o1', 'order 1 (uncommitted)', 'wait')], cost: [START1] }, line: T.WORK },
    rollback: { rows: { tests: [c('a', 'A ✓ ROLLBACK', 'ok')], docker: [PG], db: [c('o1', 'order 1: rolled back', 'gone')], cost: [START1] }, line: T.ROLLBACK },
    'test-b': { rows: { tests: [c('a', 'A ✓ ROLLBACK', 'ok'), c('b', 'B ✓ ROLLBACK', 'ok')], docker: [PG], db: [EMPTY], cost: [START1] }, line: null },
  }),

  'per-test-claim': spec(PER_TEST_CODE, {
    'test-a': { rows: { tests: [c('a', 'A', 'run')], docker: [c('pa', 'container for A', 'ok')], cost: [c('s1', 'start-up', 'run')] }, line: P.CTOR },
    suite: {
      rows: { tests: [A_OK, B_OK, c('c', 'C ✓', 'ok')], docker: [c('pa', 'for A', 'ok'), c('pb', 'for B', 'ok'), c('pc', 'for C', 'ok')], db: [c('iso', 'isolated per test', 'ok')] },
      line: P.CTOR,
    },
  }),
  'per-test-reality': spec(PER_TEST_CODE, {
    'test-a': { rows: { tests: [c('a', 'A', 'run')], docker: [c('pa', 'container for A', 'ok')], cost: [c('s1', 'start-up', 'run')] }, line: P.CTOR },
    suite: {
      rows: {
        tests: [A_OK, B_OK, c('c', 'C ✓', 'ok'), c('more', '… every test', 'run')],
        docker: [c('pa', 'for A', 'ok'), c('pb', 'for B', 'ok'), c('pc', 'for C', 'ok'), c('pm', '…', 'item')],
        db: [c('iso', 'isolated per test', 'ok')],
        cost: [c('s1', 'start-up', 'run'), c('s2', 'start-up', 'run'), c('s3', 'start-up', 'run'), c('sm', 'one per test', 'bad')],
      },
      line: P.CTOR,
      bad: true,
    },
  }),

  'inmemory-claim': spec(
    INMEMORY_CODE,
    {
      local: { rows: { local: [c('a', 'A ✓ (InMemory)', 'ok')], docker: [c('none', 'none locally', 'gone')] }, line: I.LOCAL },
      ci: { rows: { local: [c('a', 'A ✓ (InMemory)', 'ok')], ci: [c('a', 'A ✓', 'ok'), c('iso', 'data isolated', 'ok')], docker: [c('pg', 'PostgreSQL on CI', 'ok')] }, line: I.CI },
    },
    [
      { id: 'local', name: 'Local run', sub: 'developer machine', tone: 'ui' },
      { id: 'ci', name: 'CI run', sub: 'build server', tone: 'ui' },
      DOCKER,
    ],
  ),
  'inmemory-reality': spec(
    INMEMORY_CODE,
    {
      local: { rows: { local: [c('a', 'A ✓ (InMemory: no SQL)', 'ok')], docker: [c('none', 'none locally', 'gone')] }, line: I.LOCAL },
      ci: {
        rows: {
          local: [c('a', 'A ✓ (InMemory: no SQL)', 'ok')],
          ci: [c('a', 'A may ✗ on PostgreSQL', 'bad'), c('iso', 'CI tests still share data', 'bad')],
          docker: [c('pg', 'PostgreSQL on CI', 'ok')],
        },
        line: I.CI,
        bad: true,
      },
    },
    [
      { id: 'local', name: 'Local run', sub: 'developer machine', tone: 'ui' },
      { id: 'ci', name: 'CI run', sub: 'build server', tone: 'ui' },
      DOCKER,
    ],
  ),

  'order-claim': spec(ORDER_CODE, {
    chain: { rows: { tests: [c('a', 'A: saves order 1', 'ok')], docker: [PG], db: [ORDER1], cost: [START1] }, line: 0 },
    run: { rows: { tests: [c('a', 'A: saves order 1', 'ok'), c('b', 'B: ships order 1 ✓', 'ok')], docker: [PG], db: [ORDER1], cost: [START1] }, line: [0, 1] },
  }),
  'order-reality': spec(ORDER_CODE, {
    chain: { rows: { tests: [c('a', 'A: saves order 1', 'ok')], docker: [PG], db: [ORDER1], cost: [START1] }, line: 0 },
    run: {
      rows: { tests: [c('b', 'B first: no order ✗', 'bad'), c('a', 'A: saves order 1', 'ok')], docker: [PG], db: [c('none', 'empty when B ran', 'gone')], cost: [START1] },
      line: 1,
      bad: true,
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
