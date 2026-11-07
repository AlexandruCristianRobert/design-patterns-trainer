import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const SETUP_CODE = [
  'public class OrderTests { … }',
  'public class CustomerTests { … }',
  'public class InvoiceTests { … }',
  'public class ShippingTests { … }',
  'public class StockTests { … }',
]
const COLLECTION_CODE = [
  'public class DbFixture : IAsyncLifetime { … } // starts, stops the container',
  '',
  '[CollectionDefinition("Db")]',
  'public class DbCollection : ICollectionFixture<DbFixture> { }',
  '',
  '[Collection("Db")]',
  'public class OrderTests(DbFixture db) { … }',
  '',
  '[Collection("Db")]',
  'public class CustomerTests(DbFixture db) { … }',
  '// … [Collection("Db")] on the other three classes too',
]
const C = { DEFINE: [2, 3] as [number, number], USE: { each: [[5, 6], [8, 10]] as [number, number][] }, FIXTURE: 0 }
const BASE_CODE = [
  'public abstract class DbTestBase : IClassFixture<DbFixture> { }',
  '',
  'public class OrderTests(DbFixture db) : DbTestBase { … }',
  'public class CustomerTests(DbFixture db) : DbTestBase { … }',
  '// … three more classes derive from DbTestBase',
]
const B = { ALL: [0, 4] as [number, number] }
const STATIC_CODE = [
  'public class OrderTests',
  '{',
  '    static DbContainer _db;',
  '    public OrderTests() => _db = DbContainer.Start();',
  '',
  '    [Fact] public void Test1() { … }',
  '    // … 4 [Fact] tests in all',
  '}',
]
const S = { CTOR: 3, FIELD: 2, T1: 5, REST: 6 }
const NO_PARALLEL_CODE = [
  '[assembly: CollectionBehavior(DisableTestParallelization = true)]',
  '',
  'public class OrderTests',
  '{',
  '    readonly DbContainer _db;',
  '    public OrderTests() => _db = DbContainer.Start();',
  '    // … 4 [Fact] tests in all',
  '}',
]
const N = { ATTR: 0, CTOR: 5, REST: 6 }

const CLASSES: Region = { id: 'cls', name: 'Test classes', tone: 'ui', wrap: true }
const FIX: Region = { id: 'fix', name: 'Fixtures', sub: 'created by xUnit', tone: 'pool', wrap: true }
const DOCKER: Region = { id: 'docker', name: 'Docker', sub: 'PostgreSQL containers', tone: 'io', wrap: true }

const started = (n: number | string, kind: OutLine['kind'] = 'plain'): OutLine[] => [{ label: 'Containers started', text: String(n), kind }]
const cls = (id: string, title: string, fields: Field[], kind?: Box['kind'], sub?: string): Box => ({ id, region: 'cls', title, sub, fields, kind })
const container = (n: string, kind?: Box['kind'], sub?: string): Box => ({ id: `c-${n}`, region: 'docker', title: `container ${n}`, sub, kind })
const spec = (regions: Region[], code: string[], steps: Record<string, GraphStep>): GraphSpec => ({ regions, code, outputName: 'Docker', steps })

// ---- Setup ----
const FIVE = ['OrderTests', 'CustomerTests', 'InvoiceTests', 'ShippingTests', 'StockTests'].map((t) => cls(t, t, [{ name: 'needs', value: 'PostgreSQL' }]))

// ---- Reality: one collection fixture ----
const threeClasses = (fields: (id: string) => Field[], kind?: Box['kind']): Box[] => [
  cls('order', 'OrderTests', fields('order'), kind),
  cls('customer', 'CustomerTests', fields('customer'), kind),
  cls('more', '3 more classes', fields('more'), kind, 'Invoice, Shipping, Stock'),
]
const inCollection = () => [{ name: '[Collection]', value: '"Db"' }]
const usesFixture = () => [...inCollection(), { name: 'fixture', value: 'DbFixture', ref: 'fixture' }]
const fixture = (kind?: Box['kind'], sub = 'collection "Db", created once'): Box => ({
  id: 'fixture',
  region: 'fix',
  title: 'DbFixture',
  sub,
  kind,
  fields: [{ name: 'Db', value: 'container 1' }],
})

// ---- Base-class claim: fixtures without arrows, one per class ----
const derived = (): Box[] => threeClasses(() => [{ name: 'base', value: 'DbTestBase' }])
const perClassFixture = (n: string, forWhom: string, kind?: Box['kind']): Box => ({
  id: `f-${n}`,
  region: 'fix',
  title: n === '3–5' ? 'DbFixture #3 … #5' : `DbFixture #${n}`,
  sub: `for ${forWhom}`,
  kind,
  fields: [{ name: 'Db', value: `container ${n}` }],
})

// ---- Static-field claim ----
const orderStatic = (target: string, runs: string, kind?: Field['kind']): Box =>
  cls('order', 'OrderTests', [{ name: 'runs', value: runs }, { name: 'static _db', value: `container ${target}`, ref: `c-${target}`, kind }])

// ---- No-parallel claim ----
const orderInstance = (title: string, runs: string, target: string, sub?: string, kind?: Box['kind']): Box =>
  cls(`i-${target}`, title, [{ name: 'runs', value: runs }, { name: '_db', value: `container ${target}`, ref: `c-${target}` }], kind, sub)
const ONE_BY_ONE: OutLine = { label: 'Tests run', text: 'one after another' }

const SPECS: Record<string, GraphSpec> = {
  setup: spec([CLASSES, DOCKER], SETUP_CODE, {
    classes: { boxes: FIVE, line: [0, 4] },
    container: {
      boxes: [...FIVE.map((b) => ({ ...b, still: true })), { id: 'pg', region: 'docker', title: 'PostgreSQL container', sub: 'several seconds to start', kind: 'muted' }],
      line: null,
      output: started('?', 'muted'),
    },
  }),
  'collection-fixture': spec([CLASSES, FIX, DOCKER], COLLECTION_CODE, {
    define: { boxes: [...threeClasses(inCollection).map((b) => ({ ...b, still: true })), fixture(), container('1')], line: C.DEFINE, output: started(1, 'ok') },
    inject: { boxes: [...threeClasses(usesFixture), fixture(), container('1')], line: C.USE, output: started(1, 'ok') },
    serial: {
      boxes: [
        cls('order', 'OrderTests', [...usesFixture(), { name: 'runs', value: 'now' }]),
        cls('customer', 'CustomerTests', [...usesFixture(), { name: 'runs', value: 'after it' }]),
        cls('more', '3 more classes', [...usesFixture(), { name: 'runs', value: 'one by one' }], undefined, 'Invoice, Shipping, Stock'),
        fixture(),
        container('1'),
      ],
      line: C.USE,
      output: [...started(1, 'ok'), { label: 'Classes in "Db"', text: 'one after another' }],
    },
    dispose: {
      boxes: [...threeClasses(inCollection, 'gone'), fixture('gone', 'disposed'), container('1', 'gone', 'stopped')],
      line: C.FIXTURE,
      output: [...started(1, 'ok'), { label: 'Classes in "Db"', text: 'one after another' }],
    },
  }),

  'base-class-claim': spec([CLASSES, FIX, DOCKER], BASE_CODE, {
    derive: { boxes: derived(), line: B.ALL },
    run: {
      boxes: [...derived(), { ...perClassFixture('1', 'all five classes (claimed)', 'bad'), title: 'DbFixture' }, container('1')],
      line: B.ALL,
      bad: true,
      output: started(1, 'bad'),
    },
  }),
  'base-class-reality': spec([CLASSES, FIX, DOCKER], BASE_CODE, {
    derive: { boxes: derived(), line: B.ALL },
    run: {
      boxes: [
        ...derived(),
        perClassFixture('1', 'OrderTests'),
        perClassFixture('2', 'CustomerTests'),
        perClassFixture('3–5', 'one each'),
        container('1'),
        container('2'),
        container('3–5', 'bad', 'one per class'),
      ],
      line: B.ALL,
      output: started(5, 'bad'),
    },
  }),

  'static-field-claim': spec([CLASSES, DOCKER], STATIC_CODE, {
    first: { boxes: [orderStatic('1', 'Test1'), container('1')], line: S.CTOR, output: started(1) },
    next: { boxes: [orderStatic('1', 'Test2 … Test4'), container('1')], line: S.FIELD, bad: true, output: started(1, 'bad') },
  }),
  'static-field-reality': spec([CLASSES, DOCKER], STATIC_CODE, {
    first: { boxes: [orderStatic('1', 'Test1'), container('1')], line: S.CTOR, output: started(1) },
    next: {
      boxes: [orderStatic('4', 'Test4 (new instance)', 'bad'), container('1–3', 'bad', 'never stopped'), container('4')],
      line: S.CTOR,
      output: [...started('4, for OrderTests alone', 'bad'), { label: 'Stopped', text: 'none', kind: 'bad' }],
    },
  }),

  'no-parallel-claim': spec([CLASSES, DOCKER], NO_PARALLEL_CODE, {
    off: { boxes: [orderInstance('OrderTests', 'Test1', '1'), container('1')], line: N.ATTR, output: [...started(1), ONE_BY_ONE] },
    run: {
      boxes: [orderInstance('OrderTests', 'Test1 … Test4', '1', 'one reused instance (claimed)', 'bad'), container('1')],
      line: N.REST,
      bad: true,
      output: [...started('1 for OrderTests', 'bad'), ONE_BY_ONE],
    },
  }),
  'no-parallel-reality': spec([CLASSES, DOCKER], NO_PARALLEL_CODE, {
    off: { boxes: [orderInstance('OrderTests #1', 'Test1', '1'), container('1')], line: N.ATTR, output: [...started(1), ONE_BY_ONE] },
    run: {
      boxes: [
        orderInstance('OrderTests #1', 'Test1', '1', undefined, 'gone'),
        orderInstance('OrderTests #2 … #4', 'Test2 … Test4', '2–4', 'one per test', 'bad'),
        container('1'),
        container('2–4', 'bad', 'one per test'),
      ],
      line: N.CTOR,
      output: [...started('4 for OrderTests', 'bad'), ONE_BY_ONE],
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
