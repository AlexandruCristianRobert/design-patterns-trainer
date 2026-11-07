import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { TableStage, type TableDef, type TableSpec, type TableStep, type TRow } from '../TableStage'

const CODE = [
  '// earlier: all posts of blog 1 loaded, tracked',
  'var blog = await db.Blogs',
  '    .Include(b => b.Posts.Where(p => p.IsPublished))',
  '    .SingleAsync(b => b.Id == 1);',
  'var posts = blog.Posts;',
]
const FRESH_CODE = [
  '// a fresh context: nothing tracked yet',
  'var blog = await freshDb.Blogs',
  '    .Include(b => b.Posts.Where(p => p.IsPublished))',
  '    .SingleAsync(b => b.Id == 1);',
  'var posts = blog.Posts;',
]
const L = { EARLIER: 0, QUERY: [1, 3] as [number, number], POSTS: 4 }

const DB: TableDef = { id: 'db', name: 'Database', sub: 'Posts table', tone: 'io', columns: ['Post', 'Blog', 'Published'] }
const TRACKER: TableDef = { id: 'tracker', name: 'Change tracker', sub: 'this context', tone: 'ui', columns: ['Entity', 'Loaded'] }
const NAV: TableDef = { id: 'nav', name: 'blog.Posts', sub: 'the navigation', tone: 'pool', columns: ['Post', 'Published'] }

const POSTS = [
  { id: '1', pub: 'yes' },
  { id: '2', pub: 'no' },
  { id: '3', pub: 'yes' },
]
/** The Posts table; after a query, the published rows are returned and the draft is filtered out. */
const db = (queried: boolean): TRow[] =>
  POSTS.map((p) => ({
    key: p.id,
    cells: [`Post ${p.id}`, '1', p.pub],
    kind: !queried ? 'plain' : p.pub === 'yes' ? 'hit' : 'skip',
    mark: !queried ? undefined : p.pub === 'yes' ? 'returned' : 'filtered out',
  }))
const earlierPost = (id: string, mark?: string): TRow => ({ key: `p${id}`, cells: [`Post ${id}`, 'earlier'], mark })
const blogRow: TRow = { key: 'blog', cells: ['Blog 1', 'this query'], kind: 'new' }
const TRACKED = POSTS.map((p) => earlierPost(p.id))
const REUSED = [blogRow, earlierPost('1', 'reused'), earlierPost('2'), earlierPost('3', 'reused')]

const nav = (ids: string[], bad: string[] = []): TRow[] =>
  ids.map((id) => {
    const p = POSTS.find((x) => x.id === id)!
    return bad.includes(id)
      ? { key: id, cells: [`Post ${id}`, p.pub], kind: 'bad', mark: 'fixup', markKind: 'bad' }
      : { key: id, cells: [`Post ${id}`, p.pub], kind: 'hit' }
  })

const out = (sql: string, posts: string, sqlKind?: OutLine['kind'], postsKind?: OutLine['kind']): OutLine[] => [
  { label: 'SQL returns', text: sql, kind: sql === '?' ? 'muted' : sqlKind },
  { label: 'blog.Posts', text: posts, kind: posts === '?' ? 'muted' : postsKind },
]
const SQL = 'Blog 1, Posts 1 and 3'
const ALL = 'Posts 1, 2, 3'

const spec = (steps: Record<string, TableStep>, code = CODE): TableSpec => ({ tables: [DB, TRACKER, NAV], code, outputName: 'Query', steps })

/** The real run in the context that tracks all three posts. */
const R = {
  sql: { tables: { db: db(true), tracker: TRACKED }, line: L.QUERY, output: out(SQL, '…', 'ok') },
  identity: { tables: { db: db(true), tracker: REUSED }, line: L.QUERY, output: out(SQL, '…', 'ok') },
  fixup: { tables: { db: db(true), tracker: REUSED, nav: nav(['1', '2', '3'], ['2']) }, line: L.POSTS, output: out(SQL, ALL, 'ok', 'bad') },
} satisfies Record<string, TableStep>

const SPECS: Record<string, TableSpec> = {
  setup: spec({
    earlier: { tables: { db: db(false), tracker: TRACKED }, line: L.EARLIER, output: out('…', '…') },
    query: { tables: { db: db(false), tracker: TRACKED }, line: L.QUERY, output: out('?', '…') },
    question: {
      tables: { db: db(false), tracker: TRACKED, nav: [{ key: 'q', cells: ['?', '?'], kind: 'muted' }] },
      line: L.POSTS,
      output: out('?', '?'),
    },
  }),
  tracking: spec(R),
  fresh: spec(
    {
      sql: { tables: { db: db(true), tracker: [] }, line: L.QUERY, output: out(SQL, '…', 'ok') },
      result: {
        tables: { db: db(true), tracker: [blogRow, { key: 'p1', cells: ['Post 1', 'this query'] }, { key: 'p3', cells: ['Post 3', 'this query'] }], nav: nav(['1', '3']) },
        line: L.POSTS,
        output: out(SQL, 'Posts 1, 3', 'ok', 'ok'),
      },
    },
    FRESH_CODE,
  ),

  'removes-claim': spec({
    sql: R.sql,
    result: {
      tables: { db: db(true), tracker: [blogRow, earlierPost('1'), { ...earlierPost('2', 'left out'), kind: 'skip', markKind: 'bad' }, earlierPost('3')], nav: nav(['1', '3']) },
      line: L.POSTS,
      bad: true,
      output: out(SQL, 'Posts 1, 3', 'ok', 'bad'),
    },
  }),
  'removes-reality': spec({ sql: R.sql, result: R.fixup }),

  'skipped-claim': spec({
    sql: {
      tables: { db: db(false), tracker: [blogRow, ...TRACKED] },
      line: 2,
      bad: true,
      output: out('Blog 1 only', '…', 'bad'),
    },
    result: {
      tables: { db: db(false), tracker: [blogRow, ...TRACKED], nav: POSTS.map((p) => ({ key: p.id, cells: [`Post ${p.id}`, p.pub], kind: 'bad', mark: 'tracked earlier', markKind: 'bad' })) },
      line: L.POSTS,
      bad: true,
      output: out('Blog 1 only', 'tracked posts only', 'bad', 'bad'),
    },
  }),
  'skipped-reality': spec({
    sql: { tables: { db: db(true), tracker: REUSED }, line: 2, output: out(SQL, '…', 'ok') },
    result: {
      tables: {
        db: db(true),
        tracker: REUSED,
        nav: [
          { key: '1', cells: ['Post 1', 'yes'], kind: 'hit', mark: 'queried', markKind: 'ok' },
          { key: '2', cells: ['Post 2', 'no'], kind: 'bad', mark: 'fixup', markKind: 'bad' },
          { key: '3', cells: ['Post 3', 'yes'], kind: 'hit', mark: 'queried', markKind: 'ok' },
        ],
      },
      line: L.POSTS,
      output: out(SQL, ALL, 'ok'),
    },
  }),

  'throws-claim': spec({
    run: {
      tables: { db: db(false), tracker: TRACKED },
      line: L.QUERY,
      bad: true,
      output: [{ label: 'Exception', text: 'needs AsNoTracking()', kind: 'bad' }],
    },
    result: {
      tables: { db: db(false), tracker: TRACKED },
      line: L.POSTS,
      bad: true,
      output: [
        { label: 'Exception', text: 'needs AsNoTracking()', kind: 'bad' },
        { label: 'blog.Posts', text: 'never reached', kind: 'bad' },
      ],
    },
  }),
  'throws-reality': spec({
    run: { tables: { db: db(true), tracker: REUSED }, line: L.QUERY, output: out(SQL, '…', 'ok') },
    result: R.fixup,
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <TableStage spec={s} {...p} />]),
)
export default drawing
