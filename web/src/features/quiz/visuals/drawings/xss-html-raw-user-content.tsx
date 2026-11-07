import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const PAGE = ['@* Profile.cshtml *@', '<div class="bio">@Html.Raw(Model.Bio)</div>']
const ENCODE = ['@* Profile.cshtml *@', '<div class="bio">@Model.Bio</div>']
const SANITIZE = ['@* Profile.cshtml, allow-list: b, i, p *@', '<div class="bio">@Html.Raw(sanitizer.Sanitize(Model.Bio))</div>']
const BLOCKLIST = [
  '// when the bio is saved',
  'if (bio.Contains("<script>")) return BadRequest();',
  '',
  ...PAGE,
]
const B = { CHECK: 1, RENDER: 4 }

const SERVER: SeqActor = { id: 'server', name: 'Server', sub: 'Razor page', tone: 'ui' }
const VISITOR: SeqActor = { id: 'visitor', name: 'Visitor', sub: 'browser', tone: 'pool' }
const USER: SeqActor = { id: 'author', name: 'User', sub: 'bio author', tone: 'muted' }
const ATTACKER: SeqActor = { id: 'author', name: 'Attacker', sub: 'bio author', tone: 'bad' }

const spec = (steps: Record<string, SeqStep>, code = PAGE, actors = [ATTACKER, SERVER, VISITOR]): SeqSpec => ({ actors, code, outputName: 'Profile page', steps })
const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })

const PAYLOAD = '<b>Hi</b><img src=x onerror=alert(1)>'
const ENCODED = '&lt;b&gt;Hi&lt;/b&gt;&lt;img src=x onerror=alert(1)&gt;'
const out = (bio: string, html: string, htmlKind?: OutLine['kind'], seen?: string, seenKind?: OutLine['kind']): OutLine[] => [
  { label: 'Stored bio', text: bio, still: true },
  { label: 'HTML sent', text: html, kind: html === '?' ? 'muted' : htmlKind },
  ...(seen ? [{ label: 'Visitor', text: seen, kind: seenKind }] : []),
]

const save = row('save', 'author', 'save bio', 'server')
const stored = row('stored', 'server', 'stored')
const open = row('open', 'visitor', 'open profile', 'server')
const page = (kind?: SeqRow['kind'], label = 'page') => row('page', 'server', label, 'visitor', kind)
const runs = row('runs', 'visitor', 'script runs', undefined, 'bad')
const SENT = [save, stored, open]

/** The real run with the payload, step by step. */
const R = {
  save: { rows: [save, stored], line: null, output: [{ label: 'Stored bio', text: PAYLOAD, kind: 'bad' as const }] },
  render: { rows: [...SENT, page('bad', 'raw HTML')], line: 1, bad: true, output: out(PAYLOAD, PAYLOAD, 'bad') },
  runs: { rows: [...SENT, page('bad', 'raw HTML'), runs], line: 1, bad: true, output: out(PAYLOAD, PAYLOAD, 'bad', 'onerror script runs', 'bad') },
} satisfies Record<string, SeqStep>

const SPECS: Record<string, SeqSpec> = {
  setup: spec(
    {
      save: { rows: [save, stored], line: null, output: [{ label: 'Stored bio', text: '<b>Hi</b> …' }] },
      render: { rows: [save, stored, open, page()], line: 1, output: out('<b>Hi</b> …', '?') },
      question: { rows: [save, stored, open, page()], line: 1, output: [...out('<b>Hi</b> …', '?'), { label: 'Risk', text: '?', kind: 'muted' }] },
    },
    PAGE,
    [USER, SERVER, VISITOR],
  ),
  raw: spec(R),
  fix: spec({
    encode: { rows: [...SENT, page('ok', 'encoded')], line: 1, code: ENCODE, output: out(PAYLOAD, ENCODED, 'ok', 'the tags as text', 'ok') },
    sanitize: { rows: [...SENT, page('ok', 'sanitized')], line: 1, code: SANITIZE, output: out(PAYLOAD, '<b>Hi</b>', 'ok', 'bold “Hi”, no script', 'ok') },
  }),

  'blocklist-claim': spec(
    {
      reject: {
        rows: [row('save', 'author', 'save <script>…', 'server'), row('stored', 'server', 'rejected', undefined, 'ok')],
        line: B.CHECK,
        output: [{ label: 'Stored bio', text: 'nothing (rejected)', kind: 'ok' }],
      },
      closed: {
        rows: [row('save', 'author', 'save <script>…', 'server'), row('stored', 'server', 'rejected', undefined, 'ok'), row('safe', 'visitor', 'no script can run', undefined, 'bad')],
        line: B.CHECK,
        bad: true,
        output: [{ label: 'Stored bio', text: 'nothing (rejected)', kind: 'ok' }, { label: 'Hole', text: 'closed', kind: 'bad' }],
      },
    },
    BLOCKLIST,
  ),
  'blocklist-reality': spec(
    {
      reject: {
        rows: [row('save', 'author', 'save <script>…', 'server'), row('stored', 'server', 'rejected', undefined, 'ok')],
        line: B.CHECK,
        output: [{ label: 'Stored bio', text: 'nothing (rejected)', kind: 'ok' }],
      },
      closed: {
        rows: [row('save', 'author', 'save <img onerror>', 'server'), row('stored', 'server', 'no <script>: stored', undefined, 'bad'), open, page('bad', 'raw HTML'), runs],
        line: B.RENDER,
        bad: true,
        output: out(PAYLOAD, PAYLOAD, 'bad', 'onerror script runs', 'bad'),
      },
    },
    BLOCKLIST,
  ),

  'httponly-claim': spec({
    cookie: { rows: [...SENT, page('bad', 'raw HTML'), runs, row('read', 'visitor', 'cookie: hidden', undefined, 'ok')], line: 1, output: [{ label: 'Session cookie', text: 'HttpOnly' }] },
    safe: {
      rows: [...SENT, page('bad', 'raw HTML'), runs, row('read', 'visitor', 'cookie: hidden', undefined, 'ok'), row('harm', 'visitor', 'no real harm', undefined, 'bad')],
      line: 1,
      output: [{ label: 'Session cookie', text: 'HttpOnly' }, { label: 'Risk', text: 'none', kind: 'bad' }],
    },
  }),
  'httponly-reality': spec({
    cookie: { rows: [...SENT, page('bad', 'raw HTML'), runs, row('read', 'visitor', 'cookie: hidden', undefined, 'ok')], line: 1, output: [{ label: 'Session cookie', text: 'HttpOnly' }] },
    safe: {
      rows: [...SENT, page('bad', 'raw HTML'), runs, row('read', 'visitor', 'cookie: hidden', undefined, 'ok'), row('harm', 'visitor', 'API call + cookie', 'server', 'bad'), row('leak', 'visitor', 'page data sent out', undefined, 'bad')],
      line: 1,
      bad: true,
      output: [{ label: 'Session cookie', text: 'HttpOnly, still sent' }, { label: 'Risk', text: 'acts as the visitor', kind: 'bad' }],
    },
  }),

  'encode-claim': spec({
    render: { rows: [...SENT, page('bad', 'encoded')], line: 1, bad: true, output: out(PAYLOAD, ENCODED, 'bad') },
    safe: { rows: [...SENT, page('bad', 'encoded'), row('text', 'visitor', 'shows text', undefined, 'bad')], line: 1, bad: true, output: out(PAYLOAD, ENCODED, 'bad', 'the tags as text', 'bad') },
  }),
  'encode-reality': spec({ render: R.render, safe: R.runs }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
