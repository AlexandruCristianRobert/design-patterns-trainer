import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'class Product {',
  '    public int Id { get; set; }',
  '    public decimal Price { get; set; }',
  '    [Timestamp] public byte[] Version { get; set; }',
  '}',
  '',
  '// each user, in its own DbContext:',
  'var p = await db.Products.FindAsync(42);',
  'p.Price = newPrice;',
  'await db.SaveChangesAsync();',
]
/** The same code, plus the UPDATE that SaveChangesAsync sends (only where the answer's mechanism is shown). */
const SQL_CODE = [...CODE, '', '-- what SaveChangesAsync sends:', 'UPDATE Products SET Price = @price', 'WHERE Id = 42 AND Version = @originalVersion;']
const L = { TOKEN: 3, LOAD: 7, EDIT: 8, SAVE: 9, WHERE: 13 }

const actors: SeqSpec['actors'] = [
  { id: 'a', name: 'User A', sub: 'own DbContext', tone: 'ui' },
  { id: 'db', name: 'SQL Server', sub: 'Products, row 42', tone: 'io' },
  { id: 'b', name: 'User B', sub: 'own DbContext', tone: 'pool' },
]
const spec = (steps: Record<string, SeqStep>, code = CODE): SeqSpec => ({ actors, code, outputName: 'Row 42 in the database', steps })

const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind'], both?: boolean): SeqRow => ({ key, from, to, label, kind, both })
const row = (price: string, version: string, b?: OutLine): OutLine[] => [
  { label: 'Price', text: price },
  { label: 'Version', text: version },
  ...(b ? [b] : []),
]
const before = row('10', '0x07D1')
const afterA = row('12', '0x07D2')

// ---- The Setup: no SQL, no locks, the second save's outcome unknown ----
const loadA = [msg('load-a', 'a', 'db', 'load product 42', undefined, true), note('orig-a', 'a', 'Price 10, Version 0x07D1')]
const loadB = [msg('load-b', 'b', 'db', 'load product 42', undefined, true), note('orig-b', 'b', 'Price 10, Version 0x07D1')]
const edits = [note('edit-a', 'a', 'Price = 12'), note('edit-b', 'b', 'Price = 15')]
const saveA = msg('save-a', 'a', 'db', 'SaveChangesAsync()')

// ---- Reality: plain SELECTs, the token in the UPDATE's WHERE clause ----
const selA = [msg('load-a', 'a', 'db', 'SELECT (no lock)', undefined, true), note('orig-a', 'a', 'original Version 0x07D1')]
const selB = [msg('load-b', 'b', 'db', 'SELECT (no lock)', undefined, true), note('orig-b', 'b', 'original Version 0x07D1')]
const updA = [msg('upd-a', 'a', 'db', 'UPDATE … WHERE Version = 0x07D1'), msg('rows-a', 'db', 'a', '1 row affected', 'ok')]
const updB = [msg('upd-b', 'b', 'db', 'UPDATE … WHERE Version = 0x07D1'), msg('rows-b', 'db', 'b', '0 rows affected', 'bad')]
const thrown = note('throw-b', 'b', 'throws a concurrency exception', 'bad')
const bThrows: OutLine = { label: "B's save", text: 'throws DbUpdateConcurrencyException', kind: 'bad' }

const R = {
  loadA: { rows: [...selA], line: L.LOAD, output: before },
  load: { rows: [...selA, ...selB], line: L.LOAD, output: before },
  saveA: { rows: [...selA, ...selB, ...updA], line: L.WHERE, output: afterA },
  saveB: { rows: [...selA, ...selB, ...updA, ...updB], line: L.WHERE, bad: true, output: afterA },
  throws: { rows: [...selA, ...selB, ...updA, ...updB, thrown], line: L.SAVE, bad: true, output: row('12', '0x07D2', bThrows) },
} satisfies Record<string, SeqStep>
const reality = (steps: Record<string, SeqStep>) => spec(steps, SQL_CODE)

// ---- Claims: neutral labels for what the claim does not speak about ----
const loadsBoth = [...loadA, ...loadB]
const lockRows = [msg('load-a', 'a', 'db', 'load product 42', undefined, true), note('lock', 'db', 'row locked for A')]

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    'load-a': { rows: loadA, line: L.LOAD, output: before },
    'load-b': { rows: loadsBoth, line: L.LOAD, output: before },
    edit: { rows: [...loadsBoth, ...edits], line: L.EDIT, output: before },
    'save-a': { rows: [...loadsBoth, ...edits, saveA], line: L.SAVE, output: afterA },
    'save-b': {
      rows: [...loadsBoth, ...edits, saveA, msg('save-b', 'b', 'db', 'SaveChangesAsync()'), note('q', 'db', '?', 'muted')],
      line: L.SAVE,
      output: row('12', '0x07D2', { label: "B's save", text: '?', kind: 'muted' }),
    },
  }),
  optimistic: reality({ load: R.load, 'save-a': R.saveA, 'save-b': R.saveB, throws: R.throws }),

  'lock-claim': spec({
    'load-a': { rows: lockRows, line: L.LOAD },
    'load-b': { rows: [...lockRows, msg('load-b', 'b', 'db', 'load product 42', undefined, true)], line: L.LOAD },
    'b-waits': {
      rows: [...lockRows, msg('load-b', 'b', 'db', 'load product 42', undefined, true), msg('save-b', 'b', 'db', 'SaveChangesAsync()'), note('wait', 'b', "waits for A's lock")],
      line: L.SAVE,
    },
    'a-ends': {
      rows: [
        ...lockRows,
        msg('load-b', 'b', 'db', 'load product 42', undefined, true),
        msg('save-b', 'b', 'db', 'SaveChangesAsync()'),
        note('wait', 'b', "waits for A's lock"),
        saveA,
        note('unlock', 'db', "A's transaction ends: lock released"),
        note('go', 'b', "B's save goes ahead"),
      ],
      line: L.SAVE,
    },
  }),
  'lock-reality': reality({
    'load-a': R.loadA,
    'load-b': R.load,
    'save-a': R.saveA,
    'save-b': { ...R.throws, line: L.WHERE },
  }),

  'select-first-claim': spec({
    load: { rows: loadsBoth, line: L.LOAD },
    'save-a': { rows: [...loadsBoth, msg('sel-a', 'a', 'db', 'SELECT Version → 0x07D1', undefined, true), msg('upd-a', 'a', 'db', 'UPDATE')], line: L.SAVE },
    'check-b': {
      rows: [
        ...loadsBoth,
        msg('sel-a', 'a', 'db', 'SELECT Version → 0x07D1', undefined, true),
        msg('upd-a', 'a', 'db', 'UPDATE'),
        msg('sel-b', 'b', 'db', 'SELECT Version → 0x07D2', undefined, true),
        note('diff', 'b', '0x07D2 differs from 0x07D1'),
      ],
      line: L.SAVE,
    },
    throws: {
      rows: [
        ...loadsBoth,
        msg('sel-a', 'a', 'db', 'SELECT Version → 0x07D1', undefined, true),
        msg('upd-a', 'a', 'db', 'UPDATE'),
        msg('sel-b', 'b', 'db', 'SELECT Version → 0x07D2', undefined, true),
        note('diff', 'b', '0x07D2 differs from 0x07D1'),
        note('throw-b', 'b', 'throws before sending the UPDATE', 'bad'),
      ],
      line: L.SAVE,
    },
  }),
  'select-first-reality': reality({ load: R.load, 'save-a': R.saveA, 'save-b': R.saveB, throws: R.throws }),

  'overwrite-claim': spec({
    load: { rows: loadsBoth, line: L.LOAD, output: before },
    'save-a': { rows: [...loadsBoth, msg('save-a', 'a', 'db', 'save Price = 12')], line: L.SAVE, output: afterA },
    'save-b': {
      rows: [...loadsBoth, msg('save-a', 'a', 'db', 'save Price = 12'), msg('save-b', 'b', 'db', 'save Price = 15'), note('over', 'db', "A's 12 overwritten")],
      line: L.SAVE,
      output: row('15', '0x07D3', { label: "B's save", text: 'succeeds' }),
    },
    warn: {
      rows: [...loadsBoth, msg('save-a', 'a', 'db', 'save Price = 12'), msg('save-b', 'b', 'db', 'save Price = 15'), note('over', 'db', "A's 12 overwritten"), note('warn', 'b', 'logs a warning, no exception')],
      line: L.SAVE,
      output: row('15', '0x07D3', { label: "B's save", text: 'succeeds, warning logged' }),
    },
  }),
  'overwrite-reality': reality({ load: R.load, 'save-a': R.saveA, 'save-b': R.saveB, throws: R.throws }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
