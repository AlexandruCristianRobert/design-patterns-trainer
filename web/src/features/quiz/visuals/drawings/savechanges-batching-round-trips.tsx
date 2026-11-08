import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'for (var i = 1; i <= 1000; i++)',
  '    db.Orders.Add(new Order { Number = i });',
  '',
  'await db.SaveChangesAsync();',
]
const L = { ADD: [0, 1] as [number, number], SAVE: 3 }
const CLAIMED = [
  '// OnConfiguring',
  'options.UseSqlServer(connectionString)',
  '       .UseBatching();',
]
const TUNED = [
  '// OnConfiguring',
  'options.UseSqlServer(connectionString,',
  '    sql => sql.MaxBatchSize(1)); // batching off',
]

const actors: SeqSpec['actors'] = [
  { id: 'ef', name: 'EF Core', sub: 'SaveChangesAsync', tone: 'ui' },
  { id: 'db', name: 'SQL Server', sub: 'default settings', tone: 'io' },
]
const spec = (steps: Record<string, SeqStep>, code = CODE): SeqSpec => ({ actors, code, outputName: 'Round trips', steps })

const note = (key: string, label: string, kind?: SeqRow['kind'], at = 'ef'): SeqRow => ({ key, from: at, label, kind })
const trip = (key: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: 'ef', to: 'db', label, kind, both: true })
const out = (text: string, kind: OutLine['kind'] = 'plain'): OutLine[] => [{ label: 'INSERT commands', text, kind }]

const added = note('added', '1,000 Added')
const begin = trip('begin', 'BEGIN TRANSACTION')
const b1 = trip('b1', 'command 1: INSERT × 42 (rows 1–42)')
const b2 = trip('b2', 'command 2: INSERT × 42 (rows 43–84)')
const mid = trip('mid', 'commands 3 to 23', 'muted')
const b24 = trip('b24', 'command 24: INSERT × 34 (rows 967–1000)')
const commit = trip('commit', 'COMMIT', 'ok')
const BATCHED = [begin, b1, b2, mid, b24, commit]

const perRow = [trip('r1', 'INSERT row 1'), trip('r2', 'INSERT row 2'), trip('rmid', 'rows 3 to 999, one each', 'muted'), trip('r1000', 'INSERT row 1000')]

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    add: { rows: [note('added', '1,000 new orders')], line: L.ADD, output: out('?', 'muted') },
    save: { rows: [note('added', '1,000 new orders'), note('save', 'SaveChangesAsync()'), note('q', '?', 'muted', 'db')], line: L.SAVE, output: out('?', 'muted') },
  }),

  batched: spec({
    tracked: { rows: [added], line: L.SAVE, output: out('0') },
    begin: { rows: [added, begin], line: L.SAVE, output: out('0') },
    'batch-1': { rows: [added, begin, b1], line: L.SAVE, output: out('1') },
    'batch-2': { rows: [added, begin, b1, b2], line: L.SAVE, output: out('2') },
    rest: { rows: [added, ...BATCHED.slice(0, 5)], line: L.SAVE, output: out('24') },
    commit: { rows: [added, ...BATCHED], line: L.SAVE, output: out('24 for 1,000 rows', 'ok') },
  }),

  'per-row-claim': spec({
    begin: { rows: [added, begin], line: L.SAVE, output: out('0') },
    rows: { rows: [added, begin, ...perRow.map((r) => ({ ...r, kind: r.kind ?? ('bad' as const) })), trip('commit', 'COMMIT')], line: L.SAVE, output: out('1,000', 'bad') },
  }),
  'per-row-reality': spec({
    begin: { rows: [added, { ...begin, kind: 'ok' }], line: L.SAVE, output: out('0') },
    rows: { rows: [added, { ...begin, kind: 'ok' }, b1, b2, mid, b24, trip('commit', 'COMMIT', 'ok')], line: L.SAVE, output: out('24, not 1,000', 'ok') },
  }),

  'bulk-claim': spec({
    bulk: { rows: [added, trip('bulk', 'SqlBulkCopy: all 1,000 rows', 'bad')], line: L.SAVE, output: out('1', 'bad') },
  }),
  'bulk-reality': spec({
    bulk: { rows: [added, note('nobulk', 'no SqlBulkCopy', 'skip'), ...BATCHED], line: L.SAVE, output: out('24 ordinary INSERT batches', 'ok') },
  }),

  'switch-claim': spec({
    default: { rows: [added, ...perRow.map((r) => ({ ...r, kind: r.kind ?? ('bad' as const) }))], line: L.SAVE, output: out('1,000', 'bad') },
    switch: { rows: [note('switch', 'UseBatching(): batching on', 'bad')], code: CLAIMED, line: 2, output: out('batched') },
  }),
  'switch-reality': spec({
    default: { rows: [added, ...BATCHED], line: L.SAVE, output: out('24, batching on by default', 'ok') },
    switch: { rows: [note('nomethod', 'no UseBatching()', 'skip'), note('one', 'MaxBatchSize(1): 1 per command'), ...perRow], code: TUNED, line: 2, output: out('1,000, only when turned off') },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
