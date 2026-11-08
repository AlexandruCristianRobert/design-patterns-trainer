import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'static bool IsVip(Customer c) { … }',
  '',
  'var vips = await db.Customers.Where(c => IsVip(c)).ToListAsync();',
]
const L = { METHOD: 0, QUERY: 2 }
const FIX_CODE = [
  '// 1. a filter EF Core can translate',
  'var vips = await db.Customers.Where(c => c.Spent > 10_000).ToListAsync();',
  '',
  '// 2. a C# method only in the final Select',
  'var flags = await db.Customers',
  '    .Select(c => new { c.Name, Vip = IsVip(c) }).ToListAsync();',
  '',
  '// 3. in memory, on purpose',
  'var vips = db.Customers.AsEnumerable().Where(c => IsVip(c)).ToList();',
]

const actors: SeqSpec['actors'] = [
  { id: 'app', name: 'Your code', tone: 'ui' },
  { id: 'ef', name: 'EF Core', sub: 'query pipeline', tone: 'pool' },
  { id: 'db', name: 'Database', tone: 'io' },
]
const spec = (steps: Record<string, SeqStep>, code: string[] | null = CODE): SeqSpec => ({ actors, code: code ?? undefined, outputName: 'Result', steps })

const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind'], both = false): SeqRow => ({ key, from, to, label, kind, both })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })

const METHOD = note('method', 'app', 'IsVip(c): plain C#')
const QUERY = msg('query', 'app', 'ef', 'Where(c => IsVip(c))')
const NO_SQL = note('nosql', 'ef', 'IsVip: no SQL', 'bad')
const NOT_SENT = note('sent', 'db', 'no query sent', 'muted')
const THROWS = msg('throws', 'ef', 'app', 'throws', 'bad')
const IOE: OutLine[] = [
  { label: 'Exception', text: 'InvalidOperationException', kind: 'bad' },
  { label: 'Message', text: 'The LINQ expression … could not be translated.', kind: 'bad' },
]
const FAILED = { rows: [QUERY, NO_SQL, NOT_SENT, THROWS], line: L.QUERY, output: IOE } satisfies SeqStep

const ALL_ROWS = msg('sql', 'ef', 'db', 'SELECT … FROM Customers', undefined, true)

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    method: { rows: [METHOD], line: L.METHOD },
    run: { rows: [METHOD, QUERY], line: L.QUERY },
  }),

  where: spec({
    tree: { rows: [QUERY], line: L.QUERY },
    'no-sql': { rows: [QUERY, NO_SQL], line: L.QUERY },
    throws: FAILED,
  }),
  fixes: spec(
    {
      translate: {
        rows: [msg('query', 'app', 'ef', 'Where(c => c.Spent > 10000)'), msg('sql', 'ef', 'db', 'SELECT … WHERE Spent > 10000', 'ok', true)],
        line: 1,
      },
      projection: {
        rows: [msg('query', 'app', 'ef', 'Select(c => new { …, IsVip(c) })'), ALL_ROWS, note('client', 'ef', 'IsVip per row', 'ok')],
        line: [4, 5],
      },
      'as-enumerable': {
        rows: [msg('query', 'app', 'ef', 'no filter'), ALL_ROWS, note('client', 'app', 'IsVip in memory', 'ok')],
        line: 8,
      },
    },
    FIX_CODE,
  ),

  'memory-claim': spec({
    sql: { rows: [QUERY, ALL_ROWS], line: L.QUERY },
    filter: { rows: [QUERY, ALL_ROWS, note('client', 'ef', 'IsVip per row')], line: L.QUERY },
    warn: { rows: [QUERY, ALL_ROWS, note('client', 'ef', 'IsVip per row'), note('warn', 'ef', 'warning logged')], line: L.QUERY },
  }),
  'memory-reality': spec({
    sql: { rows: [QUERY, NO_SQL, NOT_SENT], line: L.QUERY },
    throws: FAILED,
  }),

  'udf-claim': spec({
    sql: { rows: [QUERY, msg('sql', 'ef', 'db', 'SELECT … WHERE IsVip(…)', undefined, true)], line: L.QUERY },
    exists: { rows: [QUERY, msg('sql', 'ef', 'db', 'SELECT … WHERE IsVip(…)', undefined, true), note('fn', 'db', 'function IsVip')], line: L.QUERY },
  }),
  'udf-reality': spec({
    mapped: { rows: [QUERY, note('nosql', 'ef', 'IsVip: not mapped', 'bad')], line: L.QUERY },
    throws: { rows: [QUERY, note('nosql', 'ef', 'IsVip: not mapped', 'bad'), NOT_SENT, THROWS], line: L.QUERY, output: IOE },
  }),

  'deferred-claim': spec({
    sql: { rows: [QUERY, ALL_ROWS], line: L.QUERY },
    lazy: { rows: [QUERY, ALL_ROWS, note('client', 'app', 'IsVip per row, lazily')], line: L.QUERY },
  }),
  'deferred-reality': spec({
    sql: { rows: [QUERY, NO_SQL, NOT_SENT], line: L.QUERY },
    throws: FAILED,
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
