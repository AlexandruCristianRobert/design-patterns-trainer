import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const actors: SeqActor[] = [
  { id: 'user', name: 'User', tone: 'ui' },
  { id: 'app', name: 'App', sub: 'EF Core', tone: 'pool' },
  { id: 'db', name: 'Database', tone: 'io' },
]

const RAW = ['db.Users.FromSqlRaw(', `  $"SELECT * FROM Users WHERE Name = '{name}'")`]
const FROMSQL = ['db.Users.FromSql(', '  $"SELECT * FROM Users WHERE Name = {name}")']
const PLACEHOLDER = ['db.Users.FromSqlRaw(', '  "SELECT * FROM Users WHERE Name = {0}", name)']
const INTERPOLATED = ['db.Users.FromSqlInterpolated(', '  $"SELECT * FROM Users WHERE Name = {name}")']
const ALL = [...RAW, ...FROMSQL, ...PLACEHOLDER, ...INTERPOLATED]
const SAFE = [...FROMSQL, ...PLACEHOLDER, ...INTERPOLATED]

const INPUT = "' OR 1=1 --"
const PASTED = `SELECT * FROM Users WHERE Name = '${INPUT}'`
const PASTED_BARE = 'SELECT * FROM Users WHERE Name = <input>'
const PARAM = 'SELECT * FROM Users WHERE Name = @p0'

const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const spec = (code: string[], outputName: string, steps: Record<string, SeqStep>): SeqSpec => ({ actors, code, outputName, steps })

const typed = msg('name', 'user', 'app', 'name')
const sent = (text: string, params: string, kind?: OutLine['kind']): OutLine[] => [
  { label: 'SQL text', text, kind },
  { label: 'params', text: params, kind },
]
const paramOut = (result?: string, value = INPUT): OutLine[] => [
  { label: 'SQL text', text: PARAM, kind: 'ok' },
  { label: '@p0', text: value },
  ...(result ? [{ label: 'result', text: result, kind: 'ok' as const }] : []),
]

const SPECS: Record<string, SeqSpec> = {
  setup: spec(ALL, 'Input', {
    input: { rows: [typed], output: [{ label: 'name', text: 'any text' }] },
    queries: { rows: [typed, note('four', 'app', '4 queries')], line: [0, 7], output: [{ label: 'name', text: 'any text' }] },
    ask: { rows: [typed, note('four', 'app', '4 queries'), msg('sql', 'app', 'db', 'SQL'), note('q', 'db', '?')], line: [0, 7], output: [{ label: 'name', text: 'any text' }] },
  }),

  raw: spec(RAW, 'Sent to the database', {
    build: { rows: [typed, note('built', 'app', 'one string', 'bad')], line: 1, bad: true, output: [{ label: 'string', text: PASTED, kind: 'bad' }] },
    send: {
      rows: [typed, note('built', 'app', 'one string', 'bad'), msg('sql', 'app', 'db', 'text only', 'bad')],
      line: 0,
      bad: true,
      output: sent(PASTED, 'none', 'bad'),
    },
    runs: {
      rows: [typed, note('built', 'app', 'one string', 'bad'), msg('sql', 'app', 'db', 'text only', 'bad'), note('or', 'db', 'OR 1=1: every row', 'bad')],
      line: 1,
      bad: true,
      output: [...sent(PASTED, 'none', 'bad'), { label: 'result', text: 'all users', kind: 'bad' }],
    },
  }),
  params: spec(SAFE, 'Sent to the database', {
    fromsql: { rows: [typed, note('got-fs', 'app', 'format + value'), msg('sql', 'app', 'db', 'text + @p0', 'ok')], line: [0, 1], output: paramOut() },
    'raw-arg': { rows: [typed, note('got-raw', 'app', 'format + value'), msg('sql', 'app', 'db', 'text + @p0', 'ok')], line: [2, 3], output: paramOut() },
    interpolated: {
      rows: [typed, note('got-int', 'app', 'format + value'), msg('sql', 'app', 'db', 'text + @p0', 'ok'), note('none', 'db', 'no such name', 'ok')],
      line: [4, 5],
      output: paramOut('no rows'),
    },
  }),
}

/** The claim and reality plays for one of the three parameterized queries. */
const claimPair = (code: string[], first: string): Record<string, SeqSpec> => ({
  claim: spec(code, 'Sent to the database', {
    call: { rows: [typed], line: [0, 1] },
    pasted: { rows: [typed, msg('sql', 'app', 'db', 'text with name')], line: [0, 1], output: [{ label: 'SQL text', text: PASTED_BARE }] },
  }),
  reality: spec(code, 'Sent to the database', {
    [first]: { rows: [typed, note('got', 'app', 'format + value', 'ok')], line: 1 },
    param: { rows: [typed, note('got', 'app', 'format + value', 'ok'), msg('sql', 'app', 'db', 'text + @p0', 'ok')], line: [0, 1], output: paramOut(undefined, '<input>') },
  }),
})
const pairs: [string, string[], string][] = [
  ['fromsql', FROMSQL, 'type'],
  ['placeholder', PLACEHOLDER, 'args'],
  ['interpolated', INTERPOLATED, 'type'],
]
for (const [name, code, first] of pairs) {
  const p = claimPair(code, first)
  SPECS[`${name}-claim`] = p.claim
  SPECS[`${name}-reality`] = p.reality
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
