import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'var options = new DbContextOptionsBuilder<AppDb>()',
  '    .UseSqlite("Data Source=:memory:").Options;',
  'using var db = new AppDb(options);',
  'db.Database.EnsureCreated();',
  'var orders = db.Orders.ToList();',
]
const L = { CONFIG: [0, 1] as [number, number], CREATE: 3, QUERY: 4 }
const FIX_CODE = [
  'using var conn = new SqliteConnection("Data Source=:memory:");',
  'conn.Open();',
  'var options = new DbContextOptionsBuilder<AppDb>()',
  '    .UseSqlite(conn).Options;',
  'using var db = new AppDb(options);',
  'db.Database.EnsureCreated();',
  'var orders = db.Orders.ToList();',
]
const F = { OPEN: [0, 3] as [number, number], CREATE: 5, QUERY: 6 }

const TEST: SeqActor = { id: 'test', name: 'Test', tone: 'ui' }
const EF: SeqActor = { id: 'ef', name: 'EF Core', tone: 'pool' }
const SQLITE: SeqActor = { id: 'db', name: 'SQLite', sub: ':memory:', tone: 'io' }

const spec = (steps: Record<string, SeqStep>, code = CODE, actors = [TEST, EF, SQLITE]): SeqSpec => ({ actors, code, outputName: 'Outcome', steps })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const result = (text: string, kind?: 'plain' | 'ok' | 'bad' | 'muted') => [{ label: 'Query', text, kind }]

// ---- Reality: one database per operation ----
const ensure = msg('ensure', 'test', 'ef', 'EnsureCreated')
const open1 = msg('open1', 'ef', 'db', 'open conn 1')
const db1 = (label: string, kind?: SeqRow['kind']) => note('db1', 'db', label, kind)
const create = msg('create', 'ef', 'db', 'CREATE TABLE')
const close1 = msg('close1', 'ef', 'db', 'close conn 1')
const query = msg('query', 'test', 'ef', 'ToList()')
const open2 = msg('open2', 'ef', 'db', 'open conn 2')
const db2 = note('db2', 'db', 'db 2: empty')
const noTable = msg('none', 'db', 'ef', 'no such table', 'bad')

const OPENED = [ensure, open1, db1('db 1: empty')]
const CREATED = [ensure, open1, create, db1('db 1: table', 'ok')]
const CLOSED = [ensure, open1, create, close1, db1('db 1: gone', 'bad')]
const QUERIED = [...CLOSED, query, open2, db2, noTable]

// ---- Claims: the call as the test sees it ----
const plainCreate = [ensure, create, msg('ok', 'ef', 'test', 'ok')]

const SPECS: Record<string, SeqSpec> = {
  setup: spec(
    {
      configure: { rows: [note('cfg', 'test', 'UseSqlite(:memory:)')], line: L.CONFIG },
      create: { rows: [note('cfg', 'test', 'UseSqlite(:memory:)'), ensure, msg('ok', 'ef', 'test', 'ok')], line: L.CREATE },
      query: {
        rows: [note('cfg', 'test', 'UseSqlite(:memory:)'), ensure, msg('ok', 'ef', 'test', 'ok'), query, msg('fail', 'ef', 'test', 'no such table')],
        line: L.QUERY,
        output: result('no such table: Orders'),
      },
    },
    CODE,
    [TEST, EF],
  ),
  'per-operation': spec({
    open: { rows: OPENED, line: L.CREATE },
    create: { rows: CREATED, line: L.CREATE },
    close: { rows: CLOSED, line: L.CREATE },
    query: { rows: QUERIED, line: L.QUERY, bad: true, output: result('no such table: Orders', 'bad') },
  }),
  'kept-open': spec(
    {
      open: { rows: [msg('open1', 'test', 'db', 'open conn 1'), db1('db 1: empty')], line: F.OPEN },
      create: {
        rows: [msg('open1', 'test', 'db', 'open conn 1'), ensure, msg('create', 'ef', 'db', 'CREATE TABLE'), db1('db 1: table', 'ok'), note('stays', 'ef', 'conn 1 open', 'ok')],
        line: F.CREATE,
      },
      query: {
        rows: [
          msg('open1', 'test', 'db', 'open conn 1'),
          ensure,
          msg('create', 'ef', 'db', 'CREATE TABLE'),
          db1('db 1: table', 'ok'),
          note('stays', 'ef', 'conn 1 open', 'ok'),
          query,
          msg('select', 'ef', 'db', 'SELECT'),
          msg('rows', 'db', 'ef', 'Orders found', 'ok'),
        ],
        line: F.QUERY,
        output: result('works', 'ok'),
      },
    },
    FIX_CODE,
  ),

  'lazy-claim': spec({
    create: { rows: [ensure, note('later', 'ef', 'tables later', 'bad'), msg('ok', 'ef', 'test', 'ok')], line: L.CREATE, bad: true },
    query: {
      rows: [ensure, note('later', 'ef', 'tables later', 'bad'), msg('ok', 'ef', 'test', 'ok'), query, note('nolazy', 'db', 'no lazy', 'bad'), msg('none', 'db', 'ef', 'no such table')],
      line: L.QUERY,
      output: result('no such table: Orders'),
    },
  }),
  'lazy-reality': spec({
    create: { rows: CREATED, line: L.CREATE },
    query: { rows: QUERIED, line: L.QUERY, bad: true, output: result('no such table: Orders', 'bad') },
  }),

  'readonly-claim': spec({
    create: { rows: plainCreate, line: L.CREATE },
    readonly: { rows: [...plainCreate, note('ro', 'db', 'read-only', 'bad')], line: L.CREATE },
    migrations: { rows: [...plainCreate, note('ro', 'db', 'read-only', 'bad'), note('mig', 'test', 'migrations', 'bad')], line: L.CREATE },
  }),
  'readonly-reality': spec({
    create: { rows: plainCreate, line: L.CREATE },
    readonly: { rows: [...plainCreate, note('ro', 'db', 'writable', 'ok')], line: L.CREATE },
    migrations: {
      rows: [...plainCreate, note('ro', 'db', 'writable', 'ok'), close1, db1('db 1: gone', 'bad')],
      line: L.QUERY,
      bad: true,
      output: result('no such table: Orders', 'bad'),
    },
  }),

  'thread-claim': spec({
    create: { rows: plainCreate, line: L.CREATE },
    thread: { rows: [...plainCreate, msg('query', 'test', 'ef', 'on thread 2')], line: L.QUERY },
    query: {
      rows: [...plainCreate, msg('query', 'test', 'ef', 'on thread 2'), note('owner', 'db', 'thread 1 only', 'bad'), msg('none', 'db', 'ef', 'no such table')],
      line: L.QUERY,
      output: result('no such table: Orders'),
    },
  }),
  'thread-reality': spec({
    create: { rows: plainCreate, line: L.CREATE },
    thread: { rows: [...plainCreate, close1, db1('db 1: gone', 'bad')], line: L.CREATE },
    query: {
      rows: [...plainCreate, close1, db1('db 1: gone', 'bad'), msg('query', 'test', 'ef', 'any thread'), open2, db2, noTable],
      line: L.QUERY,
      bad: true,
      output: result('no such table: Orders', 'bad'),
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
