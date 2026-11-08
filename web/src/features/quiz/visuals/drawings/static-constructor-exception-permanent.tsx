import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const ACTORS: SeqActor[] = [
  { id: 'req', name: 'Requests', tone: 'ui' },
  { id: 'set', name: 'Settings', sub: 'static type', tone: 'pool' },
  { id: 'file', name: 'config.json', tone: 'io' },
]
const CODE = [
  'static class Settings',
  '{',
  '    public static readonly string Conn;',
  '',
  '    static Settings()',
  '    {',
  '        Conn = File.ReadAllText("config.json");',
  '    }',
  '}',
  '',
  'var conn = Settings.Conn;',
]
const L = { CTOR: [4, 7] as [number, number], READ: 6, USE: 10 }
const RETRY_CODE = [
  'static string? _conn;',
  '',
  'static string GetConn() =>',
  '    _conn ??= File.ReadAllText("config.json");',
  '',
  'var conn = GetConn();',
]

const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const spec = (steps: Record<string, SeqStep>, code = CODE): SeqSpec => ({ actors: ACTORS, code, steps })

const USE = row('use', 'req', 'uses Settings', 'set')
const READ = row('read', 'set', 'reads', 'file')
const MISSING = row('missing', 'file', 'missing', undefined, 'bad')
const RESTORED = row('back', 'file', 'restored', undefined, 'ok')

// ---- Setup: the stem's facts only; nothing about where the exception goes or what later uses get ----
const S_FIRST = [USE, READ, row('missing', 'file', 'missing'), row('throw', 'set', 'ctor throws')]

// ---- Reality ----
const FIRST = [USE, READ, MISSING, row('nf', 'file', 'not found', 'set', 'bad')]
const WRAP = [row('tie', 'set', 'init error', 'req', 'bad'), row('failed', 'set', 'marked failed', undefined, 'bad'), row('caught', 'req', 'caught', undefined, 'ok')]
const LATER = [row('use2', 'req', 'uses Settings', 'set'), row('skip', 'set', 'ctor not run', undefined, 'skip'), row('re', 'set', 'same error', 'req', 'bad')]

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    first: { rows: S_FIRST, line: L.READ },
    restored: { rows: [...S_FIRST, row('back', 'file', 'restored')], line: null },
    ask: { rows: [...S_FIRST, row('back', 'file', 'restored'), row('use2', 'req', 'later: uses it', 'set'), row('q', 'set', '?', undefined, 'muted')], line: L.USE },
  }),

  failed: spec({
    first: { rows: FIRST, line: L.READ, bad: true },
    wrap: { rows: [...FIRST, ...WRAP], line: L.USE, bad: true },
    restored: { rows: [...FIRST, ...WRAP, RESTORED], line: null },
    later: { rows: [...FIRST, ...WRAP, RESTORED, ...LATER], line: L.USE, bad: true },
    every: {
      rows: [...FIRST, ...WRAP, RESTORED, ...LATER, row('use3', 'req', 'uses Settings', 'set'), row('re3', 'set', 'same error', 'req', 'bad'), row('until', 'set', 'until restart', undefined, 'bad')],
      line: L.USE,
      bad: true,
    },
  }),
  retry: spec(
    {
      fail: {
        rows: [row('use', 'req', 'GetConn()', 'set'), READ, MISSING, row('err', 'set', 'throws', 'req', 'bad'), row('none', 'set', 'nothing stored', undefined, 'muted')],
        line: 3,
      },
      again: {
        rows: [
          row('use', 'req', 'GetConn()', 'set'),
          READ,
          MISSING,
          row('err', 'set', 'throws', 'req', 'bad'),
          row('none', 'set', 'nothing stored', undefined, 'muted'),
          RESTORED,
          row('use2', 'req', 'GetConn()', 'set'),
          row('read2', 'set', 'reads', 'file'),
          row('kept', 'set', 'value kept', undefined, 'ok'),
          row('val', 'set', 'value', 'req', 'ok'),
        ],
        line: [3, 5],
      },
    },
    RETRY_CODE,
  ),

  'rerun-claim': spec({
    next: { rows: [...S_FIRST, row('back', 'file', 'restored'), row('use2', 'req', 'uses Settings', 'set'), row('rerun', 'set', 'ctor runs again')], line: L.CTOR },
    ok: {
      rows: [...S_FIRST, row('back', 'file', 'restored'), row('use2', 'req', 'uses Settings', 'set'), row('rerun', 'set', 'ctor runs again'), row('read2', 'set', 'reads', 'file'), row('init', 'set', 'initialized')],
      line: L.READ,
    },
  }),
  'rerun-reality': spec({
    next: { rows: [...FIRST, ...WRAP, RESTORED, row('use2', 'req', 'uses Settings', 'set'), row('state', 'set', 'still failed', undefined, 'bad')], line: L.USE, bad: true },
    ok: {
      rows: [...FIRST, ...WRAP, RESTORED, row('use2', 'req', 'uses Settings', 'set'), row('state', 'set', 'still failed', undefined, 'bad'), row('noread', 'set', 'file not read', 'file', 'skip'), row('re', 'set', 'same error', 'req', 'bad')],
      line: L.USE,
      bad: true,
    },
  }),

  'defaults-claim': spec({
    defaults: { rows: [...S_FIRST, row('def', 'set', 'Conn = null')], line: 2 },
    continue: { rows: [...S_FIRST, row('def', 'set', 'Conn = null'), row('use2', 'req', 'uses Settings', 'set'), row('val', 'set', 'null, no error', 'req')], line: L.USE },
  }),
  'defaults-reality': spec({
    throws: { rows: [...FIRST, ...WRAP], line: L.USE, bad: true },
    every: { rows: [...FIRST, ...WRAP, ...LATER], line: L.USE, bad: true },
  }),

  'crash-claim': spec({
    uncatchable: { rows: [...S_FIRST, row('nocatch', 'req', 'cannot catch')], line: L.CTOR },
    crash: { rows: [...S_FIRST, row('nocatch', 'req', 'cannot catch'), row('end', 'req', 'process ends')], line: L.CTOR },
  }),
  'crash-reality': spec({
    caught: { rows: [...FIRST, ...WRAP, row('alive', 'req', 'process runs on', undefined, 'ok')], line: L.USE },
    type: { rows: [...FIRST, ...WRAP, row('alive', 'req', 'process runs on', undefined, 'ok'), ...LATER], line: L.USE, bad: true },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
