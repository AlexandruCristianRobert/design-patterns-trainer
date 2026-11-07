import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const QUERY = ['var blogs = db.Blogs', '    .Include(b => b.Posts)', '    .Include(b => b.Contributors)']
const CODE = [...QUERY, '    .AsSplitQuery()', '    .ToList();']
const JOIN_CODE = [...QUERY, '    .ToList();']
const LOOP = ['', 'foreach (var blog in blogs)', '    Show(blog.Posts, blog.Contributors);']
const LOOP_CODE = [...CODE, ...LOOP]
const L = { QUERY: [0, 2] as [number, number], ALL: [0, 4] as [number, number], POSTS: 1, CONTRIB: 2, SPLIT: 3, TOLIST: 4 }
/** The loop's lines in LOOP_CODE. */
const LP = { LOOP: [6, 7] as [number, number] }

const APP: SeqActor = { id: 'app', name: 'Your code', sub: 'EF Core', tone: 'ui' }
const DB: SeqActor = { id: 'db', name: 'Database', tone: 'io' }
const CONN_A: SeqActor = { id: 'db', name: 'Database', sub: 'connection 1', tone: 'io' }
const CONN_B: SeqActor = { id: 'db2', name: 'Database', sub: 'connection 2', tone: 'io' }

const note = (key: string, label: string, kind?: SeqRow['kind'], at = 'app'): SeqRow => ({ key, from: at, label, kind })
const sql = (key: string, label: string, kind?: SeqRow['kind'], to = 'db'): SeqRow => ({ key, from: 'app', to, label, kind })
const back = (key: string, label: string, kind?: SeqRow['kind'], from = 'db'): SeqRow => ({ key, from, to: 'app', label, kind })
const out = (statements: string, rows: string, kind: OutLine['kind'] = 'plain'): OutLine[] => [
  { label: 'Statements', text: statements, kind: statements === '?' ? 'muted' : 'plain' },
  { label: 'Rows returned', text: rows, kind },
]
const seq = (actors: SeqActor[], code: string[], steps: Record<string, SeqStep>): SeqSpec => ({ actors, code, outputName: 'Result', steps })

// ---- The one JOIN ----
const join = sql('join', 'SELECT … FROM Blogs LEFT JOIN Posts LEFT JOIN Contributors')
const exploded = back('rows', '1,000 rows (100 posts × 10 contributors)', 'bad')
const eachRow = note('each', 'each row: the blog + 1 post + 1 contributor', 'bad', 'db')

// ---- The split statements ----
const qBlogs = sql('q-blogs', 'SELECT … FROM Blogs')
const rBlogs = back('r-blogs', '1 row')
const qPosts = sql('q-posts', 'SELECT … FROM Posts (of those blogs)')
const rPosts = back('r-posts', '100 rows')
const qContrib = sql('q-contrib', 'SELECT … FROM Contributors (of those blogs)')
const rContrib = back('r-contrib', '10 rows')
const splitRows = [qBlogs, rBlogs, qPosts, rPosts, qContrib, rContrib]

const SPECS: Record<string, SeqSpec> = {
  setup: seq([APP, DB], CODE, {
    query: { rows: [note('query', 'Blogs + Include(Posts) + Include(Contributors)')], line: L.QUERY },
    data: {
      rows: [note('query', 'Blogs + Include(Posts) + Include(Contributors)'), note('data', 'each blog: its posts, its contributors', undefined, 'db')],
      line: L.QUERY,
    },
    split: {
      rows: [note('query', 'Blogs + Include(Posts) + Include(Contributors)'), note('data', 'each blog: its posts, its contributors', undefined, 'db'), note('split', '.AsSplitQuery() added: solves ?', 'muted')],
      line: L.SPLIT,
    },
  }),

  single: seq([APP, DB], JOIN_CODE, {
    sql: { rows: [join], line: L.ALL, output: out('1', '?', 'muted') },
    rows: { rows: [join, exploded, eachRow], line: L.ALL, output: out('1', '1,000', 'bad') },
    waste: {
      rows: [join, exploded, eachRow, note('distinct', 'distinct: 1 blog, 100 posts, 10 contributors')],
      line: L.ALL,
      output: out('1', '1,000 for 111 distinct entities', 'bad'),
    },
  }),
  split: seq([APP, DB], CODE, {
    blogs: { rows: splitRows.slice(0, 2), line: L.SPLIT, output: out('1', '1') },
    posts: { rows: splitRows.slice(0, 4), line: L.POSTS, output: out('2', '1 + 100') },
    contributors: { rows: splitRows, line: L.CONTRIB, output: out('3', '1 + 100 + 10') },
    total: { rows: splitRows, line: L.ALL, output: out('3 round trips', '111', 'ok') },
  }),

  'paging-claim': seq([APP, DB], CODE, {
    'page-1': {
      rows: [sql('p1', 'rows 1–100 (page 1)'), back('r1', 'page 1'), note('m1', 'in memory: page 1')],
      line: L.SPLIT,
      output: [{ label: 'In memory', text: 'page 1 only' }],
    },
    'page-2': {
      rows: [sql('p1', 'rows 1–100 (page 1)', 'muted'), back('r1', 'page 1', 'muted'), sql('p2', 'rows 101–200 (page 2), later'), back('r2', 'page 2'), note('m2', 'in memory: page 2, page 1 let go')],
      line: L.SPLIT,
      output: [{ label: 'In memory', text: 'one page at a time' }],
    },
  }),
  'paging-reality': seq([APP, DB], CODE, {
    blogs: { rows: splitRows.slice(0, 2), line: L.SPLIT, output: [{ label: 'In memory', text: 'all blogs' }] },
    collections: { rows: splitRows, line: [L.POSTS, L.CONTRIB], output: [{ label: 'In memory', text: 'all blogs, posts and contributors' }] },
    memory: {
      rows: [...splitRows, note('all', 'ToList(): every row held at once', 'bad')],
      line: L.TOLIST,
      output: [{ label: 'In memory', text: 'the whole result: no paging', kind: 'bad' }],
    },
  }),

  'parallel-claim': seq([APP, CONN_A, CONN_B], CODE, {
    blogs: { rows: [qBlogs, rBlogs], line: L.SPLIT, output: [{ label: 'Time', text: '?', kind: 'muted' }] },
    parallel: {
      rows: [qBlogs, rBlogs, sql('q-posts', 'Posts, at the same time as…'), sql('q-contrib', '…Contributors', undefined, 'db2')],
      line: [L.POSTS, L.CONTRIB],
      output: [{ label: 'Time', text: '?', kind: 'muted' }],
    },
    time: {
      rows: [qBlogs, rBlogs, sql('q-posts', 'Posts, at the same time as…'), sql('q-contrib', '…Contributors', undefined, 'db2')],
      line: L.ALL,
      output: [{ label: 'Time', text: 'about half' }],
    },
  }),
  'parallel-reality': seq([APP, CONN_A, CONN_B], CODE, {
    blogs: { rows: [qBlogs, rBlogs], line: L.SPLIT, output: [{ label: 'Time', text: '1 statement' }] },
    posts: { rows: [qBlogs, rBlogs, sql('q-posts', 'Posts, after the blogs'), back('r-posts', '100 rows')], line: L.POSTS, output: [{ label: 'Time', text: '2 statements, in turn' }] },
    contributors: {
      rows: [qBlogs, rBlogs, sql('q-posts', 'Posts, after the blogs'), back('r-posts', '100 rows'), sql('q-contrib', 'Contributors, after the posts'), back('r-contrib', '10 rows')],
      line: L.CONTRIB,
      output: [{ label: 'Time', text: '3 statements, in turn' }],
    },
    why: {
      rows: [
        qBlogs, rBlogs, sql('q-posts', 'Posts, after the blogs'), back('r-posts', '100 rows'), sql('q-contrib', 'Contributors, after the posts'), back('r-contrib', '10 rows'),
        note('unused', 'not used', 'skip', 'db2'),
      ],
      line: L.ALL,
      output: [{ label: 'Time', text: 'the sum of the three, nothing halved', kind: 'bad' }],
    },
  }),

  'n-plus-one-claim': seq([APP, DB], LOOP_CODE, {
    before: {
      rows: [sql('q', 'the query'), sql('b1', 'blog 1 → Posts, Contributors', 'bad'), sql('b2', 'blog 2 → Posts, Contributors', 'bad'), sql('bn', '… one query per blog', 'bad')],
      line: LP.LOOP,
      output: [{ label: 'Queries', text: '1 + N' }],
    },
    after: {
      rows: [sql('q', 'the query'), sql('b1', 'blog 1 → Posts, Contributors', 'skip'), sql('b2', 'blog 2 → Posts, Contributors', 'skip'), sql('bn', '… one query per blog', 'skip')],
      line: L.SPLIT,
      output: [{ label: 'Queries', text: 'no per-blog queries' }],
    },
  }),
  'n-plus-one-reality': seq([APP, DB], LOOP_CODE, {
    before: {
      rows: [join, back('rows', 'posts and contributors loaded'), note('loop', 'loop: no SQL, already loaded', 'ok')],
      line: L.QUERY,
      output: [{ label: 'Queries', text: '1, and none in the loop', kind: 'ok' }],
    },
    after: { rows: [...splitRows, note('loop', 'loop: no SQL, already loaded', 'ok')], line: L.SPLIT, output: [{ label: 'Queries', text: '3, and none in the loop' }] },
    lazy: {
      rows: [...splitRows, note('loop', 'loop: no SQL, already loaded', 'ok'), note('lazy', 'N+1 needs lazy loading: none here', 'ok')],
      line: LP.LOOP,
      output: [{ label: 'Queries', text: '3, and none in the loop' }],
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
