import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const actors: SeqActor[] = [
  { id: 'app', name: 'Your code', tone: 'ui' },
  { id: 'ef', name: 'EF Core', sub: 'query provider', tone: 'pool' },
  { id: 'db', name: 'Database', sub: 'Orders table', tone: 'io' },
]
const CODE = ['IEnumerable<Order> orders = db.Orders;', '', 'var big = orders.Where(o => o.Total > 1000).ToList();']
const FIX = ['IQueryable<Order> orders = db.Orders;', '', 'var big = orders.Where(o => o.Total > 1000).ToList();']
const L = { ASSIGN: 0, CALL: 2 }

const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const spec = (steps: Record<string, SeqStep>, code = CODE): SeqSpec => ({ actors, code, outputName: 'The query', steps })

type K = OutLine['kind']
const query = (where = '?', sql = '?', filter = '?', kinds: [K?, K?, K?] = []): OutLine[] => [
  { label: 'Where', text: where, kind: where === '?' ? 'muted' : kinds[0] },
  { label: 'SQL', text: sql, kind: sql === '?' ? 'muted' : kinds[1] },
  { label: 'Filter runs', text: filter, kind: filter === '?' ? 'muted' : kinds[2] },
]

const ENUM = 'Enumerable.Where(Func)'
const NO_WHERE = 'SELECT … FROM Orders'
const WITH_WHERE = 'SELECT … FROM Orders WHERE Total > 1000'
const SQL_WHERE = 'SELECT … WHERE Total > 1000'

const objects = [note('var', 'app', 'orders: IEnumerable<Order>'), note('obj', 'ef', 'db.Orders: an IQueryable<Order>')]
const bindEnum = note('bind', 'app', `compiler binds ${ENUM}`)
const plainRun = [msg('enum', 'app', 'ef', 'enumerate orders'), msg('sql', 'ef', 'db', NO_WHERE)]
const allRows = [msg('rows', 'db', 'ef', 'every order'), msg('objs', 'ef', 'app', 'an Order object per row')]
const inMemory = note('filter', 'app', 'the Func filters each order', 'bad')
const MEMORY_OUT = query(ENUM, NO_WHERE, 'in memory, after reading every order', [undefined, 'bad', 'bad'])

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    assign: { rows: objects, line: L.ASSIGN, output: query() },
    filter: { rows: [...objects, note('call', 'app', 'orders.Where(…).ToList()')], line: L.CALL, output: query() },
  }),
  'in-memory': spec({
    bind: { rows: [...objects, bindEnum], line: L.CALL, output: query(ENUM) },
    query: { rows: [...objects, bindEnum, ...plainRun], line: L.CALL, output: query(ENUM, NO_WHERE, '?', [undefined, 'bad']) },
    rows: { rows: [...objects, bindEnum, ...plainRun, ...allRows], line: L.CALL, output: query(ENUM, NO_WHERE, '?', [undefined, 'bad']) },
    filter: { rows: [...objects, bindEnum, ...plainRun, ...allRows, inMemory], line: L.CALL, bad: true, output: MEMORY_OUT },
  }),
  'in-database': spec(
    {
      bind: { rows: [note('bind', 'app', 'compiler binds Queryable.Where(Expression)', 'ok')], line: { each: [L.ASSIGN, L.CALL] }, output: query('Queryable.Where(Expression)') },
      translate: {
        rows: [note('bind', 'app', 'compiler binds Queryable.Where(Expression)', 'ok'), msg('tree', 'app', 'ef', 'expression tree'), msg('sql', 'ef', 'db', SQL_WHERE, 'ok')],
        line: L.CALL,
        output: query('Queryable.Where(Expression)', WITH_WHERE, '?', [undefined, 'ok']),
      },
      rows: {
        rows: [
          note('bind', 'app', 'compiler binds Queryable.Where(Expression)', 'ok'),
          msg('tree', 'app', 'ef', 'expression tree'),
          msg('sql', 'ef', 'db', SQL_WHERE, 'ok'),
          msg('rows', 'db', 'ef', 'matching orders only', 'ok'),
          msg('objs', 'ef', 'app', 'an Order object per match'),
        ],
        line: L.CALL,
        output: query('Queryable.Where(Expression)', WITH_WHERE, 'in the database', [undefined, 'ok', 'ok']),
      },
    },
    FIX,
  ),

  'runtime-claim': spec({
    dispatch: { rows: [...objects, note('rt', 'app', 'run time: IQueryable, so Queryable.Where')], line: L.CALL, output: query('Queryable.Where') },
    sql: {
      rows: [...objects, note('rt', 'app', 'run time: IQueryable, so Queryable.Where'), msg('sql', 'ef', 'db', SQL_WHERE)],
      line: L.CALL,
      output: query('Queryable.Where', WITH_WHERE, 'in the database'),
    },
  }),
  'runtime-reality': spec({
    bind: { rows: [...objects, note('bind', 'app', `compiled call: ${ENUM}`, 'bad')], line: L.CALL, output: query(ENUM, '?', '?', ['bad']) },
    sql: { rows: [...objects, note('bind', 'app', `compiled call: ${ENUM}`, 'bad'), ...plainRun, ...allRows, inMemory], line: L.CALL, bad: true, output: MEMORY_OUT },
  }),

  'tree-claim': spec({
    convert: { rows: [...objects, bindEnum, note('tree', 'app', 'lambda becomes a tree')], line: L.CALL, output: query(ENUM) },
    sql: {
      rows: [...objects, bindEnum, note('tree', 'app', 'lambda becomes a tree'), msg('send', 'app', 'ef', 'expression tree'), msg('sql', 'ef', 'db', SQL_WHERE)],
      line: L.CALL,
      output: query(ENUM, WITH_WHERE, 'in the database'),
    },
  }),
  'tree-reality': spec({
    func: { rows: [...objects, bindEnum, note('func', 'app', 'gets a Func: compiled code', 'bad')], line: L.CALL, output: query(ENUM) },
    sql: { rows: [...objects, bindEnum, note('func', 'app', 'gets a Func: compiled code', 'bad'), ...plainRun, ...allRows, inMemory], line: L.CALL, bad: true, output: MEMORY_OUT },
  }),

  'cast-claim': spec({
    assign: { rows: [...objects, note('cast', 'app', 'assignment throws InvalidCastException')], line: L.ASSIGN, output: query() },
    nothing: { rows: [...objects, note('cast', 'app', 'assignment throws InvalidCastException'), note('none', 'ef', 'no query runs')], line: L.ASSIGN, output: query('not reached', 'none', 'nowhere') },
  }),
  'cast-reality': spec({
    inherits: { rows: [...objects, note('conv', 'app', 'IQueryable<T> is an IEnumerable<T>', 'ok')], line: L.ASSIGN, output: query() },
    runs: { rows: [...objects, note('conv', 'app', 'IQueryable<T> is an IEnumerable<T>', 'ok'), bindEnum, ...plainRun, ...allRows, inMemory], line: L.CALL, bad: true, output: MEMORY_OUT },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
