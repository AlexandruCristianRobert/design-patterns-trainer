import { BoxGraph, type Box, type GraphSpec } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

// ---- Setup: the test class, its two tests and the database; nothing about who calls what ----
const tests = (still?: boolean): Box => ({
  id: 'cls',
  region: 'cls',
  title: 'OrderTests',
  sub: 'test class',
  fields: [
    { name: 'test 1', value: 'Finds_order' },
    { name: 'test 2', value: 'Lists_orders' },
  ],
  still,
})
const needs = (still?: boolean): Box => ({
  id: 'needs',
  region: 'cls',
  title: 'Needs',
  fields: [
    { name: 'before each', value: 'await SeedAsync()' },
    { name: 'after each', value: 'async cleanup' },
  ],
  still,
})
const DB: Box = { id: 'db', region: 'db', title: 'Test database', fields: [{ name: 'holds', value: 'orders' }] }
const SETUP: GraphSpec = {
  regions: [
    { id: 'cls', name: 'Tests', tone: 'ui' },
    { id: 'db', name: 'Data', tone: 'io' },
  ],
  steps: {
    class: { boxes: [tests(), DB] },
    needs: { boxes: [tests(true), needs(), { ...DB, still: true }] },
    ask: { boxes: [tests(true), needs(true), { ...DB, still: true }] },
  },
}

// ---- Sequence stages ----
const actors: SeqActor[] = [
  { id: 'x', name: 'xUnit', tone: 'pool' },
  { id: 'c', name: 'Test class', tone: 'ui' },
  { id: 'db', name: 'Database', tone: 'io' },
]
const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const spec = (code: string[], steps: Record<string, SeqStep>): SeqSpec => ({ actors, code, steps })

const LIFETIME = [
  'public class OrderTests : IAsyncLifetime',
  '{',
  '    public async ValueTask InitializeAsync() => await SeedAsync();',
  '    public async ValueTask DisposeAsync() => await CleanAsync();',
  '',
  '    [Fact]',
  '    public async Task Finds_order() { … }',
  '}',
]
const NEW = row('new', 'x', 'new()', 'c')
const INIT = [row('init', 'x', 'await Initialize', 'c', 'ok'), row('seed', 'c', 'SeedAsync', 'db'), row('seeded', 'db', 'seeded', undefined, 'ok')]
const TEST = [row('run', 'x', 'Finds_order', 'c', 'ok')]
const DISPOSE = [row('disp', 'x', 'await Dispose', 'c', 'ok'), row('clean', 'c', 'CleanAsync', 'db'), row('cleaned', 'db', 'clean', undefined, 'ok')]

const BLOCK = ['public OrderTests()', '{', '    SeedAsync().GetAwaiter().GetResult();', '}']
const VOID = ['public OrderTests() => Seed();', '', 'async void Seed() => await SeedAsync();']
const SETUP_ATTR = ['[SetUp]', 'public async Task Seed() => await SeedAsync();', '', '[Fact]', 'public async Task Finds_order() { … }']

const SPECS: Record<string, SeqSpec> = {
  lifetime: spec(LIFETIME, {
    ctor: { rows: [NEW], line: 0 },
    init: { rows: [NEW, ...INIT], line: 2 },
    test: { rows: [NEW, ...INIT, ...TEST], line: [5, 6] },
    dispose: { rows: [NEW, ...INIT, ...TEST, ...DISPOSE], line: 3 },
    next: { rows: [NEW, ...INIT, ...TEST, ...DISPOSE, row('again', 'x', 'next test: new()', 'c')], line: 0 },
  }),

  'block-claim': spec(BLOCK, {
    'no-hook': { rows: [row('hook', 'x', 'no async hook')] },
    block: { rows: [row('hook', 'x', 'no async hook'), NEW, row('seed', 'c', 'SeedAsync', 'db'), row('wait', 'c', 'GetResult()')], line: 2 },
  }),
  'block-reality': spec(BLOCK, {
    hook: { rows: [row('hook', 'x', 'IAsyncLifetime', undefined, 'ok')] },
    thread: {
      rows: [row('hook', 'x', 'IAsyncLifetime', undefined, 'ok'), NEW, row('seed', 'c', 'SeedAsync', 'db'), row('wait', 'c', 'thread idle', undefined, 'bad'), row('dead', 'c', 'deadlock risk', undefined, 'bad')],
      line: 2,
      bad: true,
    },
  }),

  'void-claim': spec(VOID, {
    call: { rows: [NEW, row('call', 'c', 'Seed()')], line: 0 },
    background: { rows: [NEW, row('call', 'c', 'Seed()'), row('seed', 'c', 'SeedAsync', 'db'), row('bg', 'db', 'in background')], line: 2 },
  }),
  'void-reality': spec(VOID, {
    returns: { rows: [NEW, row('call', 'c', 'Seed()'), row('seed', 'c', 'SeedAsync', 'db'), row('ret', 'c', 'returns at await', undefined, 'bad')], line: 2, bad: true },
    early: {
      rows: [
        NEW,
        row('call', 'c', 'Seed()'),
        row('seed', 'c', 'SeedAsync', 'db'),
        row('ret', 'c', 'returns at await', undefined, 'bad'),
        row('run', 'x', 'Finds_order', 'c', 'bad'),
        row('busy', 'db', 'still seeding', undefined, 'bad'),
      ],
      line: 0,
      bad: true,
    },
  }),

  'setup-claim': spec(SETUP_ATTR, {
    attr: { rows: [row('attr', 'c', '[SetUp] Seed')], line: [0, 1] },
    awaited: { rows: [row('attr', 'c', '[SetUp] Seed'), row('find', 'x', 'await Seed()', 'c'), row('seed', 'c', 'SeedAsync', 'db'), row('run', 'x', 'Finds_order', 'c')], line: [0, 4] },
  }),
  'setup-reality': spec(SETUP_ATTR, {
    nunit: { rows: [row('attr', 'c', '[SetUp] Seed'), row('ign', 'x', 'ignores [SetUp]', undefined, 'bad')], line: 0, bad: true },
    empty: {
      rows: [row('attr', 'c', '[SetUp] Seed'), row('ign', 'x', 'ignores [SetUp]', undefined, 'bad'), row('run', 'x', 'Finds_order', 'c', 'bad'), row('empty', 'db', 'never seeded', undefined, 'bad')],
      line: [3, 4],
      bad: true,
    },
  }),
}

const drawing: QuestionDrawing = {
  setup: (p: StageDrawingProps) => <BoxGraph spec={SETUP} {...p} />,
  ...Object.fromEntries(Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />])),
}
export default drawing
