import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  '// 100 posts, written by 2 authors',
  'var plain = db.Posts.AsNoTracking()',
  '  .Include(p => p.Author).ToList();',
  'var resolved = db.Posts',
  '  .AsNoTrackingWithIdentityResolution()',
  '  .Include(p => p.Author).ToList();',
]
const L = { DATA: 0, PLAIN: [1, 2] as [number, number], INCLUDE: 2, RESOLVED: [3, 5] as [number, number] }

const POSTS: Region = { id: 'posts', name: 'Posts', sub: '3 of 100 shown', tone: 'pool' }
const AUTHORS: Region = { id: 'authors', name: 'Author objects', sub: 'built by the query', tone: 'ui' }
const TEMP: Region = { id: 'map', name: 'Temporary tracker', sub: 'this query only', tone: 'muted' }
const CONTEXT: Region = { id: 'map', name: 'Change tracker', sub: 'the context', tone: 'io' }

/** The three example posts: rows 1 and 3 by Ann (author key 1), row 2 by Bob (key 2). */
const KEYS = [1, 2, 1]
type AuthorOf = (row: number) => Field
const post = (row: number, author: AuthorOf): Box => ({ id: `p${row}`, region: 'posts', title: `Post ${row}`, sub: `AuthorId ${KEYS[row - 1]}`, fields: [author(row)] })
const posts = (author: AuthorOf, upTo = 3): Box[] => [1, 2, 3].map((r) => post(r, r <= upTo ? author : unknown))
const restPosts: Box = { id: 'rest', region: 'posts', title: 'Posts 4–100', kind: 'muted' }
const unknown: AuthorOf = () => ({ name: 'Author', value: '?', kind: 'muted' })
const nameOf = (row: number) => (KEYS[row - 1] === 1 ? 'Ann' : 'Bob')

/** Without identity resolution: post n points at its own author object n. */
const own: AuthorOf = (row) => ({ name: 'Author', value: nameOf(row), ref: `a${row}` })
const ownAuthor = (row: number): Box => ({ id: `a${row}`, region: 'authors', title: nameOf(row), sub: `object ${row}` })
const moreAuthors: Box = { id: 'more', region: 'authors', title: '… 97 more', sub: 'one per row', kind: 'muted' }

/** One object per key; `bad` marks row 3's arrow (the reuse a claim asserts). */
const shared = (badRow3 = false): AuthorOf => (row) => ({ name: 'Author', value: nameOf(row), ref: `k${KEYS[row - 1]}`, kind: badRow3 && row === 3 ? 'bad' : undefined })
const keyAuthor = (key: number, sub = 'one object'): Box => ({ id: `k${key}`, region: 'authors', title: key === 1 ? 'Ann' : 'Bob', sub })
const tempMap = (keys: number[]): Box => ({
  id: 'temp',
  region: 'map',
  title: 'by key',
  fields: keys.map((k) => ({ name: `key ${k}`, value: k === 1 ? 'Ann' : 'Bob', ref: `k${k}` })),
})
const tempGone: Box = { id: 'temp', region: 'map', title: 'by key', sub: 'thrown away', kind: 'gone' }

const plainOut = (text: string, kind?: OutLine['kind']): OutLine => ({ label: 'AsNoTracking()', text, kind })
const resolvedOut = (text: string, kind?: OutLine['kind']): OutLine => ({ label: 'With identity resolution', text, kind })
const trackedOut = (text: string, kind?: OutLine['kind']): OutLine => ({ label: 'Tracked by the context', text, kind })
const sqlOut = (text: string, kind?: OutLine['kind']): OutLine => ({ label: 'SQL', text, kind })

const spec = (regions: Region[], steps: Record<string, GraphStep>): GraphSpec => ({ regions, code: CODE, outputName: 'Author objects', steps })

/** The real runs. */
const P = {
  first: { boxes: [...posts(own, 2), restPosts, ownAuthor(1), ownAuthor(2)], line: L.PLAIN, output: [plainOut('…')] },
  repeat: { boxes: [...posts(own), restPosts, ownAuthor(1), ownAuthor(2), ownAuthor(3)], line: L.PLAIN, output: [plainOut('…')] },
  count: { boxes: [...posts(own), restPosts, ownAuthor(1), ownAuthor(2), ownAuthor(3), moreAuthors], line: L.PLAIN, output: [plainOut('100'), trackedOut('none')] },
} satisfies Record<string, GraphStep>
const R = {
  first: { boxes: [...posts(shared(), 2), restPosts, keyAuthor(1, 'created'), keyAuthor(2, 'created'), tempMap([1, 2])], line: L.RESOLVED, output: [resolvedOut('…')] },
  repeat: { boxes: [...posts(shared()), restPosts, keyAuthor(1, 'reused'), keyAuthor(2, 'created'), tempMap([1, 2])], line: L.RESOLVED, output: [resolvedOut('…')] },
  count: { boxes: [...posts(shared()), restPosts, keyAuthor(1), keyAuthor(2), tempGone], line: L.RESOLVED, output: [resolvedOut('2', 'ok'), trackedOut('none', 'ok')] },
} satisfies Record<string, GraphStep>

const SPECS: Record<string, GraphSpec> = {
  setup: spec([POSTS, AUTHORS], {
    posts: { boxes: [...posts(unknown), restPosts], line: L.DATA, output: [plainOut('?', 'muted'), resolvedOut('?', 'muted')] },
    plain: { boxes: [...posts(unknown), restPosts, { id: 'ask', region: 'authors', title: '?' }], line: L.PLAIN, output: [plainOut('?'), resolvedOut('?', 'muted')] },
    resolved: { boxes: [...posts(unknown), restPosts, { id: 'ask', region: 'authors', title: '?' }], line: L.RESOLVED, output: [plainOut('?'), resolvedOut('?')] },
  }),
  plain: spec([POSTS, AUTHORS], P),
  resolved: spec([POSTS, AUTHORS, TEMP], R),

  'dedupe-claim': spec([POSTS, AUTHORS], {
    repeat: { boxes: [...posts(shared(true)), restPosts, keyAuthor(1, 'reused'), keyAuthor(2)], line: L.PLAIN, output: [plainOut('…')] },
    count: { boxes: [...posts(shared(true)), restPosts, keyAuthor(1), keyAuthor(2)], line: L.PLAIN, output: [plainOut('2', 'bad'), resolvedOut('2')] },
  }),
  'dedupe-reality': spec([POSTS, AUTHORS], {
    repeat: P.repeat,
    count: { ...P.count, output: [plainOut('100'), resolvedOut('2', 'ok')] },
  }),

  'attach-claim': spec([POSTS, AUTHORS, CONTEXT], {
    plain: { boxes: [...posts(shared(true)), restPosts, keyAuthor(1), keyAuthor(2)], line: L.PLAIN, output: [plainOut('2', 'bad')] },
    resolved: {
      boxes: [
        ...posts(shared()),
        restPosts,
        keyAuthor(1),
        keyAuthor(2),
        { id: 'ctx', region: 'map', title: 'tracked', kind: 'bad', fields: [1, 2].map((k) => ({ name: `key ${k}`, value: k === 1 ? 'Ann' : 'Bob', ref: `k${k}`, kind: 'bad' as const })) },
      ],
      line: L.RESOLVED,
      output: [plainOut('2', 'bad'), resolvedOut('2'), trackedOut('Ann, Bob', 'bad')],
    },
  }),
  'attach-reality': spec([POSTS, AUTHORS, TEMP], {
    plain: { ...P.count, output: [plainOut('100')] },
    resolved: { ...R.count, output: [plainOut('100'), resolvedOut('2'), trackedOut('none', 'ok')] },
  }),

  'ignored-claim': spec([POSTS, AUTHORS], {
    sql: { boxes: [...posts(unknown), restPosts], line: L.INCLUDE, bad: true, output: [sqlOut('posts only', 'bad')] },
    result: {
      boxes: [...posts(() => ({ name: 'Author', value: 'null', kind: 'bad' })), restPosts],
      line: L.PLAIN,
      output: [sqlOut('posts only', 'bad'), plainOut('0', 'bad'), resolvedOut('2')],
    },
  }),
  'ignored-reality': spec([POSTS, AUTHORS], {
    sql: { boxes: [...posts(unknown), restPosts], line: L.INCLUDE, output: [sqlOut('posts joined with their authors', 'ok')] },
    result: { ...P.count, output: [sqlOut('posts joined with their authors', 'ok'), plainOut('100')] },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
