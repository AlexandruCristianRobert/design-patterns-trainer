import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'void Export(IEnumerable<Order> orders)',
  '{',
  '    log.Info($"{orders.Count()} orders");',
  '    foreach (var o in orders)',
  '        Write(o);',
  '}',
  '',
  'Export(db.Orders.Where(o => o.IsOpen));',
]
const FIXED = [
  'void Export(IReadOnlyCollection<Order> orders)',
  '{',
  '    log.Info($"{orders.Count} orders");',
  '    foreach (var o in orders)',
  '        Write(o);',
  '}',
  '',
  'Export(db.Orders.Where(o => o.IsOpen).ToList());',
]
const LONG = CODE.map((l, i) => (i === 2 ? '    log.Info($"{orders.LongCount()} orders");' : l))
const L = { SIG: 0, COUNT: 2, FOREACH: [3, 4] as [number, number], CALL: 7 }

const actors: SeqSpec['actors'] = [
  { id: 'caller', name: 'Caller', tone: 'ui' },
  { id: 'export', name: 'Export', tone: 'pool' },
  { id: 'db', name: 'Database', tone: 'io' },
]
const spec = (steps: Record<string, SeqStep>, code = CODE): SeqSpec => ({ actors, code, outputName: 'Afterwards', steps })

const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind'], both = false): SeqRow => ({ key, from, to, label, kind, both })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const out = (queries: string | null, log?: [string, OutLine['kind']?], written?: [string, OutLine['kind']?]): OutLine[] => [
  { label: 'DB queries', text: queries ?? '?', kind: queries === null ? 'muted' : undefined },
  ...(log ? [{ label: 'Log', text: log[0], kind: log[1] }] : []),
  ...(written ? [{ label: 'Written', text: written[0], kind: written[1] }] : []),
]

const pass = msg('pass', 'caller', 'export', 'Where query')
const deferred = note('deferred', 'export', 'not run yet', 'muted')
const select = (key: string, kind?: SeqRow['kind']) => msg(key, 'export', 'db', 'SELECT … WHERE IsOpen', kind, true)
const q1 = select('q1')
const counted = note('count', 'export', 'Count(): 3')
const q2 = select('q2', 'bad')
const writes = (n: number, kind?: SeqRow['kind']) => note('writes', 'export', `writes ${n}`, kind)
const COUNTED = [pass, q1, counted]

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    pass: { rows: [pass], line: L.CALL },
    count: { rows: [pass, note('count', 'export', 'Count()')], line: L.COUNT },
    foreach: { rows: [pass, note('count', 'export', 'Count()'), note('each', 'export', 'foreach')], line: L.FOREACH, output: out(null) },
  }),

  twice: spec({
    pass: { rows: [pass, deferred], line: L.CALL, output: out('0') },
    count: { rows: COUNTED, line: L.COUNT, output: out('1', ['3 orders']) },
    foreach: { rows: [...COUNTED, q2, writes(3)], line: L.FOREACH, output: out('2', ['3 orders'], ['3 orders']) },
    drift: {
      rows: [...COUNTED, note('drift', 'db', 'order 4 opened', 'muted'), q2, writes(4, 'bad')],
      line: L.FOREACH,
      output: out('2', ['3 orders'], ['4 orders', 'bad']),
    },
  }),
  fixed: spec(
    {
      materialize: { rows: [msg('q1', 'caller', 'db', 'SELECT … WHERE IsOpen', 'ok', true), msg('pass', 'caller', 'export', 'List: 3 orders')], line: L.CALL, output: out('1') },
      reuse: {
        rows: [msg('q1', 'caller', 'db', 'SELECT … WHERE IsOpen', 'ok', true), msg('pass', 'caller', 'export', 'List: 3 orders'), note('count', 'export', 'Count: property'), note('each', 'export', 'foreach: in memory'), writes(3)],
        line: [2, 4],
        output: out('1', ['3 orders'], ['3 orders', 'ok']),
      },
    },
    FIXED,
  ),

  'consumed-claim': spec({
    count: { rows: COUNTED, line: L.COUNT, output: out('1', ['3 orders']) },
    foreach: { rows: [...COUNTED, note('used', 'export', 'sequence used up', 'bad'), writes(0)], line: L.FOREACH, output: out('1', ['3 orders'], ['0 orders', 'bad']) },
  }),
  'consumed-reality': spec({
    count: { rows: COUNTED, line: L.COUNT, output: out('1', ['3 orders']) },
    foreach: { rows: [...COUNTED, q2, writes(3)], line: L.FOREACH, output: out('2', ['3 orders'], ['3 orders']) },
  }),

  'cached-claim': spec({
    count: { rows: [pass, q1, note('count', 'export', 'Count() stores rows', 'bad')], line: L.COUNT, output: out('1', ['3 orders']) },
    foreach: {
      rows: [pass, q1, note('count', 'export', 'Count() stores rows', 'bad'), note('reuse', 'export', 'foreach reuses them', 'bad'), writes(3)],
      line: L.FOREACH,
      output: out('1', ['3 orders'], ['3 orders']),
    },
  }),
  'cached-reality': spec({
    count: { rows: [pass, q1, note('count', 'export', 'Count(): 3, keeps no rows', 'ok')], line: L.COUNT, output: out('1', ['3 orders']) },
    foreach: { rows: [pass, q1, note('count', 'export', 'Count(): 3, keeps no rows', 'ok'), q2, writes(3)], line: L.FOREACH, output: out('2', ['3 orders'], ['3 orders']) },
  }),

  'throws-claim': spec({
    count: { rows: [pass, note('count', 'export', 'Count() throws', 'bad')], line: L.COUNT, bad: true, output: out('0', ['exception', 'bad']) },
    fix: { rows: [pass, note('count', 'export', 'LongCount() works')], code: LONG, line: L.COUNT, output: out(null, ['3 orders']) },
  }),
  'throws-reality': spec({
    count: { rows: COUNTED, line: L.COUNT, output: out('1', ['3 orders']) },
    fix: { rows: [pass, msg('q1', 'export', 'db', 'SELECT … WHERE IsOpen', undefined, true), note('count', 'export', 'LongCount(): 3'), q2, writes(3)], code: LONG, line: [2, 4], output: out('2', ['3 orders'], ['3 orders']) },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
