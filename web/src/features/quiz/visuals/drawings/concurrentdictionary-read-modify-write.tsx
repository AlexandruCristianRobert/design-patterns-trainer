import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'ConcurrentDictionary<string, int> _hits = new();',
  '',
  '// each request thread runs:',
  '_hits[key] = _hits.GetValueOrDefault(key) + 1;',
]
const STMT = 3
const AOU_CODE = CODE.map((l, i) => (i === STMT ? '_hits.AddOrUpdate(key, 1, (_, n) => n + 1);' : l))
const INC_CODE = CODE.map((l, i) => (i === STMT ? 'Interlocked.Increment(ref _hits[key]);' : l))
const BOX_CODE = [
  'ConcurrentDictionary<string, StrongBox<int>> _hits = new();',
  '',
  '// each request thread runs:',
  'var box = _hits.GetOrAdd(key, _ => new StrongBox<int>());',
  'Interlocked.Increment(ref box.Value);',
]
const VOL_CODE = CODE.map((l, i) => (i === 0 ? 'volatile ConcurrentDictionary<string, int> _hits = new();' : l))

const A: SeqActor = { id: 'a', name: 'Thread A', tone: 'ui' }
const B: SeqActor = { id: 'b', name: 'Thread B', tone: 'pool' }
const HOME: SeqActor = { id: 'home', name: '"home"', sub: 'entry', tone: 'io' }
const ACTORS = [A, HOME, B]

const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const out = (count: string, hits: string, kind?: OutLine['kind']): OutLine[] => [
  { label: 'count', text: count, kind },
  { label: 'hits', text: hits },
]
const spec = (code: string[], steps: Record<string, SeqStep>): SeqSpec => ({ actors: ACTORS, code, outputName: 'Counter', steps })

// ---- Two calls: both read 5, both write 6 ----
const readA = row('ra', 'home', 'read: 5', 'a')
const readB = row('rb', 'home', 'read: 5', 'b')
const writeA = row('wa', 'a', 'write 6', 'home')
const writeB = row('wb', 'b', 'write 6', 'home', 'bad')
const LOST = [readA, readB, writeA, writeB]
const LOST_STEP: SeqStep = { rows: LOST, line: STMT, bad: true, output: out('6', '2', 'bad') }

// ---- AddOrUpdate ----
const calcA = row('ca', 'a', '5 → 6')
const calcB = row('cb', 'b', '5 → 6')
const COMPUTED = [readA, readB, calcA, calcB]
const swapB = row('sb', 'b', 'if 5: store 6', 'home', 'ok')
const failA = row('fa', 'a', 'if 5: fails', 'home', 'bad')
const rereadA = row('rra', 'home', 'read: 6', 'a')
const calcA2 = row('ca2', 'a', '6 → 7')
const swapA = row('sa', 'a', 'if 6: store 7', 'home', 'ok')
const RETRIED = [...COMPUTED, swapB, failA, rereadA, calcA2]
const SWAPPED = [...RETRIED, swapA]

// ---- Claims ----
const oneA = row('oa', 'a', '5 → 6', 'home')
const oneB = row('ob', 'b', '6 → 7', 'home')

const SPECS: Record<string, SeqSpec> = {
  setup: spec(CODE, {
    run: { rows: [row('hits', 'home', 'hits from A and B')], line: STMT },
    result: { rows: [row('hits', 'home', 'hits from A and B')], line: STMT, output: out('lower than hits', 'many', 'bad') },
  }),

  'two-calls': spec(CODE, {
    'read-a': { rows: [readA], line: STMT, output: out('5', '0 of 2') },
    'read-b': { rows: [readA, readB], line: STMT, output: out('5', '0 of 2') },
    write: LOST_STEP,
    lost: { rows: [...LOST, row('one', 'home', '+1 for 2 hits', undefined, 'bad')], line: STMT, bad: true, output: out('6', '2', 'bad') },
  }),
  'add-or-update': spec(AOU_CODE, {
    compute: { rows: COMPUTED, line: STMT, output: out('5', '0 of 2') },
    'swap-b': { rows: [...COMPUTED, swapB], line: STMT, output: out('6', '1 of 2') },
    'retry-a': { rows: RETRIED, line: STMT, output: out('6', '1 of 2') },
    'swap-a': { rows: SWAPPED, line: STMT, output: out('7', '2 of 2', 'ok') },
    pure: { rows: [...SWAPPED, row('runs-a', 'a', 'ran 2×', undefined, 'muted'), row('runs-b', 'b', 'ran 1×', undefined, 'muted')], line: STMT, output: out('7', '2 of 2', 'ok') },
  }),

  'atomic-claim': spec(CODE, {
    a: { rows: [oneA], line: STMT, output: out('6', '1 of 2') },
    b: { rows: [oneA, oneB], line: STMT, output: out('7', '2 of 2') },
  }),
  'atomic-reality': spec(CODE, {
    calls: { rows: [readA, writeA], line: STMT, output: out('6', '1 of 2') },
    gap: { rows: [readA, readB], line: STMT, output: out('5', '0 of 2') },
    lost: LOST_STEP,
  }),

  'interlocked-claim': spec(INC_CODE, {
    change: { rows: [row('a', 'a', 'Increment(ref …)')], line: STMT, output: out('5', '0') },
    inc: { rows: [row('a', 'a', 'in place: 5 → 6', 'home')], line: STMT, output: out('6', '1') },
  }),
  'interlocked-reality': spec(INC_CODE, {
    copy: { rows: [row('copy', 'home', 'copy: 5', 'a'), row('nref', 'a', 'no ref to slot')], line: STMT, output: out('5', '0') },
    error: {
      rows: [row('copy', 'home', 'copy: 5', 'a'), row('nref', 'a', 'no ref to slot'), row('err', 'a', 'CS0206', undefined, 'bad')],
      line: STMT,
      bad: true,
      output: [{ label: 'build', text: 'error CS0206', kind: 'bad' }],
    },
    box: {
      rows: [row('get', 'home', 'its box', 'a'), row('inc', 'a', 'box: 5 → 6', 'home', 'ok')],
      line: 4,
      code: BOX_CODE,
      output: [{ label: 'build', text: 'ok', kind: 'ok' }, ...out('6', '1 of 1')],
    },
  }),

  'volatile-claim': spec(VOL_CODE, {
    change: { rows: [row('a', 'a', 'count a hit'), row('b', 'b', 'count a hit')], line: 0, output: out('5', '0') },
    a: { rows: [row('ra', 'home', 'latest: 5', 'a'), row('wa', 'a', 'write 6', 'home')], line: STMT, output: out('6', '1') },
    b: {
      rows: [row('ra', 'home', 'latest: 5', 'a'), row('wa', 'a', 'write 6', 'home'), row('rb', 'home', 'latest: 6', 'b'), row('wb', 'b', 'write 7', 'home')],
      line: STMT,
      output: out('7', '2'),
    },
  }),
  'volatile-reality': spec(VOL_CODE, {
    field: { rows: [row('f', 'a', '_hits ref: volatile'), row('v', 'home', 'value: as before', undefined, 'muted')], line: 0, output: out('5', '0') },
    fresh: { rows: [row('ra', 'home', 'fresh: 5', 'a'), row('rb', 'home', 'fresh: 5', 'b')], line: STMT, output: out('5', '0 of 2') },
    lost: {
      rows: [row('ra', 'home', 'fresh: 5', 'a'), row('rb', 'home', 'fresh: 5', 'b'), writeA, writeB],
      line: STMT,
      bad: true,
      output: out('6', '2 of 2', 'bad'),
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
