import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const RYW_CODE = [
  '// after the save',
  'Response.Cookies.Append("lastWrite", lsn);',
  '// on each read',
  'var db = HasRecentWrite(Request) ? primary : replica;',
]
const W = { SAVE: 1, READ: 3 }
const DELAY_CODE = [
  'await profiles.SaveAsync(profile);  // primary',
  'await Task.Delay(500);',
  'return Redirect("/profile");',
]
const D = { SAVE: 0, DELAY: 1, REDIRECT: 2 }
const TX_CODE = [
  'using var tx = db.Database.BeginTransaction();',
  'await profiles.SaveAsync(profile);',
  '// … and the profile page reads in tx',
  'tx.Commit();',
]

const BROWSER: SeqActor = { id: 'user', name: 'Browser', tone: 'ui' }
const APP: SeqActor = { id: 'app', name: 'App', tone: 'pool' }
const PRIMARY: SeqActor = { id: 'primary', name: 'Primary', sub: 'writes', tone: 'io' }
const REPLICA: SeqActor = { id: 'replica', name: 'Replica', sub: 'async', tone: 'io' }
const CACHE: SeqActor = { id: 'cache', name: 'Cache', tone: 'muted' }
const ACTORS = [BROWSER, APP, PRIMARY, REPLICA]
const CACHE_ACTORS = [APP, CACHE, PRIMARY, REPLICA]

const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const page = (text: string | null, kind?: OutLine['kind']): OutLine[] => [{ label: 'city', text: text ?? 'not shown yet', kind: text === null ? 'muted' : kind }]
const spec = (steps: Record<string, SeqStep>, code?: string[], actors = ACTORS): SeqSpec => ({ actors, code, outputName: 'Profile page', steps })

const post = msg('post', 'user', 'app', 'POST')
const update = msg('update', 'app', 'primary', 'UPDATE city')
const committed = note('commit', 'primary', 'commit')
const redirect = msg('redirect', 'app', 'user', '303')
const get = msg('get', 'user', 'app', 'GET')
const select = msg('select', 'app', 'replica', 'SELECT')
const SAVE = [post, update, committed]
const READ = [...SAVE, redirect, get, select]
const bern = msg('result', 'replica', 'app', 'Bern', 'bad')
const behind = note('behind', 'replica', 'old data', 'bad')

// Read-your-writes.
const pos = msg('pos', 'primary', 'app', 'pos 42')
const cookie = msg('redirect', 'app', 'user', '303 + pos')
const getCookie = msg('get', 'user', 'app', 'GET + pos')
const toPrimary = msg('select', 'app', 'primary', 'SELECT', 'ok')
const zurich = msg('result', 'primary', 'app', 'Zurich', 'ok')
const RYW = [post, update, pos, cookie, getCookie, toPrimary, zurich]

// Transaction claim.
const begin = msg('update', 'app', 'primary', 'BEGIN, UPDATE')

// Cache stages (no browser column: the app's reads only).
const cUpdate = msg('update', 'app', 'primary', 'UPDATE city')
const miss = msg('miss', 'app', 'cache', 'get: miss')
const cSelect = msg('select', 'app', 'replica', 'SELECT')
const fillFrom = (city: string | null, kind?: SeqRow['kind']) => msg('store', 'app', 'cache', city === null ? 'store' : `store ${city}`, kind)

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    save: { rows: SAVE, output: page(null) },
    redirect: { rows: READ, output: page(null) },
    stale: { rows: [...READ, msg('result', 'replica', 'app', 'Bern')], output: page('Bern (sometimes)') },
  }),

  lag: spec({
    commit: { rows: [...SAVE, note('v1', 'replica', 'still Bern')], output: page(null) },
    read: { rows: [...READ, behind, bern], output: page('Bern', 'bad') },
    apply: { rows: [...READ, behind, bern, msg('repl', 'primary', 'replica', 'replicate'), note('applied', 'replica', 'Zurich')], output: page('Bern', 'bad') },
  }),
  ryw: spec(
    {
      save: { rows: [post, update, pos], line: W.SAVE, output: page(null) },
      cookie: { rows: [post, update, pos, cookie], line: W.SAVE, output: page(null) },
      route: { rows: RYW, line: W.READ, output: page('Zurich', 'ok') },
      others: { rows: [...RYW, note('others', 'app', 'others', 'muted'), msg('other', 'app', 'replica', 'SELECT', 'ok')], line: W.READ, output: page('Zurich', 'ok') },
    },
    RYW_CODE,
  ),

  'delay-claim': spec(
    {
      delay: { rows: [...SAVE, note('wait', 'app', 'wait 500 ms')], line: D.DELAY, output: page(null) },
      read: { rows: [...SAVE, note('wait', 'app', 'wait 500 ms'), redirect, get, select, note('caught', 'replica', 'caught up', 'bad'), msg('result', 'replica', 'app', 'Zurich', 'bad')], line: D.REDIRECT, bad: true, output: page('Zurich', 'bad') },
    },
    DELAY_CODE,
  ),
  'delay-reality': spec(
    {
      delay: { rows: [...SAVE, note('wait', 'app', 'wait 500 ms', 'bad')], line: D.DELAY, bad: true, output: page(null) },
      read: { rows: [...SAVE, note('wait', 'app', 'wait 500 ms'), redirect, get, select, note('behind', 'replica', 'lag > 500 ms', 'bad'), bern], line: D.REDIRECT, output: page('Bern', 'bad') },
    },
    DELAY_CODE,
  ),

  'tx-claim': spec(
    {
      tx: { rows: [post, begin, note('open', 'primary', 'tx open')], line: [0, 1], output: page(null) },
      read: { rows: [post, begin, note('open', 'primary', 'tx open'), redirect, get, msg('select', 'app', 'primary', 'SELECT in tx', 'bad'), msg('result', 'primary', 'app', 'Zurich', 'bad')], line: 2, bad: true, output: page('Zurich', 'bad') },
    },
    TX_CODE,
  ),
  'tx-reality': spec(
    {
      tx: { rows: [post, begin, note('open', 'primary', 'COMMIT'), note('end', 'app', 'req 1 ends', 'muted')], line: [0, 3], output: page(null) },
      read: {
        rows: [post, begin, note('open', 'primary', 'COMMIT'), note('end', 'app', 'req 1 ends', 'muted'), redirect, get, note('new', 'app', 'req 2: no tx', 'bad'), select, behind, bern],
        line: 2,
        bad: true,
        output: page('Bern', 'bad'),
      },
    },
    TX_CODE,
  ),

  'cache-claim': spec(
    {
      fill: { rows: [cUpdate, miss, cSelect, msg('result', 'replica', 'app', 'profile'), fillFrom(null)], output: page(null) },
      later: { rows: [cUpdate, miss, cSelect, msg('result', 'replica', 'app', 'profile'), fillFrom(null), msg('hit', 'app', 'cache', 'hit: Zurich', 'bad')], output: page('Zurich', 'bad') },
    },
    undefined,
    CACHE_ACTORS,
  ),
  'cache-reality': spec(
    {
      fill: { rows: [cUpdate, miss, cSelect, behind, bern, fillFrom('Bern', 'bad')], output: page('Bern', 'bad') },
      later: {
        rows: [cUpdate, miss, cSelect, behind, bern, fillFrom('Bern', 'bad'), note('applied', 'replica', 'Zurich'), msg('hit', 'app', 'cache', 'hit: Bern', 'bad')],
        output: [...page('Bern', 'bad'), { label: 'until', text: 'the entry expires', kind: 'bad' }],
      },
    },
    undefined,
    CACHE_ACTORS,
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
