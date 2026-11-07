import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const ORDER_CODE = [
  'public class Order',
  '{',
  '    private readonly IMediator _mediator;',
  '    public Order(IMediator mediator) => _mediator = mediator;',
  '',
  '    public async Task Ship()',
  '    {',
  '        Status = OrderStatus.Shipped;',
  '        await _mediator.Publish(new OrderShipped(Id));',
  '    }',
  '}',
]
const CODE = [...ORDER_CODE, '', '// in the command handler', 'await order.Ship();', 'await db.SaveChangesAsync();']
const L = { CTOR: 3, PUBLISH: 8, SHIP: 13, SAVE: 14, CLASS: [0, 10] as [number, number] }

const LOAD_CODE = [...ORDER_CODE, '', '// in the command handler', 'var order = await db.Orders.FindAsync(id);', 'await order.Ship();', 'await db.SaveChangesAsync();']
const LD = { FIND: 13, SHIP: 14, PUBLISH: 8 }

const RECORD_CODE = [
  '// in Order',
  'public void Ship()',
  '{',
  '    Status = OrderStatus.Shipped;',
  '    _events.Add(new OrderShipped(Id));',
  '}',
  '',
  '// in AppDbContext',
  'public override async Task<int> SaveChangesAsync(CancellationToken ct = default)',
  '{',
  '    var events = ChangeTracker.Entries<AggregateRoot>()',
  '        .SelectMany(e => e.Entity.PopEvents()).ToList();',
  '    var saved = await base.SaveChangesAsync(ct);',
  '    foreach (var e in events) await mediator.Publish(e, ct);',
  '    return saved;',
  '}',
]
const RC = { RECORD: [3, 4] as [number, number], COLLECT: [10, 11] as [number, number], SAVE: 12, PUBLISH: 13 }

const LOCATOR_CODE = [
  'public class Order',
  '{',
  '    public async Task Ship()',
  '    {',
  '        Status = OrderStatus.Shipped;',
  '        await ServiceLocator.Mediator.Publish(new OrderShipped(Id));',
  '    }',
  '}',
  '',
  '// in the command handler',
  'await order.Ship();',
  'await db.SaveChangesAsync();',
]
const SL = { CLASS: [0, 1] as [number, number], PUBLISH: 5, SAVE: 11 }

const CALLER_CODE = [
  '// in the controller',
  'order.Ship();',
  'await mediator.Publish(new OrderShipped(order.Id));',
  'await db.SaveChangesAsync();',
]
const CP = { SHIP: 1, PUBLISH: 2, SAVE: 3 }

const actors = (caller = 'Command handler'): SeqActor[] => [
  { id: 'caller', name: caller, tone: 'muted' },
  { id: 'order', name: 'Order', sub: 'aggregate', tone: 'ui' },
  { id: 'mediator', name: 'IMediator', sub: 'event handlers', tone: 'pool' },
  { id: 'db', name: 'DbContext', sub: 'EF Core', tone: 'io' },
]
const spec = (steps: Record<string, SeqStep>, code: string[], caller?: string): SeqSpec => ({ actors: actors(caller), code, steps })
const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })

const ship = row('ship', 'caller', 'Ship()', 'order')
const publish = row('publish', 'order', 'Publish', 'mediator')
const handlers = row('handlers', 'mediator', 'events handled')
const save = row('save', 'caller', 'SaveChanges', 'db')
const fails = row('fails', 'db', 'save fails', undefined, 'bad')
const ranEarly = row('ran', 'mediator', 'already handled', undefined, 'bad')

// ---- Reality ----
const recorded = row('record', 'order', 'event added to list', undefined, 'ok')
const collect = row('collect', 'db', 'PopEvents()', 'order')
const RR = {
  ship: { rows: [ship, recorded], line: RC.RECORD },
  save: { rows: [ship, row('record', 'order', 'events: handed over', undefined, 'muted'), save, collect], line: RC.COLLECT },
} satisfies Record<string, SeqStep>

const SPECS: Record<string, SeqSpec> = {
  setup: spec(
    {
      ship: { rows: [ship, publish, handlers], line: { each: [L.SHIP, L.PUBLISH] } },
      save: { rows: [ship, publish, handlers, save, fails], line: L.SAVE },
      load: { rows: [row('load', 'db', 'load: new Order(?)', 'order', 'muted'), ship, publish, handlers, save, fails], line: L.CTOR },
    },
    CODE,
  ),
  'record-then-dispatch': spec(
    {
      ship: RR.ship,
      save: RR.save,
      commit: { rows: [...RR.save.rows, row('commit', 'db', 'commit ok', undefined, 'ok')], line: RC.SAVE },
      dispatch: {
        rows: [...RR.save.rows, row('commit', 'db', 'commit ok', undefined, 'ok'), row('publish', 'db', 'Publish', 'mediator'), row('handlers', 'mediator', 'events handled', undefined, 'ok')],
        line: RC.PUBLISH,
      },
    },
    RECORD_CODE,
  ),
  'save-fails': spec(
    {
      ship: RR.ship,
      save: { rows: [...RR.save.rows, row('throws', 'db', 'save throws', undefined, 'bad')], line: RC.SAVE, bad: true },
      'no-dispatch': {
        rows: [...RR.save.rows, row('throws', 'db', 'save throws', undefined, 'bad'), row('none', 'mediator', 'nothing handled', undefined, 'skip')],
        line: RC.PUBLISH,
      },
    },
    RECORD_CODE,
  ),

  'ctor-binding-claim': spec(
    {
      load: { rows: [row('load', 'db', 'new Order(mediator)', 'order', 'bad')], line: L.CTOR, bad: true },
      ship: { rows: [row('load', 'db', 'new Order(mediator)', 'order', 'bad'), row('ship', 'caller', 'Ship()', 'order'), publish], line: { each: [LD.SHIP, LD.PUBLISH] } },
    },
    LOAD_CODE,
  ),
  'ctor-binding-reality': spec(
    {
      load: { rows: [row('load', 'db', 'new Order(?)', 'order'), row('bind', 'order', 'ctor param: cannot bind', undefined, 'bad')], line: L.CTOR, bad: true },
      ship: { rows: [row('ship', 'caller', 'Ship()', 'order'), publish, handlers, row('save', 'caller', 'SaveChanges', 'db'), fails, ranEarly], line: { each: [LD.SHIP, LD.PUBLISH] } },
    },
    LOAD_CODE,
  ),

  'service-locator-claim': spec(
    {
      ctor: { rows: [row('ctor', 'order', 'no ctor param')], line: SL.CLASS },
      ship: { rows: [row('ctor', 'order', 'no ctor param'), ship, row('publish', 'order', 'Publish via locator', 'mediator')], line: SL.PUBLISH },
    },
    LOCATOR_CODE,
  ),
  'service-locator-reality': spec(
    {
      ctor: { rows: [row('ctor', 'order', 'hidden static global', undefined, 'bad')], line: SL.PUBLISH, bad: true },
      ship: {
        rows: [row('ctor', 'order', 'hidden static global', undefined, 'bad'), ship, row('publish', 'order', 'Publish via locator', 'mediator'), handlers, save, fails, ranEarly],
        line: { each: [SL.PUBLISH, SL.SAVE] },
      },
    },
    LOCATOR_CODE,
  ),

  'caller-publishes-claim': spec(
    {
      ship: { rows: [ship, row('status', 'order', 'Status = Shipped')], line: CP.SHIP },
      publish: { rows: [ship, row('status', 'order', 'Status = Shipped'), row('publish', 'caller', 'Publish', 'mediator'), handlers], line: CP.PUBLISH },
    },
    CALLER_CODE,
    'Controller',
  ),
  'caller-publishes-reality': spec(
    {
      ship: { rows: [ship, row('status', 'order', 'Status = Shipped'), row('forget', 'caller', 'other callers can forget', undefined, 'bad')], line: CP.SHIP },
      publish: {
        rows: [ship, row('status', 'order', 'Status = Shipped'), row('forget', 'caller', 'other callers can forget', undefined, 'bad'), row('publish', 'caller', 'Publish', 'mediator'), handlers, save, fails, ranEarly],
        line: { each: [CP.PUBLISH, CP.SAVE] },
      },
    },
    CALLER_CODE,
    'Controller',
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
