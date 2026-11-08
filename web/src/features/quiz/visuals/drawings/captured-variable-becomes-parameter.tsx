import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const actors: SeqActor[] = [
  { id: 'job', name: 'Batch job', tone: 'ui' },
  { id: 'ef', name: 'EF Core', tone: 'pool' },
  { id: 'db', name: 'SQL Server', tone: 'io' },
]
const CODE = ['Task<List<Order>> ForCustomer(int customerId) =>', '    db.Orders.Where(o => o.CustomerId == customerId).ToListAsync();']
const L = { SIG: 0, WHERE: 1 }

const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const spec = (steps: Record<string, SeqStep>, code: string[] | null = CODE): SeqSpec => ({ actors, code: code ?? undefined, outputName: 'Across the calls', steps })

type K = OutLine['kind']
const out = (lines: [string, string, K?][]): OutLine[] => lines.map(([label, text, kind]) => ({ label, text, kind: text === '?' ? 'muted' : kind }))

const call17 = msg('c17', 'job', 'ef', 'ForCustomer(17)')
const call42 = msg('c42', 'job', 'ef', 'ForCustomer(42)')
const more = msg('more', 'job', 'ef', '… 498 more ids', 'muted')

// ---- Reality ----
const capture = note('cap', 'ef', 'tree reads a captured variable')
const asParam = note('param', 'ef', 'it becomes a SQL parameter', 'ok')
const translate = note('tr', 'ef', 'translate, cache it')
const sql17 = msg('s17', 'ef', 'db', 'sp_executesql, @customerId = 17', 'ok')
const compile = note('comp', 'db', 'compile plan, cache it')
const hit = note('hit', 'ef', 'cache hit')
const sql42 = msg('s42', 'ef', 'db', 'same text, @customerId = 42', 'ok')
const reuse = note('reuse', 'db', 'plan cache hit: reused', 'ok')
const FIRST = [capture, asParam, call17, translate, sql17, compile]
const SECOND = [...FIRST, call42, hit, sql42, reuse]

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    first: { rows: [call17, note('q1', 'ef', 'SQL: ?', 'muted')], line: L.WHERE },
    calls: { rows: [call17, call42, more, note('q1', 'ef', 'SQL across the calls: ?', 'muted')], line: L.WHERE },
  }),
  parameter: spec({
    capture: { rows: [capture, asParam], line: L.WHERE },
    first: { rows: FIRST, line: L.WHERE, output: out([['SQL texts', '1'], ['EF Core query cache', '1 entry'], ['Plan cache', '1 plan']]) },
    second: { rows: SECOND, line: L.WHERE, output: out([['SQL texts', '1', 'ok'], ['EF Core query cache', '1 entry', 'ok'], ['Plan cache', '1 plan, reused', 'ok']]) },
    all: {
      rows: [...SECOND, more, note('all', 'db', '500 runs, 1 plan', 'ok')],
      line: L.WHERE,
      output: out([['SQL texts', '1', 'ok'], ['EF Core query cache', '1 entry', 'ok'], ['Plan cache', '1 plan, reused 499 times', 'ok'], ['Round trips', '500']]),
    },
  }),

  'inline-claim': spec(
    {
      inline: {
        rows: [call17, msg('s17', 'ef', 'db', '… WHERE CustomerId = 17'), call42, msg('s42', 'ef', 'db', '… WHERE CustomerId = 42')],
        output: out([['SQL texts', 'a different one per call'], ['Plans', '?']]),
      },
      plans: {
        rows: [call17, msg('s17', 'ef', 'db', '… WHERE CustomerId = 17'), call42, msg('s42', 'ef', 'db', '… WHERE CustomerId = 42'), more, note('plans', 'db', 'compiles a plan per text')],
        output: out([['SQL texts', '500'], ['Plans', '500']]),
      },
    },
    null,
  ),
  'inline-reality': spec({
    variable: {
      rows: [note('var', 'job', 'customerId: a variable'), asParam, call17, msg('s17', 'ef', 'db', 'SQL text, @customerId = 17', 'ok'), call42, msg('s42', 'ef', 'db', 'same text, @customerId = 42', 'ok')],
      line: L.WHERE,
      output: out([['SQL texts', '1', 'ok'], ['Plans', '?']]),
    },
    plan: {
      rows: [
        note('var', 'job', 'customerId: a variable'),
        asParam,
        call17,
        msg('s17', 'ef', 'db', 'SQL text, @customerId = 17', 'ok'),
        call42,
        msg('s42', 'ef', 'db', 'same text, @customerId = 42', 'ok'),
        more,
        note('plans', 'db', '1 plan, reused', 'ok'),
      ],
      line: L.WHERE,
      output: out([['SQL texts', '1', 'ok'], ['Plans', '1', 'ok'], ['Inlined only for', 'a constant in the lambda, or EF.Constant(…)']]),
    },
  }),

  'rows-claim': spec(
    {
      once: {
        rows: [call17, msg('sql', 'ef', 'db', 'the SQL, once'), msg('rows', 'db', 'ef', 'rows'), note('keep', 'ef', 'keeps the rows')],
        output: out([['SQL runs', 'once'], ['Later calls', '?']]),
      },
      memory: {
        rows: [call17, msg('sql', 'ef', 'db', 'the SQL, once'), msg('rows', 'db', 'ef', 'rows'), note('keep', 'ef', 'keeps the rows'), call42, note('filter', 'ef', 'filters kept rows by id 42')],
        output: out([['SQL runs', 'once'], ['Later calls', 'filter in memory']]),
      },
    },
    null,
  ),
  'rows-reality': spec({
    cache: { rows: [note('what', 'ef', 'caches the SQL, never rows', 'ok')], line: L.WHERE, output: out([['Cached', 'the translation', 'ok'], ['Round trips', '?']]) },
    each: {
      rows: [
        note('what', 'ef', 'caches the SQL, never rows', 'ok'),
        call17,
        msg('s17', 'ef', 'db', 'SQL text, @customerId = 17'),
        msg('r17', 'db', 'ef', "customer 17's rows"),
        call42,
        msg('s42', 'ef', 'db', 'same text, @customerId = 42'),
        msg('r42', 'db', 'ef', "customer 42's rows"),
        more,
      ],
      line: L.WHERE,
      output: out([['Cached', 'the translation', 'ok'], ['Round trips', '500, one per call', 'ok']]),
    },
  }),

  'adhoc-claim': spec(
    {
      same: { rows: [call17, msg('s17', 'ef', 'db', 'same SQL text, id 17'), call42, msg('s42', 'ef', 'db', 'same SQL text, id 42')], output: out([['SQL texts', '1'], ['Compiles', '?']]) },
      adhoc: {
        rows: [
          call17,
          msg('s17', 'ef', 'db', 'same SQL text, id 17'),
          note('k17', 'db', 'ad-hoc batch: compile'),
          call42,
          msg('s42', 'ef', 'db', 'same SQL text, id 42'),
          note('k42', 'db', 'ad-hoc batch: compile again'),
        ],
        output: out([['SQL texts', '1'], ['Compiles', 'one per call']]),
      },
    },
    null,
  ),
  'adhoc-reality': spec({
    rpc: {
      rows: [call17, msg('s17', 'ef', 'db', 'sp_executesql: text, @customerId int = 17', 'ok'), compile],
      line: L.WHERE,
      output: out([['SQL texts', '1'], ['Compiles', '1', 'ok']]),
    },
    reuse: {
      rows: [call17, msg('s17', 'ef', 'db', 'sp_executesql: text, @customerId int = 17', 'ok'), compile, call42, msg('s42', 'ef', 'db', 'same text, @customerId = 42', 'ok'), reuse],
      line: L.WHERE,
      output: out([['SQL texts', '1'], ['Compiles', '1, then reused', 'ok']]),
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
