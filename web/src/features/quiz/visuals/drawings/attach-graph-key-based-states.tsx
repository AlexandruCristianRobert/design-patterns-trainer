import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'var blog = new Blog { Id = 5 };  // from a request',
  'blog.Posts.Add(new Post());      // Id = 0',
  'db.Attach(blog);',
]
const SAVE_CODE = [...CODE, 'db.SaveChanges();']
const L = { GRAPH: [0, 1] as [number, number], ATTACH: 2, SAVE: 3 }

const REGIONS: Region[] = [
  { id: 'mem', name: 'Objects in memory', sub: 'the disconnected graph', tone: 'ui' },
  { id: 'tracker', name: 'Change tracker', sub: 'db.ChangeTracker', tone: 'pool' },
]

const blog: Box = { id: 'blog', region: 'mem', title: 'blog', sub: 'Blog', fields: [{ name: 'Id', value: '5' }, { name: 'Posts', value: '1 post', ref: 'post' }] }
const post: Box = { id: 'post', region: 'mem', title: 'new post', sub: 'Post', fields: [{ name: 'Id', value: '0' }] }
/** The graph is the same at every step: never ring-marked after the first. */
const GRAPH = [blog, post].map((b) => ({ ...b, still: true }))

type State = 'Unchanged' | 'Added' | 'Modified' | '?'
const entry = (id: 'blog' | 'post', key: string, state: State, kind?: Field['kind']): Box => ({
  id: `e-${id}`,
  region: 'tracker',
  title: id === 'blog' ? 'Blog entry' : 'Post entry',
  fields: [
    { name: 'key', value: key },
    { name: 'State', value: state, kind: state === '?' ? 'muted' : kind },
  ],
})
const EMPTY: Box = { id: 'empty', region: 'tracker', title: 'no entries yet', kind: 'muted' }

const spec = (steps: Record<string, GraphStep>, code = CODE): GraphSpec => ({ regions: REGIONS, code, outputName: 'SaveChanges', steps })

/** Attach's real decisions. */
const blogReal = entry('blog', '5: set', 'Unchanged', 'ok')
const postReal = entry('post', '0: default', 'Added', 'ok')
const R = {
  blog: { boxes: [...GRAPH, blogReal], line: L.ATTACH },
  post: { boxes: [...GRAPH, blogReal, postReal], line: L.ATTACH },
} satisfies Record<string, GraphStep>

const SQL: OutLine[] = [
  { label: 'Posts', text: 'INSERT (the new post)', kind: 'ok' },
  { label: 'Blogs', text: 'no statement', kind: 'muted', still: true },
]

/** A claim: the blog's and the post's claimed states, each marked bad where it is wrong. */
const claim = (blogState: State, blogBad: boolean, postState: State, postBad: boolean) =>
  spec({
    blog: { boxes: [...GRAPH, entry('blog', '5', blogState, blogBad ? 'bad' : undefined)], line: L.ATTACH, bad: blogBad },
    post: {
      boxes: [...GRAPH, entry('blog', '5', blogState, blogBad ? 'bad' : undefined), entry('post', '0', postState, postBad ? 'bad' : undefined)],
      line: L.ATTACH,
      bad: postBad,
    },
  })
/** The paired reality: the step the claim gets wrong is the one marked. */
const reality = spec({ blog: R.blog, post: R.post })

const SPECS: Record<string, GraphSpec> = {
  setup: spec({
    graph: { boxes: [blog, post, EMPTY], line: L.GRAPH },
    attach: { boxes: [...GRAPH, entry('blog', '5', '?'), entry('post', '0', '?')], line: L.ATTACH },
  }),
  'attach-walk': spec(
    {
      call: { boxes: [blog, post, EMPTY], line: L.ATTACH },
      blog: R.blog,
      post: R.post,
      save: { boxes: [...GRAPH, { ...blogReal, still: true }, { ...postReal, still: true }], line: L.SAVE, output: SQL },
    },
    SAVE_CODE,
  ),

  'both-unchanged-claim': claim('Unchanged', false, 'Unchanged', true),
  'both-unchanged-reality': reality,
  'blog-modified-claim': claim('Modified', true, 'Added', false),
  'blog-modified-reality': reality,
  'both-added-claim': claim('Added', true, 'Added', false),
  'both-added-reality': reality,
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
