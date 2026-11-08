import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  '[ThreadStatic] static string? _correlationId;',
  '',
  'async Task Handle(Request r)',
  '{',
  '    _correlationId = r.Id;',
  '    await _db.SaveChangesAsync();',
  '    _log.Info(_correlationId);',
  '}',
]
const ASYNC_LOCAL_CODE = [
  'static readonly AsyncLocal<string?> _correlationId = new();',
  '',
  'async Task Handle(Request r)',
  '{',
  '    _correlationId.Value = r.Id;',
  '    await _db.SaveChangesAsync();',
  '    _log.Info(_correlationId.Value);',
  '}',
]
const L = { SET: 4, AWAIT: 5, LOG: 6 }

const REQS: Region = { id: 'req', name: 'Requests', tone: 'ui' }
const FIELD: Region = { id: 'field', name: 'Static field', tone: 'pool' }
const THREADS: Region = { id: 'thr', name: 'Pool threads', tone: 'pool' }
const CTX: Region = { id: 'ctx', name: 'Execution context', tone: 'io' }
const SAVED: Region = { id: 'ctx', name: 'Saved by the await', tone: 'io' }
const CPU: Region = { id: 'cpu', name: 'CPU cache and memory', tone: 'io' }

const spec = (regions: Region[], steps: Record<string, GraphStep>, code = CODE): GraphSpec => ({ regions, code, outputName: 'Log', steps })

const NAMES: Record<string, string> = { t7: 'Thread 7', t12: 'Thread 12', ui: 'UI thread' }
const req = (sub: string, fields: Field[], title = 'Request A', kind?: Box['kind']): Box => ({ id: 'a', region: 'req', title, sub, fields, kind })
const on = (t: string | null, kind?: Field['kind']): Field => (t ? { name: 'runs on', ref: t, value: NAMES[t], kind } : { name: 'runs on', value: '(no thread)', kind: 'muted' })
const thread = (id: string, value: string | null, sub?: string, kind?: Box['kind'], fieldKind?: Field['kind']): Box => ({
  id,
  region: 'thr',
  title: NAMES[id],
  sub,
  kind,
  fields: value === null ? [] : [{ name: '_correlationId', value, kind: fieldKind }],
})
const log = (text: string, kind?: OutLine['kind'], who = 'Request A'): OutLine[] => [{ label: who, text, kind }]

// Request A on Thread 7; Thread 12 holds the id an earlier request left behind.
const T12_OLD = thread('t12', '"B-42"', 'idle in the pool', 'muted')
const T7_SET = thread('t7', '"A-17"', 'runs the handler')
const T7_POOL = thread('t7', '"A-17"', 'back in the pool')
const SUSPENDED = req('suspended at the await', [on(null)])
const RESUMED_12 = req('resumed', [on('t12', 'bad')])
const T12_BAD = thread('t12', '"B-42"', 'runs the continuation', 'bad', 'bad')
const WRONG = log('"B-42"', 'bad')

const ec = (kind?: Box['kind']): Box => ({ id: 'ec', region: 'ctx', title: 'ExecutionContext', sub: 'Request A', fields: [{ name: '_correlationId', value: '"A-17"' }], kind })
/** The thread is named, not drawn: the point is the context arrow. */
const withCtx = (sub: string, t: string | null, ctxName = 'context', kind?: Field['kind']): Box =>
  req(sub, [t ? { name: 'runs on', value: NAMES[t] } : on(null), { name: ctxName, ref: 'ec', value: 'Request A', kind }])

const EC_NO_STATICS: Box = { id: 'ec', region: 'ctx', title: 'ExecutionContext', sub: 'AsyncLocal<T> values only', fields: [{ name: 'thread statics', value: 'not saved', kind: 'bad' }] }

const SPECS: Record<string, GraphSpec> = {
  setup: spec([REQS, FIELD], {
    set: {
      boxes: [req('handler running', [{ name: 'Id', value: '"A-17"' }, { name: 'writes', ref: 'f', value: '_correlationId' }]), { id: 'f', region: 'field', title: '_correlationId', sub: '[ThreadStatic]', fields: [{ name: 'value', value: '"A-17"' }] }],
      line: L.SET,
    },
    await: {
      boxes: [req('awaiting the save', [{ name: 'Id', value: '"A-17"' }]), { id: 'f', region: 'field', title: '_correlationId', sub: '[ThreadStatic]', fields: [{ name: 'value', value: '"A-17"' }] }],
      line: L.AWAIT,
    },
    log: {
      boxes: [req('after the await', [{ name: 'Id', value: '"A-17"' }, { name: 'reads', ref: 'f', value: '_correlationId' }]), { id: 'f', region: 'field', title: '_correlationId', sub: '[ThreadStatic]', fields: [{ name: 'value', value: '?', kind: 'muted' }] }],
      line: L.LOG,
    },
  }),

  hop: spec([REQS, THREADS], {
    set: { boxes: [req('handler running', [on('t7')]), T7_SET, T12_OLD], line: L.SET },
    await: { boxes: [SUSPENDED, T7_POOL, T12_OLD], line: L.AWAIT },
    resume: { boxes: [RESUMED_12, T7_POOL, T12_BAD], line: L.LOG, output: WRONG },
  }),
  asynclocal: spec(
    [REQS, CTX],
    {
      set: { boxes: [withCtx('handler running', 't7'), ec()], line: L.SET },
      await: { boxes: [withCtx('suspended at the await', null, 'captured'), ec()], line: L.AWAIT },
      resume: { boxes: [withCtx('resumed', 't12', 'context', 'ok'), ec('ok')], line: L.LOG, output: log('"A-17"', 'ok') },
    },
    ASYNC_LOCAL_CODE,
  ),

  'gc-claim': spec([REQS, THREADS], {
    pool: { boxes: [SUSPENDED, T7_POOL], line: L.AWAIT },
    reset: { boxes: [SUSPENDED, thread('t7', 'null', 'back in the pool', undefined)], line: L.AWAIT },
  }),
  'gc-reality': spec([REQS, THREADS], {
    keeps: { boxes: [SUSPENDED, thread('t7', '"A-17"', 'back in the pool', 'ok', 'ok')], line: L.AWAIT },
    reuse: {
      boxes: [req('resumed', [on('t7', 'bad')], 'Request B'), thread('t7', '"A-17"', 'runs B\'s continuation', 'bad', 'bad')],
      line: L.LOG,
      output: log('"A-17"', 'bad', 'Request B'),
    },
  }),

  'save-claim': spec([REQS, SAVED], {
    save: {
      boxes: [req('suspended at the await', [on(null), { name: 'saved', ref: 's', value: 'field value' }]), { id: 's', region: 'ctx', title: 'Saved value', fields: [{ name: '_correlationId', value: '"A-17"' }] }],
      line: L.AWAIT,
    },
    restore: {
      boxes: [
        req('resumed', [{ name: 'runs on', value: 'any thread' }, { name: 'restores', ref: 's', value: 'field value' }]),
        { id: 's', region: 'ctx', title: 'Saved value', fields: [{ name: '_correlationId', value: '"A-17"' }, { name: 'if', value: 'SyncContext ≠ null' }] },
      ],
      line: L.LOG,
    },
  }),
  'save-reality': spec([REQS, CTX, THREADS], {
    flows: {
      boxes: [req('suspended at the await', [on(null), { name: 'captured', ref: 'ec', value: 'ExecutionContext' }]), EC_NO_STATICS, T7_POOL],
      line: L.AWAIT,
    },
    resume: {
      boxes: [req('resumed', [{ name: 'runs on', value: 'Thread 12', kind: 'bad' }, { name: 'context', ref: 'ec', value: 'Request A' }]), EC_NO_STATICS, T7_POOL, T12_BAD],
      line: L.LOG,
      output: WRONG,
    },
    ui: {
      boxes: [req('resumed', [{ name: 'runs on', value: 'UI thread' }, { name: 'context', ref: 'ec', value: 'Request A' }]), EC_NO_STATICS, thread('ui', '"A-17"', 'same thread, same copy', 'ok')],
      line: L.LOG,
      output: log('"A-17", unless other UI work changed it'),
    },
  }),

  'cache-claim': spec([REQS, CPU], {
    stale: {
      boxes: [
        req('resumed', [{ name: 'reads', ref: 'c', value: 'cached copy' }]),
        { id: 'c', region: 'cpu', title: 'Cached copy', sub: 'in a CPU cache', fields: [{ name: '_correlationId', value: 'old value' }] },
        { id: 'm', region: 'cpu', title: 'Static field', sub: 'in memory', fields: [{ name: '_correlationId', value: '"A-17"' }] },
      ],
      line: L.LOG,
    },
    volatile: {
      boxes: [
        req('resumed', [{ name: 'reads', ref: 'm', value: 'volatile field' }]),
        { id: 'c', region: 'cpu', title: 'Cached copy', sub: 'in a CPU cache', kind: 'muted', fields: [{ name: '_correlationId', value: 'old value' }] },
        { id: 'm', region: 'cpu', title: 'Static field', sub: 'in memory', fields: [{ name: '_correlationId', value: '"A-17"' }] },
      ],
      line: L.LOG,
      output: log('"A-17"'),
    },
  }),
  'cache-reality': spec([REQS, THREADS], {
    barrier: { boxes: [req('resumed', [on('t12')]), thread('t7', '"A-17"', 'write visible', 'ok'), thread('t12', '"B-42"', 'runs the continuation')], line: L.LOG },
    slot: { boxes: [RESUMED_12, thread('t7', '"A-17"', 'not read', 'muted'), T12_BAD], line: L.LOG, output: WRONG },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
