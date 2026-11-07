import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'public class InMemoryOrderRepository : IOrderRepository',
  '{',
  '    private readonly Dictionary<int, Order> _orders = new();',
  '    public void Save(Order order) => _orders[order.Id] = order;',
  '    public Order? GetById(int id) => _orders.GetValueOrDefault(id);',
  '}',
  '',
  '// in a test:',
  'var repo = new InMemoryOrderRepository();',
  'var service = new OrderService(repo);',
  'service.Place(new Order(7));',
  'Assert.NotNull(repo.GetById(7));',
]
/** The Setup stops before the test uses the repository. */
const SETUP_CODE = CODE.slice(0, 10)
const L = { CLASS: [0, 5] as [number, number], DICT: 2, SAVE: 3, NEW: 8, CTOR: 9, SETUP_TEST: [8, 9] as [number, number], PLACE: 10, GET: 11, USE: [10, 11] as [number, number] }

const actors: SeqActor[] = [
  { id: 'test', name: 'Test', tone: 'muted' },
  { id: 'svc', name: 'OrderService', sub: 'code under test', tone: 'ui' },
  { id: 'repo', name: 'InMemory­Order­Repository', tone: 'pool' },
]
const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const spec = (steps: Record<string, SeqStep>, code: string[] | null = CODE): SeqSpec => ({ actors, code: code ?? undefined, outputName: 'Repository', steps })
const out = (orders: string, extra?: OutLine): OutLine[] => [{ label: '_orders', text: orders, kind: orders === '?' ? 'muted' : 'plain' }, ...(extra ? [extra] : [])]

const ctor = row('ctor', 'test', 'new OrderService(repo)', 'svc')
const place = row('place', 'test', 'Place(order 7)', 'svc')
const save = row('save', 'svc', 'Save(order 7)', 'repo')
const store = row('store', 'repo', '_orders[7] = order')
const get = row('get', 'test', 'GetById(7)', 'repo')
const back = row('back', 'repo', 'order 7, as stored', 'test', 'ok')
const USED = [ctor, place, save, store, get, back]

const SPECS: Record<string, SeqSpec> = {
  setup: spec(
    {
      class: { rows: [row('dict', 'repo', 'Dictionary<int, Order>')], line: L.CLASS, output: out('empty', { label: 'Kind of double', text: '?', kind: 'muted' }) },
      question: { rows: [row('dict', 'repo', 'Dictionary<int, Order>'), ctor], line: L.SETUP_TEST, output: out('empty', { label: 'Kind of double', text: '?', kind: 'muted' }) },
    },
    SETUP_CODE,
  ),
  fake: spec({
    save: { rows: [ctor, place, save, store], line: L.PLACE, output: out('{ 7: order 7 }') },
    load: { rows: [ctor, place, save, store, get, back], line: L.GET, output: out('{ 7: order 7 }') },
    shortcut: {
      rows: [ctor, place, save, store, get, back, row('mem', 'repo', 'in memory, not a database', undefined, 'ok')],
      line: L.DICT,
      output: out('{ 7: order 7 }', { label: 'Kind of double', text: 'fake', kind: 'ok' }),
    },
  }),

  'stub-claim': spec(
    {
      prepare: { rows: [row('prep', 'test', 'prepare: GetById(7) → order A', 'repo', 'bad')], output: [{ label: 'Prepared answers', text: 'GetById(7) → order A', kind: 'bad' }] },
      answer: {
        rows: [row('prep', 'test', 'prepare: GetById(7) → order A', 'repo', 'bad'), row('ask', 'svc', 'GetById(7)', 'repo'), row('ans', 'repo', 'order A, as prepared', 'svc', 'bad')],
        output: [{ label: 'Prepared answers', text: 'GetById(7) → order A', kind: 'bad' }, { label: 'Own logic', text: 'none', kind: 'bad' }],
      },
    },
    null,
  ),
  'stub-reality': spec({
    prepare: { rows: [row('new', 'test', 'new InMemoryOrderRepository()', 'repo')], line: L.NEW, output: out('empty', { label: 'Prepared answers', text: 'none' }) },
    answer: { rows: [row('new', 'test', 'new InMemoryOrderRepository()', 'repo'), ...USED], line: L.USE, output: out('{ 7: order 7 }', { label: 'Prepared answers', text: 'none' }) },
  }),

  'mock-claim': spec(
    {
      record: { rows: [ctor, place, save, row('rec', 'repo', 'records: Save(order 7)', undefined, 'bad')], output: [{ label: 'Recorded calls', text: 'Save(order 7)', kind: 'bad' }] },
      verify: {
        rows: [ctor, place, save, row('rec', 'repo', 'records: Save(order 7)', undefined, 'bad'), row('verify', 'test', 'verify: Save called once', 'repo', 'bad')],
        output: [{ label: 'Recorded calls', text: 'Save(order 7)', kind: 'bad' }, { label: 'Test checks', text: 'Save was called once', kind: 'bad' }],
      },
    },
    null,
  ),
  'mock-reality': spec({
    record: { rows: [ctor, place, save, store], line: L.SAVE, output: out('{ 7: order 7 }', { label: 'Recorded calls', text: 'none' }) },
    verify: { rows: [ctor, place, save, store, get, back], line: L.GET, output: out('{ 7: order 7 }', { label: 'Test checks', text: 'the order it reads back', kind: 'ok' }) },
  }),

  'dummy-claim': spec(
    {
      pass: { rows: [ctor], output: [{ label: 'Calls to repo', text: '…' }] },
      unused: { rows: [ctor, row('never', 'svc', 'never called', 'repo', 'skip')], output: [{ label: 'Calls to repo', text: 'none', kind: 'bad' }] },
    },
    null,
  ),
  'dummy-reality': spec({
    pass: { rows: [ctor], line: L.CTOR, output: out('empty', { label: 'Calls to repo', text: '…' }) },
    unused: { rows: USED, line: L.USE, output: out('{ 7: order 7 }', { label: 'Calls to repo', text: 'Save, GetById', kind: 'ok' }) },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
