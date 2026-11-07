import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const actors: SeqActor[] = [
  { id: 'client', name: 'Caller', sub: 'query string', tone: 'ui' },
  { id: 'api', name: 'Endpoint', sub: 'Dapper', tone: 'pool' },
  { id: 'db', name: 'SQL Server', tone: 'io' },
]

const ORIGINAL = [
  'app.MapGet("/products", (string sort, IDbConnection db) =>',
  '    db.Query<Product>($"SELECT * FROM Products ORDER BY {sort}"));',
]
const ALLOW = [
  'app.MapGet("/products", (string sort, IDbConnection db) =>',
  '{',
  '    var column = sort?.ToLowerInvariant() switch',
  '    {',
  '        "price" => "Price",',
  '        "name" => "Name",',
  '        _ => "Id",',
  '    };',
  '    return db.Query<Product>($"SELECT * FROM Products ORDER BY {column}");',
  '});',
]
const A = { MAP: [2, 7] as [number, number], PRICE: 4, DEFAULT: 6, QUERY: 8 }
const PARAM = [
  'app.MapGet("/products", (string sort, IDbConnection db) =>',
  '    db.Query<Product>("SELECT * FROM Products ORDER BY @sort", new { sort }));',
]
const QUOTES = [
  'app.MapGet("/products", (string sort, IDbConnection db) =>',
  '{',
  '    var escaped = sort.Replace("\'", "\'\'");',
  '    return db.Query<Product>($"SELECT * FROM Products ORDER BY {escaped}");',
  '});',
]
const LOGIN = ['// connection string: User Id=app_readonly (SELECT only)', ...ORIGINAL]

const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const spec = (code: string[], steps: Record<string, SeqStep>): SeqSpec => ({ actors, code, outputName: 'SQL Server', steps })

const PAYLOAD = 'Price; DROP TABLE Products'
const SELECT = 'SELECT * FROM Products ORDER BY'
const get = (sort: string, kind?: SeqRow['kind']) => msg('get', 'client', 'api', `?sort=${sort}`, kind)
const sql = (text: string, kind?: SeqRow['kind']) => msg('sql', 'api', 'db', text, kind)
const out = (text: string, result: string, kinds: [OutLine['kind']?, OutLine['kind']?] = []): OutLine[] => [
  { label: 'SQL text', text, kind: kinds[0] },
  { label: 'result', text: result, kind: result === '?' ? 'muted' : kinds[1] },
]

const SPECS: Record<string, SeqSpec> = {
  setup: spec(ORIGINAL, {
    normal: { rows: [get('Price'), sql('ORDER BY Price'), msg('rows', 'db', 'api', 'products by price')], line: 1, output: out(`${SELECT} Price`, 'sorted by price') },
    'any-text': { rows: [get('<any text>'), sql('ORDER BY <that text>')], line: 1, output: out(`${SELECT} <any text>`, '?') },
  }),

  hole: spec(ORIGINAL, {
    attack: { rows: [get(PAYLOAD, 'bad'), sql(`ORDER BY ${PAYLOAD}`, 'bad')], line: 1, bad: true, output: out(`${SELECT} ${PAYLOAD}`, '?', ['bad']) },
    runs: {
      rows: [get(PAYLOAD, 'bad'), sql(`ORDER BY ${PAYLOAD}`, 'bad'), note('one', 'db', '1: SELECT … ORDER BY Price'), note('two', 'db', '2: DROP TABLE Products', 'bad')],
      line: 1,
      bad: true,
      output: out(`${SELECT} ${PAYLOAD}`, 'two statements run', ['bad', 'bad']),
    },
  }),
  'allow-list': spec(ALLOW, {
    map: { rows: [note('map', 'api', 'price → Price, name → Name, anything else → Id')], line: A.MAP },
    known: {
      rows: [note('map', 'api', 'price → Price, name → Name, anything else → Id'), get('price'), sql('ORDER BY Price', 'ok')],
      line: A.PRICE,
      output: out(`${SELECT} Price`, 'sorted by price', ['ok', 'ok']),
    },
    attack: {
      rows: [note('map', 'api', 'price → Price, name → Name, anything else → Id'), get(PAYLOAD, 'bad'), note('unknown', 'api', 'not a known key: Id'), sql('ORDER BY Id', 'ok')],
      line: A.DEFAULT,
      output: out(`${SELECT} Id`, 'sorted by Id, nothing injected', ['ok', 'ok']),
    },
  }),

  'param-claim': spec(PARAM, {
    param: { rows: [get('Price'), sql('ORDER BY @sort  (@sort = Price)')], line: 1 },
    safe: { rows: [get('Price'), sql('ORDER BY @sort  (@sort = Price)'), note('fixed', 'api', 'any input is safe now')], line: 1, output: out(`${SELECT} @sort`, '?') },
  }),
  'param-reality': spec(PARAM, {
    value: { rows: [get('Price'), sql('ORDER BY @sort  (@sort = Price)'), note('value', 'db', "@sort = N'Price': a value, not a column", 'bad')], line: 1 },
    rejected: {
      rows: [get('Price'), sql('ORDER BY @sort  (@sort = Price)'), note('value', 'db', "@sort = N'Price': a value, not a column", 'bad'), msg('err', 'db', 'api', 'rejected: a variable alone in ORDER BY', 'bad')],
      line: 1,
      bad: true,
      output: out(`${SELECT} @sort`, 'rejected, never sorted by Price', [undefined, 'bad']),
    },
  }),

  'quotes-claim': spec(QUOTES, {
    double: { rows: [get('<any text>'), note('esc', 'api', "every ' becomes ''")], line: 2 },
    safe: { rows: [get('<any text>'), note('esc', 'api', "every ' becomes ''"), note('safe', 'api', 'cannot break out of the SQL')], line: [2, 3] },
  }),
  'quotes-reality': spec(QUOTES, {
    'no-quotes': { rows: [get(PAYLOAD, 'bad'), note('esc', 'api', 'no quote to double: unchanged', 'bad')], line: 2, bad: true },
    runs: {
      rows: [get(PAYLOAD, 'bad'), note('esc', 'api', 'no quote to double: unchanged', 'bad'), sql(`ORDER BY ${PAYLOAD}`, 'bad'), note('two', 'db', '2: DROP TABLE Products', 'bad')],
      line: 3,
      bad: true,
      output: out(`${SELECT} ${PAYLOAD}`, 'two statements run', ['bad', 'bad']),
    },
  }),

  'login-claim': spec(LOGIN, {
    login: { rows: [note('login', 'db', 'login: SELECT only')], line: 0 },
    harmless: { rows: [note('login', 'db', 'login: SELECT only'), get('<injected SQL>'), sql('ORDER BY <injected SQL>'), note('safe', 'db', 'no damage')], line: [0, 2] },
  }),
  'login-reality': spec(LOGIN, {
    'drop-denied': {
      rows: [note('login', 'db', 'login: SELECT only'), get(PAYLOAD, 'bad'), sql(`ORDER BY ${PAYLOAD}`, 'bad'), note('denied', 'db', 'DROP TABLE: permission denied', 'ok')],
      line: 2,
      bad: true,
      output: out(`${SELECT} ${PAYLOAD}`, 'DROP denied, injection still there', [undefined, 'bad']),
    },
    read: {
      rows: [
        note('login', 'db', 'login: SELECT only'),
        get('CASE WHEN (SELECT … FROM Users …) THEN Price ELSE Id END', 'bad'),
        sql('ORDER BY CASE WHEN (SELECT … FROM Users …) …', 'bad'),
        msg('rows', 'db', 'client', 'sorted by Price: the answer is yes', 'bad'),
      ],
      line: 2,
      bad: true,
      output: out(`${SELECT} CASE WHEN (SELECT … FROM Users …) …`, 'Users read one answer at a time', [undefined, 'bad']),
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
