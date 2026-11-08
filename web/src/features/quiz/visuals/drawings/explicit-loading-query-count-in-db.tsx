import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'var count = await db.Entry(blog)',
  '    .Collection(b => b.Posts)',
  '    .Query()',
  '    .CountAsync(p => p.IsPublished);',
]
const L = { ENTRY: [0, 1] as [number, number], QUERY: 2, COUNT: 3, ALL: [0, 3] as [number, number] }

const actors: SeqSpec['actors'] = [
  { id: 'app', name: 'App', tone: 'ui' },
  { id: 'ctx', name: 'Context', sub: 'change tracker', tone: 'pool' },
  { id: 'db', name: 'Database', sub: 'blog 1: 5 posts', tone: 'io' },
]
// The setup names no row counts: the stem says nothing about the table.
const setupActors = actors.map((a) => (a.id === 'db' ? { ...a, sub: undefined } : a))
const spec = (steps: Record<string, SeqStep>): SeqSpec => ({ actors, code: CODE, outputName: 'Afterwards', steps })

const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind'], both = false): SeqRow => ({ key, from, to, label, kind, both })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
type Val = [text: string, kind?: OutLine['kind']]
const out = (sql: Val, tracked: Val, count: Val): OutLine[] => [
  { label: 'SQL sent', text: sql[0], kind: sql[1] },
  { label: 'Posts tracked', text: tracked[0], kind: tracked[1] },
  { label: 'count', text: count[0], kind: count[1] },
]

const tracked = note('tracked', 'ctx', 'blog 1 tracked')
const entry = msg('entry', 'app', 'ctx', 'Entry, Collection')
const iq = msg('iq', 'ctx', 'app', 'IQueryable')
const notRun = note('notrun', 'ctx', 'not run yet', 'muted')
const countSql = (kind?: SeqRow['kind']) => msg('sql', 'ctx', 'db', 'SELECT COUNT(*) … AND IsPublished', kind, true)
const three = msg('three', 'db', 'app', '3')
const BUILT = [tracked, entry, iq, notRun]
const NONE = out(['none'], ['0'], ['?', 'muted'])
const COUNTED = out(['1: COUNT(*)', 'ok'], ['0', 'ok'], ['3', 'ok'])

const SPECS: Record<string, SeqSpec> = {
  setup: {
    actors: setupActors,
    code: CODE,
    steps: {
      tracked: { rows: [tracked] },
      run: { rows: [tracked, note('count', 'app', 'count = ?', 'muted')], line: L.ALL },
    },
  },

  server: spec({
    entry: { rows: [tracked, entry], line: L.ENTRY, output: NONE },
    query: { rows: BUILT, line: L.QUERY, output: NONE },
    count: { rows: [...BUILT, countSql()], line: L.COUNT, output: out(['1: COUNT(*)'], ['0'], ['?', 'muted']) },
    result: { rows: [...BUILT, countSql(), three, note('still', 'ctx', 'still blog 1 only', 'ok')], line: L.COUNT, output: COUNTED },
  }),

  'load-claim': spec({
    load: { rows: [tracked, msg('sql', 'ctx', 'db', 'SELECT * … WHERE BlogId', 'bad', true), note('posts', 'ctx', '5 posts tracked', 'bad')], line: L.QUERY, output: out(['1: SELECT *', 'bad'], ['5', 'bad'], ['?', 'muted']) },
    count: {
      rows: [tracked, msg('sql', 'ctx', 'db', 'SELECT * … WHERE BlogId', 'bad', true), note('posts', 'ctx', '5 posts tracked', 'bad'), note('mem', 'app', 'count in memory', 'bad')],
      line: L.COUNT,
      output: out(['1: SELECT *', 'bad'], ['5', 'bad'], ['3']),
    },
  }),
  'load-reality': spec({
    load: { rows: BUILT, line: L.QUERY, output: NONE },
    count: { rows: [...BUILT, countSql('ok'), three], line: L.COUNT, output: COUNTED },
  }),

  'memory-claim': spec({
    local: { rows: [tracked, note('mem', 'ctx', 'count blog.Posts', 'bad')], line: L.ALL, output: out(['?', 'muted'], ['?', 'muted'], ['?', 'muted']) },
    nodb: {
      rows: [tracked, note('mem', 'ctx', 'count blog.Posts', 'bad'), msg('sql', 'ctx', 'db', 'no query', 'skip')],
      line: L.ALL,
      output: out(['none', 'bad'], ['?', 'muted'], ['loaded ones', 'bad']),
    },
  }),
  'memory-reality': spec({
    local: { rows: [tracked, note('mem', 'ctx', 'blog.Posts: 0 loaded', 'muted')], line: L.ALL, output: out(['?', 'muted'], ['0'], ['?', 'muted']) },
    nodb: {
      rows: [tracked, note('mem', 'ctx', 'blog.Posts: 0 loaded', 'muted'), iq, countSql('ok'), three],
      line: L.COUNT,
      output: COUNTED,
    },
  }),

  'throws-claim': spec({
    noload: { rows: [tracked, note('noload', 'app', 'no Load() call', 'muted')], line: L.ENTRY, output: NONE },
    query: {
      rows: [tracked, note('noload', 'app', 'no Load() call', 'muted'), entry, note('throw', 'ctx', 'Query() throws', 'bad')],
      line: L.QUERY,
      bad: true,
      output: out(['none'], ['0'], ['InvalidOperationException', 'bad']),
    },
  }),
  'throws-reality': spec({
    noload: { rows: [tracked, note('noload', 'app', 'no Load() call', 'muted')], line: L.ENTRY, output: NONE },
    query: {
      rows: [tracked, note('noload', 'app', 'no Load() call', 'muted'), entry, iq, countSql('ok'), three],
      line: [2, 3],
      output: COUNTED,
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
