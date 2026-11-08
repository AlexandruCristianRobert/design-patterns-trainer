import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const REPO: SeqActor = { id: 'repo', name: 'Repository', tone: 'ui' }
const MOCK_PROV: SeqActor = { id: 'prov', name: 'Provider', sub: 'LINQ to Objects', tone: 'pool' }
const EF_PROV: SeqActor = { id: 'prov', name: 'Provider', sub: 'EF Core', tone: 'pool' }
const LIST: SeqActor = { id: 'data', name: 'Data', sub: 'List<Order>', tone: 'io' }
const SQL: SeqActor = { id: 'data', name: 'Data', sub: 'SQL Server', tone: 'io' }
const ORDERS: SeqActor = { id: 'set', name: 'db.Orders', tone: 'pool' }

const query = (method: string) => [
  'var rush = await db.Orders',
  '    .Where(o => Rules.IsRush(o))   // an ordinary C# method',
  `    .${method}();`,
  '',
  '// Rules.IsRush(Order o) => o.Notes.Contains("rush")',
]
const CODE = query('ToListAsync')
const SYNC_CODE = ['var rush = db.Orders', '    .Where(o => Rules.IsRush(o))', '    .ToList();']
const L = { WHERE: 1, RUN: 2 }

const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const spec = (actors: SeqActor[], steps: Record<string, SeqStep>, code: string[] | null = CODE, outputName = 'Test run'): SeqSpec => ({ actors, code: code ?? undefined, outputName, steps })
type K = OutLine['kind']
const out = (lines: [string, string, K?][]): OutLine[] => lines.map(([label, text, kind]) => ({ label, text, kind: text === '?' ? 'muted' : kind }))

const tree = msg('tree', 'repo', 'prov', 'Where(o => IsRush(o))')
// ---- Mocked ----
const inMem = note('inmem', 'prov', 'the list as an in-memory IQueryable')
const compiled = note('comp', 'prov', 'tree → delegates', 'ok')
const noSql = msg('nosql', 'prov', 'data', 'no SQL, no translation', 'skip')
const calls = msg('calls', 'prov', 'data', 'IsRush(o) on each order', 'ok')
const matches = msg('match', 'prov', 'repo', 'matching orders')
const MOCK_RUN = [tree, inMem, compiled, noSql, calls, matches]
const PASS = out([['Translation', 'never tried', 'bad'], ['Test', 'passes', 'bad']])
// ---- Real ----
const toSql = note('tosql', 'prov', 'translate the tree to SQL')
const noMap = note('nomap', 'prov', 'IsRush: no SQL for it', 'bad')
const thrown = msg('throw', 'prov', 'repo', 'throws: could not be translated', 'bad')
const unsent = msg('unsent', 'prov', 'data', 'no SQL sent', 'skip')
const REAL_FAIL = [tree, toSql, noMap, unsent, thrown]

const SPECS: Record<string, SeqSpec> = {
  setup: spec(
    [REPO, ORDERS],
    {
      test: {
        rows: [note('t', 'repo', 'in the tests'), note('mock', 'set', 'mocked DbSet<Order> over a List<Order>'), msg('q1', 'repo', 'set', 'the query'), note('pass', 'repo', 'tests pass')],
      },
      prod: {
        rows: [
          note('t', 'repo', 'in the tests'),
          note('mock', 'set', 'mocked DbSet<Order> over a List<Order>'),
          msg('q1', 'repo', 'set', 'the query'),
          note('pass', 'repo', 'tests pass'),
          note('p', 'repo', 'in production'),
          note('real', 'set', 'the real DbSet<Order>, over the database'),
          msg('q2', 'repo', 'set', 'the same query'),
          note('fail', 'repo', 'throws: could not be translated'),
          note('why', 'set', 'why missed: ?', 'muted'),
        ],
      },
    },
    null,
  ),
  mocked: spec([REPO, MOCK_PROV, LIST], {
    expr: { rows: [tree, inMem], line: L.WHERE, output: out([['Translation', '?'], ['Test', '?']]) },
    compile: { rows: [tree, inMem, compiled, noSql], line: L.WHERE, output: out([['Translation', 'never tried', 'bad'], ['Test', '?']]) },
    run: { rows: MOCK_RUN, line: L.RUN, output: PASS },
  }),
  real: spec(
    [REPO, EF_PROV, SQL],
    {
      translate: { rows: [tree, toSql], line: L.WHERE, output: out([['Translation', '?'], ['Query', '?']]) },
      fail: { rows: REAL_FAIL, line: L.WHERE, bad: true, output: out([['Translation', 'fails', 'ok'], ['Query', 'throws, no SQL sent', 'ok']]) },
      better: {
        rows: [note('tc', 'data', 'test database in a container', 'ok'), ...REAL_FAIL],
        line: L.WHERE,
        bad: true,
        output: out([['Translation', 'fails in the test too', 'ok'], ['Test', 'fails, and catches it', 'ok']]),
      },
    },
    CODE,
    'Run',
  ),

  'async-claim': spec(
    [REPO, ORDERS],
    {
      sync: { rows: [note('mock', 'set', 'mocked DbSet<Order>'), msg('q', 'repo', 'set', 'the query'), msg('r', 'set', 'repo', 'results, synchronously')], output: out([['Error appears with', '?']]) },
      async: {
        rows: [
          note('mock', 'set', 'mocked DbSet<Order>'),
          msg('q', 'repo', 'set', 'the query'),
          msg('r', 'set', 'repo', 'results, synchronously'),
          note('only', 'repo', 'translation error: only with ToListAsync'),
        ],
        output: out([['Error appears with', 'async query methods only']]),
      },
    },
    null,
    'The claim',
  ),
  'async-reality': spec(
    [REPO, EF_PROV, SQL],
    {
      sync: { rows: [msg('tree', 'repo', 'prov', 'query, ToList()'), toSql, noMap, unsent, thrown], line: [1, 2], bad: true, code: SYNC_CODE, output: out([['Real provider, ToList()', 'throws', 'ok'], ['Mocked set', '?']]) },
      mock: {
        rows: [msg('tree', 'repo', 'prov', 'query, ToList()'), toSql, noMap, unsent, thrown, note('mock', 'repo', 'mocked set: passes, sync or async', 'bad')],
        line: [1, 2],
        bad: true,
        code: SYNC_CODE,
        output: out([['Real provider, ToList()', 'throws', 'ok'], ['Mocked set', 'passes, sync or async', 'bad']]),
      },
    },
    CODE,
    'Run',
  ),

  'ensure-claim': spec(
    [REPO, ORDERS],
    {
      skip: { rows: [note('mock', 'set', 'mocked DbSet<Order>'), note('no', 'repo', 'EnsureCreated: not called')], output: out([['Queries validated', '?']]) },
      validate: {
        rows: [note('mock', 'set', 'mocked DbSet<Order>'), note('no', 'repo', 'EnsureCreated: not called'), note('val', 'set', 'query check against the schema: skipped')],
        output: out([['Queries validated', 'no, EnsureCreated was skipped']]),
      },
    },
    null,
    'The claim',
  ),
  'ensure-reality': spec(
    [REPO, MOCK_PROV, LIST],
    {
      creates: {
        rows: [note('ec', 'repo', 'EnsureCreated(): creates tables in a real database', 'ok'), note('nq', 'repo', 'queries: never inspected', 'ok')],
        line: null,
        output: out([['EnsureCreated does', 'create the schema', 'ok'], ['Test', '?']]),
      },
      mock: { rows: [note('nodb', 'data', 'mocked set: no database', 'ok'), ...MOCK_RUN], line: L.RUN, output: out([['EnsureCreated does', 'create the schema', 'ok'], ['Test', 'passes either way', 'bad']]) },
    },
  ),

  'data-claim': spec(
    [REPO, ORDERS],
    {
      depends: { rows: [note('dep', 'set', 'some rows trigger the error')], output: out([['Error', 'depends on the rows']]) },
      missing: {
        rows: [note('dep', 'set', 'some rows trigger the error'), note('list', 'set', 'test list: no such rows'), msg('q', 'repo', 'set', 'the query'), note('pass', 'repo', 'passes')],
        output: out([['Error', 'depends on the rows'], ['Test list', 'lacks those rows']]),
      },
    },
    null,
    'The claim',
  ),
  'data-reality': spec(
    [REPO, EF_PROV, SQL],
    {
      empty: { rows: [note('empty', 'data', 'Orders table: empty'), ...REAL_FAIL], line: L.WHERE, bad: true, output: out([['Rows read', 'none'], ['Query', 'throws anyway', 'ok']]) },
      any: {
        rows: [note('empty', 'data', 'Orders table: empty'), ...REAL_FAIL, note('mockany', 'repo', 'mocked list: passes with any rows', 'bad')],
        line: L.WHERE,
        bad: true,
        output: out([['Rows read', 'none'], ['Query', 'throws anyway', 'ok'], ['Mocked list', 'passes with any rows', 'bad']]),
      },
    },
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
