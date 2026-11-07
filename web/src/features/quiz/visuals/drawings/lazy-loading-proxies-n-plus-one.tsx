import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const LAZY_CODE = [
  '// options: …UseLazyLoadingProxies()',
  'var blogs = db.Blogs.ToList();',
  'foreach (var blog in blogs)',
  '    Console.WriteLine(blog.Posts.Count);',
]
const L = { CONFIG: 0, LOAD: 1, LOOP: [2, 3] as [number, number], READ: 3 }
const FIX_CODE = [
  'var blogs = db.Blogs.Include(b => b.Posts).ToList();',
  'foreach (var blog in blogs)',
  '    Console.WriteLine(blog.Posts.Count);',
  '',
  '// or count in the database and load no posts:',
  'var counts = db.Blogs',
  '    .Select(b => new { b.Name, PostCount = b.Posts.Count() })',
  '    .ToList();',
]

const actors: SeqSpec['actors'] = [
  { id: 'app', name: 'Your code', sub: 'the page', tone: 'ui' },
  { id: 'db', name: 'Database', sub: 'one row per SQL query', tone: 'io' },
]
const spec = (code: string[], steps: Record<string, SeqStep>): SeqSpec => ({ actors, code, outputName: 'SQL sent', steps })

const note = (key: string, label: string, kind?: SeqRow['kind'], at = 'app'): SeqRow => ({ key, from: at, label, kind })
const sql = (key: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: 'app', to: 'db', label, kind, both: true })
const count = (text: string, kind: OutLine['kind'] = 'plain'): OutLine[] => [{ label: 'Queries', text, kind }]

const blogsQuery = sql('blogs', 'SELECT … FROM Blogs')
const notLoaded = note('unloaded', 'Posts not loaded')
const post = (n: number) => sql(`p${n}`, `SELECT … FROM Posts WHERE BlogId = ${n}`)
const middle = sql('pmid', '… the same for BlogId = 3 to 49', 'muted')
const perBlog = [post(1), post(2), middle, post(50)]

const R = {
  blogs: { rows: [blogsQuery, notLoaded], line: L.LOAD, output: count('1') },
  loop: { rows: [blogsQuery, notLoaded, ...perBlog], line: L.READ, output: count('51') },
  total: { rows: [blogsQuery, notLoaded, ...perBlog], line: L.LOOP, output: count('51 = 1 + 50', 'bad') },
} satisfies Record<string, SeqStep>

const SPECS: Record<string, SeqSpec> = {
  setup: spec(LAZY_CODE, {
    config: { rows: [note('config', 'lazy-loading proxies on')], line: L.CONFIG, output: count('?', 'muted') },
    load: { rows: [note('config', 'lazy-loading proxies on'), note('load', 'db.Blogs.ToList(): 50 blogs')], line: L.LOAD, output: count('?', 'muted') },
    loop: {
      rows: [note('config', 'lazy-loading proxies on'), note('load', 'db.Blogs.ToList(): 50 blogs'), note('loop', 'blog.Posts.Count for each blog'), note('q', '?', 'muted', 'db')],
      line: L.LOOP,
      output: count('?', 'muted'),
    },
  }),
  lazy: spec(LAZY_CODE, {
    'blogs-query': R.blogs,
    'blog-1': { rows: [blogsQuery, notLoaded, post(1)], line: L.READ, output: count('2') },
    'blog-2': { rows: [blogsQuery, notLoaded, post(1), post(2)], line: L.READ, output: count('3') },
    rest: R.loop,
    total: R.total,
  }),
  fixed: spec(FIX_CODE, {
    include: { rows: [sql('inc', 'SELECT … FROM Blogs LEFT JOIN Posts', 'ok')], line: 0, output: count('1', 'ok') },
    loop: { rows: [sql('inc', 'SELECT … FROM Blogs LEFT JOIN Posts', 'ok'), note('loaded', 'Posts already loaded: no SQL', 'ok')], line: [1, 2], output: count('1', 'ok') },
    projection: {
      rows: [sql('proj', 'SELECT Name, (SELECT COUNT(*) FROM Posts …) FROM Blogs', 'ok')],
      line: [5, 7],
      output: [{ label: 'Queries', text: '1, and no posts loaded', kind: 'ok' }],
    },
  }),

  'batched-claim': spec(LAZY_CODE, {
    'blogs-query': R.blogs,
    loop: { rows: [blogsQuery, notLoaded, sql('in', 'SELECT … FROM Posts WHERE BlogId IN (1, …, 50)')], line: L.READ, output: count('2') },
    total: { rows: [blogsQuery, notLoaded, sql('in', 'SELECT … FROM Posts WHERE BlogId IN (1, …, 50)')], line: L.LOOP, output: count('2 = 1 + 1') },
  }),
  'batched-reality': spec(LAZY_CODE, { 'blogs-query': R.blogs, loop: R.loop, total: R.total }),

  'joined-claim': spec(LAZY_CODE, {
    'blogs-query': { rows: [sql('join', 'SELECT … FROM Blogs JOIN Posts')], line: L.LOAD, output: count('1') },
    loop: { rows: [sql('join', 'SELECT … FROM Blogs JOIN Posts'), note('loaded', 'Posts already loaded: no SQL')], line: L.READ, output: count('1') },
    total: { rows: [sql('join', 'SELECT … FROM Blogs JOIN Posts'), note('loaded', 'Posts already loaded: no SQL')], line: L.LOOP, output: count('1 = 1 + 0') },
  }),
  'joined-reality': spec(LAZY_CODE, { 'blogs-query': R.blogs, loop: R.loop, total: R.total }),

  'cached-claim': spec(LAZY_CODE, {
    'blogs-query': { rows: [note('cache', 'blogs from the proxy factory cache: no SQL')], line: L.LOAD, output: count('0') },
    loop: { rows: [note('cache', 'blogs from the proxy factory cache: no SQL'), ...perBlog], line: L.READ, output: count('50') },
    total: { rows: [note('cache', 'blogs from the proxy factory cache: no SQL'), ...perBlog], line: L.LOOP, output: count('50 = 0 + 50') },
  }),
  'cached-reality': spec(LAZY_CODE, { 'blogs-query': R.blogs, loop: R.loop, total: R.total }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
