import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const ANEMIC = ['public class Order', '{', '    public OrderStatus Status { get; set; }', '    public DateTime? PaidAt { get; set; }', '}']
const RICH = [
  'public class Order',
  '{',
  '    public OrderStatus Status { get; private set; }',
  '    public DateTime? PaidAt { get; private set; }',
  '',
  '    public void Ship()',
  '    {',
  '        if (PaidAt is null)',
  '            throw new InvalidOperationException("Unpaid order");',
  '        Status = OrderStatus.Shipped;',
  '    }',
  '}',
]
const HELPER = ['public static class OrderRules', '{', '    public static bool CanShip(Order o) => o.PaidAt is not null;', '}']
const CONSTRAINT = ['ALTER TABLE Orders ADD CONSTRAINT CK_Shipped_Paid', "    CHECK (Status <> 'Shipped' OR PaidAt IS NOT NULL);"]
const TESTS = ['[Fact]', 'public void OrderService_refuses_unpaid() { … }', '', '[Fact]', 'public void AdminOrderService_refuses_unpaid() { … }']

const CALLERS: Region = { id: 'callers', name: 'Callers', tone: 'ui' }
const MODEL: Region = { id: 'model', name: 'Order', tone: 'pool' }
const DB: Region = { id: 'db', name: 'Database', tone: 'io' }
const TESTR: Region = { id: 'tests', name: 'Tests', tone: 'muted' }

type K = Field['kind']
const caller = (id: string, title: string, fields: Field[], kind?: Box['kind'], still?: boolean): Box => ({ id, region: 'callers', title, fields, kind, still })
const sets = (kind?: K): Field => ({ name: 'sets', value: 'Status', ref: 'order', kind })
const checks = (kind?: K): Field => ({ name: 'checks', value: 'paid?', kind })
const NOREF: Field[] = [{ name: 'checks', value: 'paid?' }, { name: 'sets', value: 'Status' }]
const svcBox = (f: Field[] = [checks(), sets()], kind?: Box['kind'], still?: boolean) => caller('svc', 'OrderService', f, kind, still)
const adminBox = (f: Field[] = [checks(), sets()], kind?: Box['kind'], still?: boolean) => caller('admin', 'AdminOrderService', f, kind, still)
const importBox = (f: Field[] = [sets()], kind?: Box['kind']) => caller('imp', 'ImportJob', f, kind)
const order = (fields: Field[], kind?: Box['kind'], still?: boolean): Box => ({ id: 'order', region: 'model', title: 'Order', fields, kind, still })
const PUBLIC = [
  { name: 'Status', value: 'get; set;' },
  { name: 'PaidAt', value: 'get; set;' },
]
const unpaidShipped = (kind?: K): Field[] => [
  { name: 'Status', value: 'Shipped', kind },
  { name: 'PaidAt', value: 'null', kind },
]
const graph = (regions: Region[], code: string[], steps: Record<string, GraphStep>, outputName?: string): GraphSpec => ({ regions, code, steps, outputName })

const calls = (kind?: K): Field => ({ name: 'calls', value: 'Ship()', ref: 'order', kind })
const richOrder = (extra: Field[] = [], kind?: Box['kind']) =>
  order([{ name: 'Status', value: 'private set', kind: 'ok' }, { name: 'Ship()', value: 'checks PaidAt', kind: 'ok' }, ...extra], kind)
const out = (text: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'result', text, kind }]

const SPECS: Record<string, GraphSpec> = {
  // ---- Setup: the stem's facts only ----
  setup: graph([CALLERS, MODEL], ANEMIC, {
    order: { boxes: [order(PUBLIC)], line: [2, 3] },
    services: { boxes: [svcBox(), adminBox(), order(PUBLIC, undefined, true)], line: 2 },
    import: { boxes: [svcBox(undefined, undefined, true), adminBox(undefined, undefined, true), importBox(), order(unpaidShipped())], line: 2 },
    ask: { boxes: [svcBox(undefined, undefined, true), adminBox(undefined, undefined, true), importBox(), order(unpaidShipped(), undefined, true)], line: null },
  }),

  ship: graph(
    [CALLERS, MODEL],
    RICH,
    {
      method: { boxes: [richOrder()], line: { each: [2, [5, 10]] } },
      callers: { boxes: [svcBox([calls('ok')]), adminBox([calls('ok')]), richOrder()], line: [5, 10] },
      import: {
        boxes: [svcBox([calls('ok')]), adminBox([calls('ok')]), importBox([calls('ok'), { name: 'Status =', value: 'no compile', kind: 'bad' }]), richOrder([{ name: 'PaidAt', value: 'null' }])],
        line: [7, 8],
        output: out('Ship() on an unpaid order: refused', 'ok'),
      },
    },
    'Import job',
  ),

  'helper-claim': graph([CALLERS, MODEL], HELPER, {
    helper: { boxes: [{ id: 'rules', region: 'model', title: 'OrderRules', sub: 'static', fields: [{ name: 'CanShip', value: 'paid?' }] }], line: 2 },
    call: {
      boxes: [
        svcBox([{ name: 'calls', value: 'CanShip', ref: 'rules' }, { name: 'then sets', value: 'Status' }]),
        adminBox([{ name: 'calls', value: 'CanShip', ref: 'rules' }, { name: 'then sets', value: 'Status' }]),
        { id: 'rules', region: 'model', title: 'OrderRules', sub: 'static', fields: [{ name: 'CanShip', value: 'paid?' }] },
      ],
      line: 2,
    },
  }),
  'helper-reality': graph([CALLERS, MODEL], [...HELPER, '', ...ANEMIC], {
    once: {
      boxes: [
        svcBox([{ name: 'calls', value: 'CanShip', ref: 'rules' }, sets()]),
        adminBox([{ name: 'calls', value: 'CanShip', ref: 'rules' }, sets()]),
        { id: 'rules', region: 'model', title: 'OrderRules', sub: 'static', fields: [{ name: 'CanShip', value: 'paid?', kind: 'ok' }] },
        order([{ name: 'setter', value: 'public', kind: 'bad' }]),
      ],
      line: 7,
    },
    skip: {
      boxes: [
        svcBox([{ name: 'calls', value: 'CanShip', ref: 'rules' }, sets()]),
        adminBox([{ name: 'calls', value: 'CanShip', ref: 'rules' }, sets()]),
        importBox([{ name: 'calls', value: 'nothing', kind: 'bad' }, sets('bad')], 'bad'),
        { id: 'rules', region: 'model', title: 'OrderRules', sub: 'static', fields: [{ name: 'CanShip', value: 'paid?', kind: 'ok' }] },
        order([{ name: 'setter', value: 'public', kind: 'bad' }, ...unpaidShipped('bad')], 'bad'),
      ],
      line: 7,
      bad: true,
    },
  }),

  'constraint-claim': graph([CALLERS, MODEL, DB], CONSTRAINT, {
    constraint: { boxes: [{ id: 'table', region: 'db', title: 'Orders table', fields: [{ name: 'CHECK', value: 'shipped → paid' }] }], line: [0, 1] },
    reject: {
      boxes: [importBox([sets()]), order(unpaidShipped()), { id: 'table', region: 'db', title: 'Orders table', fields: [{ name: 'CHECK', value: 'shipped → paid' }, { name: 'unpaid shipped', value: 'rejected' }] }],
      line: 1,
    },
  }),
  'constraint-reality': graph(
    [CALLERS, MODEL, DB],
    CONSTRAINT,
    {
      memory: {
        boxes: [importBox([sets('bad'), { name: 'carries on', value: 'yes', kind: 'bad' }], 'bad'), order(unpaidShipped('bad'), 'bad'), { id: 'table', region: 'db', title: 'Orders table', fields: [{ name: 'CHECK', value: 'shipped → paid' }] }],
        line: null,
      },
      save: {
        boxes: [
          importBox([sets('bad'), { name: 'SaveChanges', value: 'throws', kind: 'bad' }], 'bad'),
          order(unpaidShipped('bad'), 'bad'),
          { id: 'table', region: 'db', title: 'Orders table', fields: [{ name: 'CHECK', value: 'shipped → paid' }, { name: 'insert', value: 'rejected', kind: 'ok' }] },
        ],
        line: 1,
        output: [{ label: 'on save', text: 'DbUpdateException: CHECK constraint failed', kind: 'bad' }],
      },
    },
    'Error',
  ),

  'tests-claim': graph([CALLERS, TESTR], TESTS, {
    tests: { boxes: [svcBox(NOREF), adminBox(NOREF), { id: 't', region: 'tests', title: 'Unit tests', fields: [{ name: 'test 1', value: 'OrderService' }, { name: 'test 2', value: 'AdminOrderService' }] }], line: [0, 4] },
    caught: {
      boxes: [svcBox(NOREF), adminBox(NOREF), { id: 't', region: 'tests', title: 'Unit tests', fields: [{ name: 'test 1', value: 'OrderService' }, { name: 'test 2', value: 'AdminOrderService' }, { name: 'missing check', value: 'caught' }] }],
      line: [0, 4],
    },
  }),
  'tests-reality': graph([CALLERS, MODEL, TESTR], TESTS, {
    covered: {
      boxes: [svcBox(), adminBox(), order(PUBLIC), { id: 't', region: 'tests', title: 'Unit tests', fields: [{ name: 'test 1', value: 'OrderService', kind: 'ok' }, { name: 'test 2', value: 'AdminOrderService', kind: 'ok' }] }],
      line: [0, 4],
    },
    import: {
      boxes: [
        svcBox(),
        adminBox(),
        importBox([sets('bad'), { name: 'tests', value: 'none', kind: 'bad' }], 'bad'),
        order(unpaidShipped('bad'), 'bad'),
        { id: 't', region: 'tests', title: 'Unit tests', fields: [{ name: 'test 1', value: 'OrderService', kind: 'ok' }, { name: 'test 2', value: 'AdminOrderService', kind: 'ok' }] },
      ],
      line: null,
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
