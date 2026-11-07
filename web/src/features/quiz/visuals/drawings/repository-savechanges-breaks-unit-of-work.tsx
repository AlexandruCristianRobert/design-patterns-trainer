import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const SHARED: SeqActor[] = [
  { id: 'handler', name: 'Handler', sub: 'PlaceOrder', tone: 'ui' },
  { id: 'repos', name: 'Repos', sub: 'Order, Stock', tone: 'pool' },
  { id: 'ctx', name: 'DbContext', sub: 'scoped', tone: 'muted' },
  { id: 'db', name: 'Database', tone: 'io' },
]
const SEPARATE: SeqActor[] = [
  { id: 'handler', name: 'Handler', sub: 'PlaceOrder', tone: 'ui' },
  { id: 'orders', name: 'OrderRepo', sub: 'own context', tone: 'pool' },
  { id: 'stock', name: 'StockRepo', sub: 'own context', tone: 'pool' },
  { id: 'db', name: 'Database', tone: 'io' },
]

const TWO_SAVES = [
  '// PlaceOrderHandler.Handle',
  'orders.Add(order);',
  'stock.Reserve(order);',
  '',
  '// OrderRepository.Add',
  'db.Orders.Add(order);',
  'db.SaveChanges();',
  '',
  '// StockRepository.Reserve',
  'var item = db.Stock.Single(s => s.Sku == order.Sku);',
  'item.Reserve(order.Quantity); // throws when too few are left',
  'db.SaveChanges();',
]
const T = { ADD: 1, RESERVE: 2, ADD_TRACK: 5, ADD_SAVE: 6, THROW: 10, RESERVE_SAVE: 11 }
const ONE_SAVE = [
  '// PlaceOrderHandler.Handle',
  'orders.Add(order);',
  'stock.Reserve(order);',
  'db.SaveChanges(); // once, for the whole use case',
  '',
  '// OrderRepository.Add',
  'db.Orders.Add(order);',
  '',
  '// StockRepository.Reserve',
  'var item = db.Stock.Single(s => s.Sku == order.Sku);',
  'item.Reserve(order.Quantity); // throws when too few are left',
]
const O = { ADD: 1, RESERVE: 2, SAVE: 3, TRACK: 6, THROW: 10 }
const DELETE = [
  '// PlaceOrderHandler.Handle',
  'orders.Add(order);           // SaveChanges inside',
  'try { stock.Reserve(order); } // SaveChanges inside',
  'catch (OutOfStockException)',
  '{',
  '    orders.Delete(order);    // SaveChanges inside',
  '    throw;',
  '}',
]
const CONTEXTS = [
  '// each repository creates its own DbContext',
  'db = contextFactory.CreateDbContext();',
  '',
  '// PlaceOrderHandler.Handle',
  'orders.Add(order);    // context 1: SaveChanges',
  'stock.Reserve(order); // context 2: SaveChanges',
]
const REORDER = ['// PlaceOrderHandler.Handle', 'stock.Reserve(order); // SaveChanges inside', 'orders.Add(order);    // SaveChanges inside']

const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const spec = (actors: SeqActor[], code: string[], steps: Record<string, SeqStep>): SeqSpec => ({ actors, code, outputName: 'Database', steps })

type K = OutLine['kind']
const state = (order: string, stock: string, kinds: [K?, K?] = []): OutLine[] => [
  { label: 'order', text: order, kind: order === '?' ? 'muted' : kinds[0] },
  { label: 'stock', text: stock, kind: stock === '?' ? 'muted' : kinds[1] },
]

// The shared context: one save per repository.
const add = msg('add', 'handler', 'repos', 'Add(order)')
const reserve = msg('reserve', 'handler', 'repos', 'Reserve(order)')
const tracked = msg('tracked', 'repos', 'ctx', 'order tracked as Added')
const save1 = msg('save1', 'repos', 'ctx', 'SaveChanges()')
const commit1 = msg('commit1', 'ctx', 'db', 'BEGIN · INSERT order · COMMIT')
const throws = note('throws', 'repos', 'Reserve throws', 'bad')
const twoSaves = [add, tracked, save1, commit1]

const SPECS: Record<string, SeqSpec> = {
  setup: spec(SHARED, TWO_SAVES, {
    calls: { rows: [add, reserve], line: { each: [T.ADD, T.RESERVE, T.ADD_SAVE, T.RESERVE_SAVE] }, output: state('?', '?') },
    failure: { rows: [add, reserve, note('fails', 'repos', 'fails', 'bad')], line: T.RESERVE, bad: true, output: state('saved', 'not reserved', ['bad']) },
  }),

  'two-saves': spec(SHARED, TWO_SAVES, {
    add: { rows: [add, tracked, save1], line: { each: [T.ADD_TRACK, T.ADD_SAVE] }, output: state('?', '?') },
    commit: { rows: twoSaves, line: T.ADD_SAVE, output: state('saved', '?') },
    reserve: {
      rows: [...twoSaves, reserve, throws, note('nosave', 'ctx', 'second SaveChanges: never runs', 'skip')],
      line: T.THROW,
      bad: true,
      output: state('saved', 'not reserved', ['bad']),
    },
  }),
  'one-save': spec(SHARED, ONE_SAVE, {
    track: { rows: [add, tracked], line: O.TRACK, output: state('not written yet', '?') },
    fail: {
      rows: [add, tracked, reserve, throws, note('nosave', 'handler', 'SaveChanges: never reached', 'skip')],
      line: O.THROW,
      output: state('not saved', 'not reserved', ['ok', 'ok']),
    },
    success: {
      rows: [
        add,
        tracked,
        reserve,
        msg('modified', 'repos', 'ctx', 'stock tracked as Modified'),
        msg('save', 'handler', 'ctx', 'SaveChanges(), once'),
        msg('commit', 'ctx', 'db', 'BEGIN · INSERT order · UPDATE stock · COMMIT', 'ok'),
      ],
      line: O.SAVE,
      output: state('saved', 'reserved', ['ok', 'ok']),
    },
  }),

  'delete-claim': spec(SHARED, DELETE, {
    catch: { rows: [...twoSaves, reserve, throws, note('catch', 'handler', 'catch the exception')], line: [2, 3], output: state('saved', 'not reserved') },
    delete: {
      rows: [...twoSaves, reserve, throws, note('catch', 'handler', 'catch the exception'), msg('delete', 'handler', 'repos', 'Delete(order)'), msg('del', 'ctx', 'db', 'DELETE order · COMMIT')],
      line: 5,
      output: state('removed', 'not reserved'),
    },
  }),
  'delete-reality': spec(SHARED, DELETE, {
    window: {
      rows: [...twoSaves, note('visible', 'db', 'order is a real row: others can read it', 'bad'), reserve, throws],
      line: { each: [1, 2] },
      output: state('saved, visible', 'not reserved', ['bad']),
    },
    'delete-fails': {
      rows: [...twoSaves, reserve, throws, msg('delete', 'handler', 'repos', 'Delete(order)'), msg('del', 'ctx', 'db', 'DELETE order: connection lost', 'bad')],
      line: 5,
      bad: true,
      output: state('still saved', 'not reserved', ['bad']),
    },
  }),

  'contexts-claim': spec(SEPARATE, CONTEXTS, {
    split: { rows: [msg('add', 'handler', 'orders', 'Add(order)'), msg('reserve', 'handler', 'stock', 'Reserve(order)')], line: [0, 1] },
    isolated: {
      rows: [
        msg('add', 'handler', 'orders', 'Add(order)'),
        msg('reserve', 'handler', 'stock', 'Reserve(order)'),
        note('fails', 'stock', 'a failure here…'),
        note('safe', 'orders', '…cannot affect these changes'),
      ],
      line: [4, 5],
    },
  }),
  'contexts-reality': spec(SEPARATE, CONTEXTS, {
    'two-tx': {
      rows: [msg('add', 'handler', 'orders', 'Add(order)'), msg('commit', 'orders', 'db', 'transaction 1: INSERT order · COMMIT')],
      line: 4,
      output: state('saved', '?'),
    },
    'still-saved': {
      rows: [
        msg('add', 'handler', 'orders', 'Add(order)'),
        msg('commit', 'orders', 'db', 'transaction 1: INSERT order · COMMIT'),
        msg('reserve', 'handler', 'stock', 'Reserve(order)'),
        note('fails', 'stock', 'Reserve throws', 'bad'),
      ],
      line: 5,
      bad: true,
      output: state('saved', 'not reserved', ['bad']),
    },
  }),

  'reorder-claim': spec(SHARED, REORDER, {
    swap: { rows: [msg('reserve', 'handler', 'repos', '1. Reserve(order)'), msg('add', 'handler', 'repos', '2. Add(order)')], line: [1, 2] },
    first: {
      rows: [msg('reserve', 'handler', 'repos', '1. Reserve(order)'), note('throws', 'repos', 'Reserve fails first'), note('none', 'db', 'nothing saved yet')],
      line: 1,
      output: state('not saved', 'not reserved'),
    },
  }),
  'reorder-reality': spec(SHARED, REORDER, {
    reserved: {
      rows: [msg('reserve', 'handler', 'repos', '1. Reserve(order)'), msg('save1', 'repos', 'ctx', 'SaveChanges()'), msg('commit1', 'ctx', 'db', 'BEGIN · UPDATE stock · COMMIT')],
      line: 1,
      output: state('?', 'reserved'),
    },
    'add-fails': {
      rows: [
        msg('reserve', 'handler', 'repos', '1. Reserve(order)'),
        msg('save1', 'repos', 'ctx', 'SaveChanges()'),
        msg('commit1', 'ctx', 'db', 'BEGIN · UPDATE stock · COMMIT'),
        msg('add', 'handler', 'repos', '2. Add(order)'),
        msg('save2', 'repos', 'ctx', 'SaveChanges()'),
        msg('fail', 'ctx', 'db', 'INSERT order: constraint fails', 'bad'),
      ],
      line: 2,
      bad: true,
      output: state('not saved', 'reserved, no order', [undefined, 'bad']),
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
