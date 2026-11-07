import { BoxGraph, type Box, type FieldKind, type GraphSpec, type GraphStep, type OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  '// db tracks product (Id 1), loaded with Price 10',
  'await db.Products',
  '    .Where(p => p.Id == product.Id)',
  '    .ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, 12m));',
  'Console.WriteLine(product.Price);',
]
const RELOAD_CODE = [...CODE.slice(0, 4), 'await db.Entry(product).ReloadAsync();', 'Console.WriteLine(product.Price);']
const QUEUED_CODE = [...CODE, '', '// later:', 'await db.SaveChangesAsync();']
const L = { TRACKED: 0, UPDATE: [1, 3] as [number, number], PRINT: 4, RELOAD: 4, RPRINT: 5, SAVE: 7 }

const regions: GraphSpec['regions'] = [
  { id: 'ctx', name: 'DbContext', sub: 'change tracker', tone: 'ui' },
  { id: 'db', name: 'Database', sub: 'Products table', tone: 'io' },
]

/** The tracked instance and the row; a value of "?" is drawn as unknown. */
const tracked = (price: string, kind?: FieldKind, extra: Box['fields'] = []): Box => ({
  id: 'product',
  region: 'ctx',
  title: 'product',
  sub: 'tracked entity',
  fields: [
    { name: 'Id', value: '1' },
    { name: 'Price', value: price, kind: price === '?' ? 'muted' : kind },
    ...extra,
  ],
})
const dbRow = (price: string, kind?: FieldKind): Box => ({
  id: 'row',
  region: 'db',
  title: 'row Id 1',
  fields: [
    { name: 'Id', value: '1' },
    { name: 'Price', value: price, kind: price === '?' ? 'muted' : kind },
  ],
})
const queue: Box = { id: 'queue', region: 'ctx', title: 'pending', sub: 'the claim', kind: 'bad', fields: [{ name: 'UPDATE', value: 'Price = 12', kind: 'bad' }] }

const SQL = 'UPDATE Products SET Price = 12 WHERE Id = 1'
const out = (sql: string, console: string, sqlKind?: OutLine['kind'], consoleKind?: OutLine['kind']): OutLine[] => [
  { label: 'SQL sent', text: sql, kind: sql === '?' ? 'muted' : sqlKind },
  { label: 'Console', text: console, kind: console === '?' ? 'muted' : consoleKind },
]
const spec = (steps: Record<string, GraphStep>, code = CODE): GraphSpec => ({ regions, code, outputName: 'Run', steps })

/** The real run, step by step. */
const R = {
  sql: { boxes: [tracked('10'), dbRow('12', 'ok')], line: L.UPDATE, output: out(SQL, '…', 'ok') },
  tracker: { boxes: [tracked('10 (stale)', 'bad'), dbRow('12', 'ok')], line: L.UPDATE, output: out(SQL, '…', 'ok') },
  print: { boxes: [tracked('10 (stale)', 'bad'), dbRow('12', 'ok')], line: L.PRINT, output: out(SQL, '10', 'ok', 'ok') },
} satisfies Record<string, GraphStep>

const SPECS: Record<string, GraphSpec> = {
  setup: spec({
    tracked: { boxes: [tracked('10'), dbRow('10')], line: L.TRACKED, output: out('…', '…') },
    update: { boxes: [tracked('?'), dbRow('?')], line: L.UPDATE, output: out('?', '…') },
    print: { boxes: [tracked('?'), dbRow('?')], line: L.PRINT, output: out('?', '?') },
  }),
  execute: spec(R),
  reload: spec(
    {
      reload: { boxes: [tracked('12', 'ok'), dbRow('12', 'ok')], line: L.RELOAD, output: out('SELECT … WHERE Id = 1', '…', 'ok') },
      print: { boxes: [tracked('12', 'ok'), dbRow('12', 'ok')], line: L.RPRINT, output: out('SELECT … WHERE Id = 1', '12', 'ok', 'ok') },
    },
    RELOAD_CODE,
  ),

  'fixup-claim': spec({
    sql: R.sql,
    fixup: { boxes: [tracked('12', 'bad'), dbRow('12', 'ok')], line: L.UPDATE, bad: true, output: out(SQL, '…', 'ok') },
    print: { boxes: [tracked('12', 'bad'), dbRow('12', 'ok')], line: L.PRINT, bad: true, output: out(SQL, '12', 'ok', 'bad') },
  }),
  'fixup-reality': spec({ sql: R.sql, fixup: R.tracker, print: R.print }),

  'queued-claim': spec(
    {
      queue: { boxes: [tracked('10'), queue, dbRow('10')], line: L.UPDATE, bad: true, output: out('nothing yet', '…', 'bad') },
      print: { boxes: [tracked('10'), queue, dbRow('10')], line: L.PRINT, output: out('nothing yet', '10', 'bad') },
      save: { boxes: [tracked('10'), dbRow('12', 'bad')], line: L.SAVE, bad: true, output: out(SQL, '10', 'bad') },
    },
    QUEUED_CODE,
  ),
  'queued-reality': spec(
    {
      queue: R.sql,
      print: R.print,
      save: { ...R.print, boxes: [tracked('10 (stale)', 'bad', [{ name: 'State', value: 'Unchanged' }]), dbRow('12', 'ok')], line: L.SAVE, output: [...out(SQL, '10', 'ok', 'ok'), { label: 'SaveChanges', text: 'nothing to send', kind: 'ok' }] },
    },
    QUEUED_CODE,
  ),

  'throws-claim': spec({
    run: { boxes: [tracked('10'), dbRow('10')], line: L.UPDATE, bad: true, output: [{ label: 'Exception', text: 'entity already tracked', kind: 'bad' }, { label: 'Console', text: '…' }] },
    print: { boxes: [tracked('10'), dbRow('10')], line: L.PRINT, bad: true, output: [{ label: 'Exception', text: 'entity already tracked', kind: 'bad' }, { label: 'Console', text: 'nothing', kind: 'bad' }] },
  }),
  'throws-reality': spec({ run: R.sql, print: R.print }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
