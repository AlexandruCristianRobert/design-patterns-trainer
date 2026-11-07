import { BoxGraph, type Box, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'public class OrderTests : IDisposable',
  '{',
  '    readonly DbContainer _db;',
  '    public OrderTests() => _db = DbContainer.Start();',
  '    public void Dispose() => _db.Stop();',
  '',
  '    [Fact] public void Test1() { … }',
  '    [Fact] public void Test2() { … }',
  '    // … 10 [Fact] tests in all',
  '}',
]
const L = { CLASS: 0, CTOR: 3, LIFE: [3, 4] as [number, number], T1: 6, T2: 7, REST: 8 }
const FIX_CODE = [
  'public class DbFixture : IAsyncLifetime',
  '{',
  '    public DbContainer Db { get; private set; } = null!;',
  '    public async Task InitializeAsync() => Db = await DbContainer.StartAsync();',
  '    public async Task DisposeAsync() => await Db.StopAsync();',
  '}',
  '',
  'public class OrderTests(DbFixture fixture) : IClassFixture<DbFixture>',
  '{',
  '    [Fact] public void Test1() { … } // uses fixture.Db',
  '    // … 10 [Fact] tests in all',
  '}',
]
const F = { INIT: 3, DISPOSE: 4, CLASS: 7, T1: 9, REST: 10 }
const NO_PARALLEL = [...CODE, '', '// the claim\'s fix:', '[assembly: CollectionBehavior(DisableTestParallelization = true)]']
const NP = { ATTR: 12 }

const INST: Region = { id: 'inst', name: 'Test class instances', sub: 'created by xUnit', tone: 'ui', wrap: true }
const FIX: Region = { id: 'fix', name: 'Class fixture', sub: 'one per test class', tone: 'pool' }
const DOCKER: Region = { id: 'docker', name: 'Docker', sub: 'database containers', tone: 'io', wrap: true }

const containers = (n: number | string, kind: OutLine['kind'] = 'plain'): OutLine[] => [{ label: 'Containers started', text: String(n), kind }]

/** A test class instance: its test, and the container it started (an arrow). */
const inst = (id: string, title: string, runs: string, container: string | null, kind?: Box['kind'], sub?: string): Box => ({
  id,
  region: 'inst',
  title,
  sub,
  kind,
  fields: [{ name: 'runs', value: runs }, ...(container ? [{ name: 'started', value: `container ${container}`, ref: `c-${container}` }] : [])],
})
const container = (n: string, kind?: Box['kind'], sub?: string): Box => ({ id: `c-${n}`, region: 'docker', title: `container ${n}`, sub, kind })

// ---- Reality, constructor per test ----
const i1 = (kind?: Box['kind']) => inst('i-1', 'OrderTests #1', 'Test1', '1', kind)
const i2 = (kind?: Box['kind']) => inst('i-2', 'OrderTests #2', 'Test2', '2', kind)
const iRest = inst('i-rest', 'OrderTests #3 … #10', 'Test3 … Test10', '3–10', 'bad', 'one per test')
const P = {
  test1: { boxes: [i1(), container('1')], line: L.T1, output: containers(1) },
  test2: { boxes: [i1('gone'), container('1', 'gone', 'stopped'), i2(), container('2')], line: L.T2, output: containers(2) },
  rest: {
    boxes: [i1('gone'), i2('gone'), iRest, container('1', 'gone', 'stopped'), container('2', 'gone', 'stopped'), container('3–10', 'bad', 'one per test')],
    line: L.REST,
    output: containers(10, 'bad'),
  },
} satisfies Record<string, GraphStep>
const perTest = (steps: Record<string, GraphStep>, code = CODE): GraphSpec => ({ regions: [INST, DOCKER], code, outputName: 'Docker', steps })

// ---- Reality, class fixture ----
const fixture = (kind?: Box['kind'], sub = 'created once'): Box => ({
  id: 'fixture',
  region: 'fix',
  title: 'DbFixture',
  sub,
  kind,
  fields: [{ name: 'Db', value: 'container 1', ref: 'c-1' }],
})
const user = (id: string, title: string, runs: string, kind?: Box['kind'], sub?: string): Box => ({
  id,
  region: 'inst',
  title,
  sub,
  kind,
  fields: [{ name: 'runs', value: runs }, { name: 'fixture', value: 'DbFixture', ref: 'fixture' }],
})

// ---- Claims ----
const shared = (runs: string, kind?: Box['kind']): Box[] => [inst('i-1', 'OrderTests #1', runs, '1', kind, 'the only instance (claimed)'), container('1')]
const perThread = (cores: number): Box[] => [
  inst('t-1', 'OrderTests, thread 1', 'its share of the tests', '1'),
  inst('t-n', `OrderTests, threads 2 … ${cores}`, 'the rest', `2–${cores}`, undefined, 'one per thread (claimed)'),
  container('1'),
  container(`2–${cores}`),
]

const SPECS: Record<string, GraphSpec> = {
  setup: perTest({
    class: { boxes: [{ id: 'cls', region: 'inst', title: 'OrderTests', sub: 'test class', fields: [{ name: '[Fact] tests', value: '10' }] }], line: L.CLASS },
    ctor: {
      boxes: [
        { id: 'cls', region: 'inst', title: 'OrderTests', sub: 'test class', fields: [{ name: '[Fact] tests', value: '10' }, { name: 'constructor', value: 'starts a container' }, { name: 'Dispose', value: 'stops it' }] },
      ],
      line: L.LIFE,
    },
    run: {
      boxes: [
        { id: 'cls', region: 'inst', title: 'OrderTests', sub: 'test class', fields: [{ name: '[Fact] tests', value: '10' }, { name: 'constructor', value: 'starts a container' }, { name: 'Dispose', value: 'stops it' }] },
        { id: 'q', region: 'docker', title: '?', sub: 'how many?', kind: 'muted' },
      ],
      line: L.CLASS,
      output: containers('?', 'muted'),
    },
  }),
  'per-test': perTest({ 'test-1': P.test1, 'test-2': P.test2, rest: P.rest }),
  'class-fixture': {
    regions: [INST, FIX, DOCKER],
    code: FIX_CODE,
    outputName: 'Docker',
    steps: {
      fixture: { boxes: [fixture(), container('1')], line: F.INIT, output: containers(1, 'ok') },
      'test-1': { boxes: [user('i-1', 'OrderTests #1', 'Test1'), fixture(), container('1')], line: F.CLASS, output: containers(1, 'ok') },
      rest: {
        boxes: [user('i-1', 'OrderTests #1', 'Test1', 'gone'), user('i-rest', 'OrderTests #2 … #10', 'Test2 … Test10', 'ok', 'one per test'), fixture('ok', 'shared by all 10'), container('1', 'ok')],
        line: F.REST,
        output: containers(1, 'ok'),
      },
      dispose: {
        boxes: [user('i-1', 'OrderTests #1', 'Test1', 'gone'), user('i-rest', 'OrderTests #2 … #10', 'Test2 … Test10', 'gone', 'one per test'), fixture('gone', 'disposed'), container('1', 'gone', 'stopped')],
        line: F.DISPOSE,
        output: containers(1, 'ok'),
      },
    },
  },

  'one-instance-claim': perTest({
    'test-1': { boxes: shared('Test1'), line: L.T1, output: containers(1) },
    'test-2': { boxes: shared('Test1, Test2'), line: L.T2, output: containers(1) },
    rest: { boxes: shared('Test1 … Test10'), line: L.REST, output: containers(1) },
  }),
  'one-instance-reality': perTest({ 'test-1': P.test1, 'test-2': P.test2, rest: P.rest }),

  'no-parallel-claim': perTest(
    {
      ten: { ...P.rest, line: L.CTOR },
      sequential: {
        boxes: [inst('i-1', 'OrderTests', 'Test1 … Test10', '1', undefined, 'one shared instance (claimed)'), container('1')],
        line: NP.ATTR,
        output: [...containers(1), { label: 'Tests run', text: 'one after another' }],
      },
    },
    NO_PARALLEL,
  ),
  'no-parallel-reality': perTest(
    {
      ten: { ...P.rest, line: L.CTOR },
      sequential: { ...P.rest, line: NP.ATTR, output: [...containers(10, 'bad'), { label: 'Tests run', text: 'one after another' }] },
    },
    NO_PARALLEL,
  ),

  'per-thread-claim': perTest({
    'four-cores': { boxes: perThread(4), line: L.CTOR, output: [...containers(4), { label: 'Machine', text: '4 cores' }] },
    'eight-cores': { boxes: perThread(8), line: L.CTOR, output: [...containers(8), { label: 'Machine', text: '8 cores' }] },
  }),
  'per-thread-reality': perTest({
    'four-cores': { ...P.rest, line: L.CTOR, output: [...containers(10, 'bad'), { label: 'Machine', text: '4 cores' }] },
    'eight-cores': { ...P.rest, line: L.CTOR, output: [...containers(10, 'bad'), { label: 'Machine', text: '8 cores' }] },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, spec]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={spec} {...p} />]),
)
export default drawing
