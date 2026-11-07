import { BoxGraph, type Box, type GraphSpec, type OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'var customer = await db.Customers',
  '    .Include(c => c.Orders)          // thousands of rows',
  '    .SingleAsync(c => c.Id == id);',
  'customer.PlaceOrder(cart);  // Orders.Add(…); Version++',
  'await db.SaveChangesAsync();',
]
const L = { LOAD: [0, 2] as [number, number], PLACE: 3, SAVE: 4 }
const OWN_CODE = [
  'var order = Order.Place(customerId, cart); // refers by id',
  'db.Orders.Add(order);',
  'await db.SaveChangesAsync();',
]
const LAZY_CODE = [
  'var customer = await db.Customers   // lazy loading on',
  '    .SingleAsync(c => c.Id == id);',
  'customer.PlaceOrder(cart);  // Orders.Add(…); Version++',
  'await db.SaveChangesAsync();',
]
const Z = { LOAD: [0, 1] as [number, number], PLACE: 2, SAVE: 3 }

const C1: SeqActor = { id: 'c1', name: 'Command 1', sub: 'place order', tone: 'ui' }
const C2: SeqActor = { id: 'c2', name: 'Command 2', sub: 'place order', tone: 'ui' }
const DB: SeqActor = { id: 'db', name: 'Database', tone: 'io' }

const spec = (steps: Record<string, SeqStep>, code: string[] = CODE, actors = [C1, C2, DB]): SeqSpec => ({ actors, code, outputName: 'Outcome', steps })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const out = (one: string, two: string, k1: OutLine['kind'] = 'plain', k2: OutLine['kind'] = 'plain'): OutLine[] => [
  { label: 'Command 1', text: one, kind: k1 },
  { label: 'Command 2', text: two, kind: k2 },
]

// ---- Reality: one aggregate ----
const load1 = msg('load1', 'c1', 'db', 'load + orders')
const load2 = msg('load2', 'c2', 'db', 'load + orders')
const place1 = note('place1', 'c1', 'add, v7→8')
const place2 = note('place2', 'c2', 'add, v7→8')
const save1 = msg('save1', 'c1', 'db', 'save if v7')
const won = note('won', 'db', '1 row: v8', 'ok')
const save2 = msg('save2', 'c2', 'db', 'save if v7')
const lost = msg('lost', 'db', 'c2', '0 rows', 'bad')

const LOADED = [load1, load2]
const PLACED = [...LOADED, place1, place2]
const SAVED1 = [...PLACED, save1, won]
const CONFLICT = [...SAVED1, save2, lost]
const THROWS = out('saved', 'DbUpdateConcurrencyException', 'ok', 'bad')

// ---- Own aggregate ----
const new1 = note('new1', 'c1', 'new Order', 'ok')
const new2 = note('new2', 'c2', 'new Order', 'ok')

// ---- Claims ----
const plainPlaced = [load1, load2, note('place1', 'c1', 'add order'), note('place2', 'c2', 'add order')]
const plainSaves = [...plainPlaced, msg('save1', 'c1', 'db', 'save'), msg('save2', 'c2', 'db', 'save')]
const lazyLoad1 = msg('load1', 'c1', 'db', 'load 42')
const lazyLoad2 = msg('load2', 'c2', 'db', 'load 42')
const hidden1 = msg('hidden1', 'c1', 'db', 'all orders', 'bad')
const hidden2 = msg('hidden2', 'c2', 'db', 'all orders', 'bad')
const TOUCHED = [lazyLoad1, lazyLoad2, place1, hidden1, place2, hidden2]
const reload = (kind?: SeqRow['kind']) => msg('reload', 'c2', 'db', 'reload all', kind)
const resave = msg('resave', 'c2', 'db', 'save if v8')

const SPECS: Record<string, SeqSpec> = {
  'one-aggregate': spec({
    load: { rows: LOADED, line: L.LOAD, output: out('v7 loaded', 'v7 loaded') },
    place: { rows: PLACED, line: L.PLACE, output: out('v7 → 8', 'v7 → 8') },
    'save-1': { rows: SAVED1, line: L.SAVE, output: out('saved', 'v7 → 8', 'ok') },
    'save-2': { rows: CONFLICT, line: L.SAVE, bad: true, output: THROWS },
  }),
  'own-aggregate': spec(
    {
      place: { rows: [new1, new2], line: 0, output: out('new order', 'new order') },
      save: {
        rows: [new1, new2, msg('ins1', 'c1', 'db', 'insert order'), msg('ins2', 'c2', 'db', 'insert order'), note('rows', 'db', '2 new rows', 'ok')],
        line: 2,
        output: out('saved', 'saved', 'ok', 'ok'),
      },
    },
    OWN_CODE,
  ),

  'token-claim': spec({
    load: { rows: plainPlaced, line: L.LOAD },
    save: { rows: [...plainSaves, note('no', 'db', 'no conflict')], line: L.SAVE, output: out('saved', 'saved') },
  }),
  'token-reality': spec({
    load: { rows: plainPlaced, line: L.LOAD },
    save: { rows: [...plainSaves, note('no', 'db', 'last write wins', 'bad')], line: L.SAVE, bad: true, output: out('saved', 'saved, overwrites 1', 'plain', 'bad') },
    cost: {
      rows: [...plainSaves, note('no', 'db', 'last write wins', 'bad')],
      line: L.LOAD,
      bad: true,
      output: [
        { label: 'Loading', text: 'still thousands of orders', kind: 'bad' },
        { label: 'Customer rules', text: 'unprotected', kind: 'bad' },
      ],
    },
  }),

  'lazy-claim': spec(
    {
      load: { rows: [lazyLoad1], line: Z.LOAD, output: [{ label: 'Loaded', text: 'customer row only' }] },
      touch: { rows: [lazyLoad1, note('later', 'c1', 'Orders: on first touch')], line: Z.LOAD, output: [{ label: 'Loaded', text: 'customer row only' }] },
    },
    LAZY_CODE,
    [C1, DB],
  ),
  'lazy-reality': spec(
    {
      load: { rows: [lazyLoad1, lazyLoad2], line: Z.LOAD, output: out('customer row', 'customer row') },
      touch: { rows: TOUCHED, line: Z.PLACE, bad: true, output: out('all orders loaded', 'all orders loaded', 'bad', 'bad') },
      save: {
        rows: [...TOUCHED, msg('save1', 'c1', 'db', 'save if v7'), won, save2, lost],
        line: Z.SAVE,
        bad: true,
        output: THROWS,
      },
    },
    LAZY_CODE,
  ),

  'retry-claim': spec({
    conflict: { rows: CONFLICT, line: L.SAVE, output: THROWS },
    retry: { rows: [...CONFLICT, reload(), resave], line: L.LOAD, output: out('saved', 'retrying') },
  }),
  'retry-reality': spec({
    conflict: { rows: CONFLICT, line: L.SAVE, output: THROWS },
    retry: { rows: [...CONFLICT, reload('bad')], line: L.LOAD, bad: true, output: out('saved', 'reloads all orders', 'ok', 'bad') },
    again: {
      rows: [...CONFLICT, reload('bad'), msg('next', 'c1', 'db', 'next: v8→9'), resave, msg('lost2', 'db', 'c2', '0 rows', 'bad')],
      line: L.SAVE,
      bad: true,
      output: out('saved twice', 'DbUpdateConcurrencyException again', 'ok', 'bad'),
    },
  }),
}

// ---- Setup: the aggregate as boxes ----
const customer: Box = { id: 'cust', region: 'agg', title: 'Customer 42', sub: 'aggregate root', fields: [{ name: 'Orders', value: 'thousands' }] }
const command = (n: 1 | 2): Box => ({ id: `cmd${n}`, region: 'cmds', title: `Command ${n}`, sub: 'place order', fields: [{ name: 'customer', value: '42', ref: 'cust' }] })
const SETUP: GraphSpec = {
  regions: [
    { id: 'cmds', name: 'Commands', sub: 'at the same time', tone: 'ui' },
    { id: 'agg', name: 'Customer aggregate', tone: 'pool' },
  ],
  outputName: 'Outcome',
  steps: {
    aggregate: { boxes: [customer], output: [{ label: 'Loading', text: 'slow' }] },
    together: {
      boxes: [command(1), command(2), { ...customer, still: true }],
      output: [
        { label: 'Loading', text: 'slow', still: true },
        { label: 'Saving', text: 'DbUpdateConcurrencyException, regularly' },
      ],
    },
  },
}

const drawing: QuestionDrawing = {
  setup: (p: StageDrawingProps) => <BoxGraph spec={SETUP} {...p} />,
  ...Object.fromEntries(Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />])),
}
export default drawing
