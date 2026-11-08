import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { TableStage, type TableDef, type TableSpec, type TableStep, type TChip, type TRow } from '../TableStage'

const CODE = [
  'var product = new Product',
  '{',
  '    Id = id, Name = body.Name,',
  '    Price = body.Price, Stock = body.Stock,',
  '};',
  'db.Update(product);',
  'await db.SaveChangesAsync();',
]
const L = { MAP: [0, 4] as [number, number], UPDATE: 5, SAVE: 6 }
const LOAD_CODE = ['var product = await db.Products.FindAsync(id);', 'product.Price = body.Price;', 'await db.SaveChangesAsync();']
const LL = { LOAD: 0, EDIT: 1, SAVE: 2 }

/** The setup does not show original values: whether there are any is part of the question. */
const ENTITY_PLAIN: TableDef = { id: 'entity', name: 'product', sub: 'Product instance', tone: 'ui', columns: ['Property', 'Value'] }
const ENTITY: TableDef = { id: 'entity', name: 'product', sub: 'change tracker: values, state', tone: 'ui', columns: ['Property', 'Original', 'Value'] }
const DB: TableDef = { id: 'db', name: 'Products', sub: 'database', tone: 'io', columns: ['Id', 'Name', 'Price', 'Stock'] }

type Vals = [name: string, price: string, stock: string]
const PROPS = ['Name', 'Price', 'Stock']
const BODY: Vals = ['Lamp', '35', '12']

/** The entity state of a property, drawn beside its row. */
const state = (st: string): Pick<TRow, 'mark' | 'markKind'> => ({ mark: st, markKind: st === 'Modified' ? 'plain' : 'muted' })
/** Entity rows: original values (null: none), current values and one state per non-key property ('?' unknown). */
const entity = (orig: Vals | null, vals: Vals, states: string[], hot: string[] = []): TRow[] => [
  { key: 'Id', cells: ['Id', orig ? '7' : '—', '7'], kind: 'muted', ...state('key') },
  ...PROPS.map(
    (p, i): TRow => ({
      key: p,
      cells: [p, orig ? orig[i] : '—', vals[i]],
      kind: states[i] === '?' ? 'muted' : hot.includes(p) ? 'read' : 'plain',
      ...state(states[i]),
    }),
  ),
]
const plainEntity = (st: string): TRow[] => [
  { key: 'Id', cells: ['Id', '7'], kind: 'muted', ...state(st === '?' ? '?' : 'key') },
  ...PROPS.map((p, i): TRow => ({ key: p, cells: [p, BODY[i]], kind: st === '?' ? 'muted' : 'plain', ...state(st) })),
]
const all = (s: string) => [s, s, s]
const MOD = all('Modified')

type RowOpts = Pick<TRow, 'kind' | 'mark' | 'markKind'>
const row = (vals: Vals, o: RowOpts = {}, id = '7'): TRow => ({ key: id, cells: [id, ...vals], ...o })
const OTHERS: TRow[] = [row(['Desk', '120', '3'], {}, '5'), row(['Chair', '60', '8'], {}, '6')]

const chip = (key: string, label: string, kind: TChip['kind'] = 'run'): TChip => ({ key, label, kind })
const sql = (...lines: [string, OutLine['kind']?][]): OutLine[] =>
  lines.map(([text, kind], i) => ({ label: i === 0 ? 'SQL sent' : 'then', text, kind: text === '?' ? 'muted' : (kind ?? 'plain') }))
const UPDATE_ALL = 'UPDATE Products SET Name, Price, Stock WHERE Id = 7'
const UPDATE_PRICE = 'UPDATE Products SET Price WHERE Id = 7'
const SELECT = 'SELECT … FROM Products WHERE Id = 7'
const NOTHING = 'nothing yet'

const spec = (tables: TableDef[], steps: Record<string, TableStep>, code = CODE): TableSpec => ({ tables, code, outputName: 'Database calls', steps })
const T = [ENTITY, DB]

const START = row(['Lamp', '40', '12'])

/** The detached product, as the change tracker sees it before and after Update. */
const DETACHED = entity(null, BODY, all('Detached'))
const MODIFIED = entity(null, BODY, MOD, PROPS)

const SPECS: Record<string, TableSpec> = {
  setup: spec([ENTITY_PLAIN, DB], {
    map: { tables: { entity: plainEntity('Detached'), db: [START] }, line: L.MAP, output: sql([NOTHING]) },
    update: { tables: { entity: plainEntity('?'), db: [row(['?', '?', '?'], { kind: 'muted' })] }, line: [5, 6], output: sql(['?']) },
    question: { tables: { entity: plainEntity('?'), db: [row(['?', '?', '?'], { kind: 'muted' })] }, line: null, output: sql(['?']) },
  }),

  'update-all': spec(T, {
    other: { tables: { entity: DETACHED, db: [row(['Lamp', '40', '9'], { kind: 'read', mark: 'stock set by another user' })] }, line: L.MAP, output: sql([NOTHING]) },
    update: {
      tables: { entity: MODIFIED, db: [row(['Lamp', '40', '9'])] },
      chips: [chip('orig', 'no original values'), chip('all', 'all properties Modified')],
      line: L.UPDATE,
      output: sql([NOTHING]),
    },
    save: {
      tables: { entity: MODIFIED, db: [row(['Lamp', '35', '12'], { kind: 'bad', mark: 'other user’s 9 lost', markKind: 'bad' })] },
      chips: [chip('orig', 'no original values'), chip('all', 'all properties Modified')],
      line: L.SAVE,
      bad: true,
      output: sql([UPDATE_ALL, 'bad']),
    },
  }),
  'load-first': spec(
    T,
    {
      load: { tables: { entity: entity(['Lamp', '40', '9'], ['Lamp', '40', '9'], all('Unchanged')), db: [row(['Lamp', '40', '9'], { kind: 'read', mark: 'loaded' })] }, line: LL.LOAD, output: sql([SELECT]) },
      edit: {
        tables: { entity: entity(['Lamp', '40', '9'], ['Lamp', '35', '9'], ['Unchanged', 'Modified', 'Unchanged'], ['Price']), db: [row(['Lamp', '40', '9'])] },
        line: LL.EDIT,
        output: sql([SELECT]),
      },
      save: {
        tables: { entity: entity(['Lamp', '40', '9'], ['Lamp', '35', '9'], ['Unchanged', 'Modified', 'Unchanged'], ['Price']), db: [row(['Lamp', '35', '9'], { kind: 'hit', mark: 'stock 9 kept', markKind: 'ok' })] },
        line: LL.SAVE,
        output: sql([SELECT], [UPDATE_PRICE, 'ok']),
      },
    },
    LOAD_CODE,
  ),

  'compare-claim': spec(T, {
    update: { tables: { entity: entity(null, BODY, all('?')), db: [row(['Lamp', '40', '12'], { kind: 'bad', mark: 'read first', markKind: 'bad' })] }, line: L.UPDATE, bad: true, output: sql([SELECT, 'bad']) },
    compare: {
      tables: { entity: entity(null, BODY, ['Unchanged', 'Modified', 'Unchanged'], ['Price']), db: [START] },
      chips: [chip('cmp', 'compared with the row: only Price differs', 'bad')],
      line: L.UPDATE,
      bad: true,
      output: sql([SELECT, 'bad']),
    },
    save: {
      tables: { entity: entity(null, BODY, ['Unchanged', 'Modified', 'Unchanged'], ['Price']), db: [row(['Lamp', '35', '12'])] },
      chips: [chip('cmp', 'compared with the row: only Price differs', 'bad')],
      line: L.SAVE,
      bad: true,
      output: sql([SELECT, 'bad'], [UPDATE_PRICE, 'bad']),
    },
  }),
  'compare-reality': spec(T, {
    update: { tables: { entity: entity(null, BODY, all('?')), db: [START] }, chips: [chip('noq', 'Update sends no query', 'ok')], line: L.UPDATE, output: sql([NOTHING, 'ok']) },
    compare: { tables: { entity: MODIFIED, db: [START] }, chips: [chip('noq', 'Update sends no query', 'ok'), chip('all', 'no snapshot: all Modified')], line: L.UPDATE, output: sql([NOTHING, 'ok']) },
    save: { tables: { entity: MODIFIED, db: [row(['Lamp', '35', '12'], { kind: 'hit', mark: 'all columns written' })] }, chips: [chip('noq', 'Update sends no query', 'ok'), chip('all', 'no snapshot: all Modified')], line: L.SAVE, output: sql([UPDATE_ALL, 'ok']) },
  }),

  'throws-claim': spec(T, {
    new: { tables: { entity: DETACHED, db: [START] }, line: L.MAP, output: sql([NOTHING]) },
    update: { tables: { entity: DETACHED, db: [START] }, chips: [chip('ex', 'throws InvalidOperationException', 'bad')], line: L.UPDATE, bad: true, output: sql([NOTHING]) },
  }),
  'throws-reality': spec(T, {
    new: { tables: { entity: DETACHED, db: [START] }, line: L.MAP, output: sql([NOTHING]) },
    update: { tables: { entity: MODIFIED, db: [START] }, chips: [chip('ok', 'attached, no exception', 'ok')], line: L.UPDATE, output: sql([NOTHING]) },
    save: { tables: { entity: MODIFIED, db: [row(['Lamp', '35', '12'], { kind: 'hit', mark: 'updated' })] }, chips: [chip('ok', 'attached, no exception', 'ok')], line: L.SAVE, output: sql([UPDATE_ALL, 'ok']) },
  }),

  'upsert-claim': spec(T, {
    missing: { tables: { entity: DETACHED, db: OTHERS }, chips: [chip('none', 'no row with Id 7')], line: L.MAP, output: sql([NOTHING]) },
    update: { tables: { entity: entity(null, BODY, all('?')), db: OTHERS }, chips: [chip('none', 'no row with Id 7')], line: L.UPDATE, output: sql([NOTHING]) },
    save: {
      tables: { entity: entity(null, BODY, all('?')), db: [...OTHERS, row(BODY, { kind: 'bad', mark: 'inserted', markKind: 'bad' })] },
      chips: [chip('none', 'no row with Id 7')],
      line: L.SAVE,
      bad: true,
      output: sql(['INSERT INTO Products … VALUES (7, …)', 'bad']),
    },
  }),
  'upsert-reality': spec(T, {
    missing: { tables: { entity: DETACHED, db: OTHERS }, chips: [chip('none', 'no row with Id 7')], line: L.MAP, output: sql([NOTHING]) },
    update: { tables: { entity: MODIFIED, db: OTHERS }, chips: [chip('none', 'no row with Id 7'), chip('plan', 'plans an UPDATE')], line: L.UPDATE, output: sql([NOTHING]) },
    save: {
      tables: { entity: MODIFIED, db: OTHERS },
      chips: [chip('none', 'no row with Id 7'), chip('plan', 'plans an UPDATE'), chip('ex', 'DbUpdateConcurrencyException', 'bad')],
      line: L.SAVE,
      bad: true,
      output: [
        { label: 'SQL sent', text: 'UPDATE Products SET Name, Price, Stock WHERE Id = 7', kind: 'plain' },
        { label: 'Result', text: '0 rows affected', kind: 'bad' },
      ],
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <TableStage spec={s} {...p} />]),
)
export default drawing
