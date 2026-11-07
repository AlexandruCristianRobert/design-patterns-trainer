import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  '// each request, in its own DbContext:',
  'var item = await db.Items.SingleAsync(i => i.Id == id);',
  'item.Stock -= 1;',
  'await db.SaveChangesAsync();',
]
/** The same code plus the SQL it sends (only where the answer's mechanism is shown). */
const SQL_CODE = [
  ...CODE,
  '',
  '-- SingleAsync, outside any transaction:',
  'SELECT TOP(2) … FROM Items WHERE Id = @id;',
  '-- SaveChangesAsync, only the write:',
  'UPDATE Items SET Stock = @stock WHERE Id = @id;',
]
const L = { LOAD: 1, EDIT: 2, SAVE: 3, SELECT: 6, UPDATE: 8 }
const ATOMIC_CODE = [
  '// each request:',
  'await db.Items.Where(i => i.Id == id)',
  '    .ExecuteUpdateAsync(s => s.SetProperty(',
  '        i => i.Stock, i => i.Stock - 1));',
  '',
  '-- sends one statement:',
  'UPDATE Items SET Stock = Stock - 1 WHERE Id = @id;',
]

const actors: SeqActor[] = [
  { id: 'a', name: 'Request A', sub: 'own DbContext', tone: 'ui' },
  { id: 'db', name: 'SQL Server', sub: 'Items row', tone: 'io' },
  { id: 'b', name: 'Request B', sub: 'own DbContext', tone: 'pool' },
]
const spec = (steps: Record<string, SeqStep>, code = CODE): SeqSpec => ({ actors, code, outputName: 'The row in the database', steps })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind'], both?: boolean): SeqRow => ({ key, from, to, label, kind, both })
const stock = (value: string, kind?: OutLine['kind'], extra?: OutLine): OutLine[] => [{ label: 'Stock', text: value, kind }, ...(extra ? [extra] : [])]

// ---- Setup: no read results, no lock talk, no ordering between A and B ----
const setupRows = [note('a', 'a', 'load, Stock -= 1, save'), note('b', 'b', 'load, Stock -= 1, save')]

// ---- Reality: plain SELECTs, then UPDATEs that set a computed value ----
const selA = [msg('sel-a', 'a', 'db', 'SELECT: Stock 5', undefined, true), note('free-a', 'db', 'no lock kept')]
const selB = [msg('sel-b', 'b', 'db', 'SELECT: Stock 5', undefined, true)]
const reads = [...selA, ...selB]
const updA = [note('mem-a', 'a', 'Stock = 4 in memory'), msg('upd-a', 'a', 'db', 'UPDATE SET Stock = 4')]
const updB = [note('mem-b', 'b', 'Stock = 4 in memory'), msg('upd-b', 'b', 'db', 'UPDATE SET Stock = 4', 'bad')]
const lost = note('lost', 'db', 'one decrement lost', 'bad')

// Claims: neutral reads that say nothing about locks
const readA = msg('read-a', 'a', 'db', 'read: Stock 5', undefined, true)
const readB = msg('read-b', 'b', 'db', 'read: Stock 5', undefined, true)
const bothRead = [readA, readB]
const saveA4 = msg('save-a', 'a', 'db', 'save Stock = 4')

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    start: { rows: [note('a', 'a', 'starts'), note('b', 'b', 'starts')], line: null, output: stock('5') },
    run: { rows: setupRows, line: [1, 3], output: stock('?', 'muted') },
  }),
  'lost-update': spec(
    {
      'read-a': { rows: selA, line: L.SELECT, output: stock('5') },
      'read-b': { rows: reads, line: L.SELECT, output: stock('5') },
      'save-a': { rows: [...reads, ...updA], line: L.UPDATE, output: stock('4') },
      'save-b': { rows: [...reads, ...updA, ...updB], line: L.UPDATE, bad: true, output: stock('4') },
      result: { rows: [...reads, ...updA, ...updB, lost], line: L.UPDATE, bad: true, output: stock('4', 'bad', { label: 'decrements run', text: '2' }) },
    },
    SQL_CODE,
  ),
  atomic: spec(
    {
      'a-dec': { rows: [msg('dec-a', 'a', 'db', 'Stock - 1: now 4', 'ok')], line: 6, output: stock('4') },
      'b-dec': {
        rows: [msg('dec-a', 'a', 'db', 'Stock - 1: now 4', 'ok'), note('wait', 'b', "waits for A's row lock"), msg('dec-b', 'b', 'db', 'Stock - 1: now 3', 'ok')],
        line: 6,
        output: stock('3'),
      },
      result: {
        rows: [
          msg('dec-a', 'a', 'db', 'Stock - 1: now 4', 'ok'),
          note('wait', 'b', "waits for A's row lock"),
          msg('dec-b', 'b', 'db', 'Stock - 1: now 3', 'ok'),
          note('none', 'db', 'no decrement lost', 'ok'),
        ],
        line: 6,
        output: stock('3', 'ok', { label: 'decrements run', text: '2' }),
      },
    },
    ATOMIC_CODE,
  ),

  'blocks-claim': spec({
    'read-a': { rows: [readA], line: L.LOAD, output: stock('5') },
    'read-b': { rows: [readA, msg('read-b', 'b', 'db', 'read'), note('wait', 'b', "blocked until A commits")], line: L.LOAD, output: stock('5') },
    'commit-a': {
      rows: [readA, msg('read-b', 'b', 'db', 'read'), note('wait', 'b', "blocked until A commits"), saveA4, note('commit', 'db', 'A commits'), msg('got-b', 'db', 'b', 'Stock 4')],
      line: L.SAVE,
      output: stock('4'),
    },
    result: {
      rows: [readA, msg('read-b', 'b', 'db', 'read'), note('wait', 'b', "blocked until A commits"), saveA4, note('commit', 'db', 'A commits'), msg('got-b', 'db', 'b', 'Stock 4'), msg('save-b', 'b', 'db', 'save Stock = 3')],
      line: L.SAVE,
      output: stock('3', undefined, { label: 'every time', text: '3' }),
    },
  }),
  'blocks-reality': spec(
    {
      'read-a': { rows: selA, line: L.SELECT, output: stock('5') },
      'read-b': { rows: [...selA, msg('sel-b', 'b', 'db', 'SELECT: Stock 5, not blocked', 'bad', true)], line: L.SELECT, output: stock('5') },
      result: { rows: [...selA, msg('sel-b', 'b', 'db', 'SELECT: Stock 5, not blocked', 'bad', true), ...updA, ...updB], line: L.UPDATE, bad: true, output: stock('4', 'bad') },
    },
    SQL_CODE,
  ),

  'detect-claim': spec({
    reads: { rows: bothRead, line: L.LOAD, output: stock('5') },
    'save-a': { rows: [...bothRead, saveA4], line: L.SAVE, output: stock('4') },
    'save-b': {
      rows: [...bothRead, saveA4, msg('save-b', 'b', 'db', 'save Stock = 4'), note('detect', 'b', 'row changed: DbUpdateConcurrencyException')],
      line: L.SAVE,
      output: stock('4', undefined, { label: "B's save", text: 'throws' }),
    },
    result: {
      rows: [...bothRead, saveA4, msg('save-b', 'b', 'db', 'save Stock = 4'), note('detect', 'b', 'row changed: DbUpdateConcurrencyException')],
      line: L.SAVE,
      output: stock('3, or B gets an error'),
    },
  }),
  'detect-reality': spec(
    {
      reads: { rows: reads, line: L.SELECT, output: stock('5') },
      'save-a': { rows: [...reads, msg('upd-a', 'a', 'db', 'UPDATE … WHERE Id = @id'), msg('rows-a', 'db', 'a', '1 row affected')], line: L.UPDATE, output: stock('4') },
      'save-b': {
        rows: [...reads, msg('upd-a', 'a', 'db', 'UPDATE … WHERE Id = @id'), msg('rows-a', 'db', 'a', '1 row affected'), msg('upd-b', 'b', 'db', 'UPDATE … WHERE Id = @id'), msg('rows-b', 'db', 'b', '1 row affected: no exception', 'bad')],
        line: L.UPDATE,
        bad: true,
        output: stock('4', undefined, { label: "B's save", text: 'succeeds' }),
      },
      result: {
        rows: [...reads, msg('upd-a', 'a', 'db', 'UPDATE … WHERE Id = @id'), msg('rows-a', 'db', 'a', '1 row affected'), msg('upd-b', 'b', 'db', 'UPDATE … WHERE Id = @id'), msg('rows-b', 'db', 'b', '1 row affected: no exception', 'bad'), lost],
        line: L.UPDATE,
        bad: true,
        output: stock('4', 'bad', { label: "B's save", text: 'succeeds' }),
      },
    },
    SQL_CODE,
  ),

  'deadlock-claim': spec({
    reads: { rows: bothRead, line: L.LOAD, output: stock('5') },
    updates: { rows: [...bothRead, msg('upd-a', 'a', 'db', 'UPDATE'), msg('upd-b', 'b', 'db', 'UPDATE')], line: L.SAVE, output: stock('5') },
    deadlock: { rows: [...bothRead, msg('upd-a', 'a', 'db', 'UPDATE'), msg('upd-b', 'b', 'db', 'UPDATE'), note('dl', 'db', 'deadlock')], line: L.SAVE, output: stock('5') },
    victim: {
      rows: [...bothRead, msg('upd-a', 'a', 'db', 'UPDATE'), msg('upd-b', 'b', 'db', 'UPDATE'), note('dl', 'db', 'deadlock'), msg('victim', 'db', 'b', 'chosen as deadlock victim: error')],
      line: L.SAVE,
      output: stock('3, or one request gets an error'),
    },
  }),
  'deadlock-reality': spec(
    {
      reads: { rows: reads, line: L.SELECT, output: stock('5') },
      'update-a': { rows: [...reads, msg('upd-a', 'a', 'db', 'UPDATE SET Stock = 4'), note('x', 'db', 'row locked by A')], line: L.UPDATE, output: stock('5') },
      'update-b': {
        rows: [...reads, msg('upd-a', 'a', 'db', 'UPDATE SET Stock = 4'), note('x', 'db', 'row locked by A'), msg('upd-b', 'b', 'db', 'UPDATE SET Stock = 4'), note('wait', 'b', 'waits for the row: no cycle')],
        line: L.UPDATE,
        output: stock('5'),
      },
      result: {
        rows: [
          ...reads,
          msg('upd-a', 'a', 'db', 'UPDATE SET Stock = 4'),
          note('x', 'db', 'row locked by A'),
          msg('upd-b', 'b', 'db', 'UPDATE SET Stock = 4'),
          note('wait', 'b', 'waits for the row: no cycle'),
          note('commit', 'db', 'A commits, then B writes 4'),
          lost,
        ],
        line: L.UPDATE,
        bad: true,
        output: stock('4', 'bad', { label: 'errors', text: 'none' }),
      },
    },
    SQL_CODE,
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
