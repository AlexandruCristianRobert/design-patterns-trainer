import { BoxGraph, type Box, type GraphSpec, type OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'var tasks = sources.Select(async s =>',
  '{',
  '    var q = HttpContext.Request.Query["q"];',
  '    var n = await SearchAsync(s, q);',
  '    HttpContext.Items[s] = n;',
  '}).ToList();',
  'await Task.WhenAll(tasks);',
]
const L = { START: [0, 5] as [number, number], READ: 2, SEARCH: 3, WRITE: 4, WHENALL: 6 }
const FIX_CODE = [
  'var q = HttpContext.Request.Query["q"].ToString();',
  'var counts = await Task.WhenAll(',
  '    sources.Select(s => SearchAsync(s, q)));',
  'for (var i = 0; i < sources.Length; i++)',
  '    HttpContext.Items[sources[i]] = counts[i];',
]

// ---- Setup: the action and its three lambdas, no shared object drawn ----
const lambda = (s: 'a' | 'b' | 'c', still?: boolean): Box => ({
  id: s,
  region: 'lam',
  title: `lambda ${s}`,
  fields: [
    { name: 'reads', value: 'Query["q"]' },
    { name: 'awaits', value: 'search' },
    { name: 'writes', value: 'Items' },
  ],
  still,
})
const action = (fields: Box['fields'], still?: boolean): Box => ({ id: 'act', region: 'act', title: 'Action', fields, still })
const STARTS = [{ name: 'has', value: '3 lambdas' }]
const SETUP: GraphSpec = {
  regions: [
    { id: 'act', name: 'Action', tone: 'ui' },
    { id: 'lam', name: 'Lambdas', tone: 'pool' },
  ],
  steps: {
    lambdas: { boxes: [action(STARTS), { ...lambda('a'), fields: [] }, { ...lambda('b'), fields: [] }, { ...lambda('c'), fields: [] }] },
    body: { boxes: [action(STARTS, true), lambda('a'), lambda('b'), lambda('c')] },
    'when-all': { boxes: [action([...STARTS, { name: 'then', value: 'await Task.WhenAll' }]), lambda('a', true), lambda('b', true), lambda('c', true)] },
  },
}

// ---- Sequence stages ----
const ACT: SeqActor = { id: 'act', name: 'Action', tone: 'ui' }
const TA: SeqActor = { id: 'a', name: 'Task a', tone: 'pool' }
const TB: SeqActor = { id: 'b', name: 'Task b', tone: 'pool' }
const TC: SeqActor = { id: 'c', name: 'Task c', tone: 'pool' }
const CTX: SeqActor = { id: 'ctx', name: 'Context', tone: 'io' }
/** Four columns at most, so notes do not break mid-word at 390 px. */
const ACTORS = [TA, TB, TC, CTX]

const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const items = (text: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'Items', text, kind }]
const spec = (steps: Record<string, SeqStep>, code: string[] | undefined = CODE, actors = ACTORS): SeqSpec => ({ actors, code, outputName: 'Outcome', steps })

const reads = ['a', 'b', 'c'].map((t) => row(`r${t}`, t, 'read q', 'ctx'))
const STARTED = reads
const resumes = [row('ua', 'a', 'resumes'), row('uc', 'c', 'resumes')]
const writes = [row('wa', 'a', 'Items', 'ctx', 'bad'), row('wc', 'c', 'Items', 'ctx', 'bad'), row('same', 'ctx', 'same time', undefined, 'bad')]
const OVERLAP = [...resumes, ...writes]
const SERIAL_STARTED = [...['a', 'b', 'c'].map((t) => row(`s${t}`, 'act', 'start', t)), ...['a', 'b', 'c'].map((t) => row(`f${t}`, t, 'search'))]

const SPECS: Record<string, SeqSpec> = {
  shared: spec({
    start: { rows: STARTED, line: L.START, output: items('empty') },
    resume: { rows: [...STARTED, ...resumes], line: L.SEARCH, output: items('empty') },
    write: { rows: [...STARTED, ...OVERLAP], line: L.WRITE, bad: true, output: items('two writes at once', 'bad') },
    corrupt: { rows: [...STARTED, ...OVERLAP, row('broken', 'ctx', 'corrupt or throw', undefined, 'bad')], line: L.WRITE, bad: true, output: items('may be corrupted, or throws', 'bad') },
  }),
  fixed: spec(
    {
      read: { rows: [row('rq', 'act', 'read q', 'ctx'), row('local', 'act', 'q: local')], line: 0, output: items('empty') },
      search: {
        rows: [row('rq', 'act', 'read q', 'ctx'), row('local', 'act', 'q: local'), row('go', 'act', 'start 3', 'srch'), row('par', 'srch', 'in parallel, no context')],
        line: [1, 2],
        output: items('empty'),
      },
      write: {
        rows: [
          row('rq', 'act', 'read q', 'ctx'),
          row('local', 'act', 'q: local'),
          row('go', 'act', 'start 3', 'srch'),
          row('par', 'srch', 'in parallel, no context'),
          row('done', 'srch', 'counts', 'act'),
          row('w', 'act', 'Items × 3', 'ctx', 'ok'),
          row('one', 'ctx', 'one at a time', undefined, 'ok'),
        ],
        line: [3, 4],
        output: items('a, b, c written in turn', 'ok'),
      },
    },
    FIX_CODE,
    [ACT, { id: 'srch', name: 'Searches', sub: 'a, b, c', tone: 'pool' }, CTX],
  ),

  'context-claim': spec(
    {
      queue: { rows: ['a', 'b', 'c'].map((t) => row(`q${t}`, t, 'resume', 'sc')), line: L.SEARCH },
      serial: {
        rows: [...['a', 'b', 'c'].map((t) => row(`q${t}`, t, 'resume', 'sc')), row('r1', 'sc', 'run a', 'a'), row('r2', 'sc', 'then b', 'b'), row('r3', 'sc', 'then c', 'c')],
        line: L.WRITE,
        output: items('one write at a time'),
      },
    },
    CODE,
    [TA, TB, TC, { id: 'sc', name: 'SyncCtx', sub: 'one at a time', tone: 'muted' }],
  ),
  'context-reality': spec({
    none: { rows: reads, line: L.START, output: [{ label: 'SyncCtx', text: 'null' }] },
    pool: { rows: [...reads, ...OVERLAP], line: L.WRITE, bad: true, output: [{ label: 'SyncCtx', text: 'null' }, ...items('two writes at once', 'bad')] },
  }),

  'null-claim': spec({
    'is-null': { rows: ['a', 'b', 'c'].map((t) => row(`n${t}`, 'ctx', 'null', t)), line: L.READ },
    throw: {
      rows: [...['a', 'b', 'c'].map((t) => row(`n${t}`, 'ctx', 'null', t)), ...['a', 'b', 'c'].map((t) => row(`x${t}`, t, 'throws'))],
      line: L.READ,
      output: [{ label: 'result', text: 'NullReferenceException' }],
    },
  }),
  'null-reality': spec({
    same: { rows: ['a', 'b', 'c'].map((t) => row(`s${t}`, 'ctx', 'same', t, 'ok')), line: L.READ, output: [{ label: 'result', text: 'no null' }] },
    overlap: { rows: [...['a', 'b', 'c'].map((t) => row(`s${t}`, 'ctx', 'same', t)), ...OVERLAP], line: L.WRITE, bad: true, output: items('two writes at once', 'bad') },
  }),

  'serial-claim': spec(
    {
      a: { rows: [row('sa', 'act', 'start', 'a'), row('da', 'a', 'done', 'act')], line: L.WHENALL },
      bc: {
        rows: [row('sa', 'act', 'start', 'a'), row('da', 'a', 'done', 'act'), row('sb', 'act', 'start', 'b'), row('db', 'b', 'done', 'act'), row('sc', 'act', 'start', 'c'), row('dc', 'c', 'done', 'act')],
        line: L.WHENALL,
        output: items('one write at a time'),
      },
    },
    CODE,
    [{ ...ACT, sub: 'WhenAll' }, TA, TB, TC],
  ),
  'serial-reality': spec(
    {
      started: { rows: SERIAL_STARTED, line: L.START },
      wait: { rows: [...SERIAL_STARTED, row('wait', 'act', 'waits')], line: L.WHENALL },
      overlap: {
        rows: [...SERIAL_STARTED, row('wait', 'act', 'waits'), row('wa', 'a', 'writes Items', undefined, 'bad'), row('wc', 'c', 'writes Items', undefined, 'bad')],
        line: L.WRITE,
        bad: true,
        output: items('two writes at once', 'bad'),
      },
    },
    CODE,
    [ACT, TA, TB, TC],
  ),
}

const drawing: QuestionDrawing = {
  setup: (p: StageDrawingProps) => <BoxGraph spec={SETUP} {...p} />,
  ...Object.fromEntries(Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />])),
}
export default drawing
