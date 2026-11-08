import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type ChipKind, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const TEST = [
  '[Fact]',
  'public void Gold_customer_gets_10_percent_off()',
  '{',
  '    var price = Pricing.Apply(100m, Tier.Gold);',
  '    Assert.Equal(90m, price);',
  '}',
]
const BROKEN = [
  '[Fact]',
  'public void Gold_customer_gets_10_percent_off()',
  '{',
  '    var order = new Order(100m, Tier.Gold);',
  '    var price = Pricing.Apply(order);',
  '    Assert.Equal(100m, order.Amount);',
  '}',
]

const ROW: Record<string, RowDef> = {
  test: { id: 'test', name: 'Test', sub: 'the new test', tone: 'ui' },
  code: { id: 'code', name: 'Discount', sub: 'production code', tone: 'pool' },
  runs: { id: 'runs', name: 'Runs', sub: 'on the dev machine', tone: 'muted' },
  compiler: { id: 'compiler', name: 'Compiler', tone: 'muted' },
  ide: { id: 'ide', name: 'IDE', tone: 'muted' },
  perf: { id: 'perf', name: 'Baseline', sub: 'for perf work', tone: 'io' },
  ci: { id: 'ci', name: 'CI', sub: 'build history', tone: 'io' },
}
const rows = (...ids: string[]) => ids.map((id) => ROW[id])
const spec = (r: RowDef[], steps: Record<string, RowStep>, code = TEST): RowSpec => ({ rows: r, code, steps })
const chip = (key: string, label: string, kind: ChipKind = 'item'): Chip => ({ key, label, kind })

const NEW_TEST = chip('t', 'gold discount test')
const NOT_YET = chip('c', 'not implemented (returns 100)', 'wait')
const RED = chip('r1', 'red: expected 90, got 100', 'bad')
const RIGHT = chip('why', 'fails for the right reason', 'ok')
const GREEN2 = chip('r2', 'green', 'ok')
const BASE = rows('test', 'code', 'runs')

const SPECS: Record<string, RowSpec> = {
  // ---- Setup: the test and the missing code; no run drawn ----
  setup: spec(rows('test', 'code'), {
    test: { rows: { test: [NEW_TEST] }, line: [0, 5] },
    missing: { rows: { test: [NEW_TEST], code: [NOT_YET] }, line: 3 },
    ask: { rows: { test: [NEW_TEST], code: [NOT_YET] }, line: null },
  }),

  cycle: spec(BASE, {
    red: { rows: { test: [NEW_TEST], code: [NOT_YET], runs: [RED, RIGHT] }, line: 4 },
    green: { rows: { test: [NEW_TEST], code: [chip('c', 'discount added', 'ok')], runs: [RED, GREEN2] }, line: 3 },
    refactor: { rows: { test: [NEW_TEST], code: [chip('c', 'refactored', 'ok')], runs: [RED, GREEN2, chip('r3', 'green', 'ok')] }, line: null },
  }),
  broken: spec(
    BASE,
    {
      bug: { rows: { test: [chip('t', 'asserts on the input', 'bad')], code: [NOT_YET] }, line: 5 },
      green: { rows: { test: [chip('t', 'asserts on the input', 'bad')], code: [NOT_YET], runs: [chip('r1', 'green, red expected', 'bad'), chip('why', 'test is broken', 'ok')] }, line: 5 },
    },
    BROKEN,
  ),

  'stubs-claim': spec(rows('test', 'compiler', 'code', 'runs'), {
    run: { rows: { test: [NEW_TEST], code: [NOT_YET], runs: [chip('r1', 'red')] }, line: 3 },
    stubs: { rows: { test: [NEW_TEST], compiler: [chip('s', 'generates stubs')], code: [chip('c', 'stub: Apply()')], runs: [chip('r1', 'red')] }, line: 3 },
  }),
  'stubs-reality': spec(rows('test', 'compiler', 'ide', 'code', 'runs'), {
    none: { rows: { test: [NEW_TEST], compiler: [chip('s', 'no stubs', 'bad')], ide: [chip('i', 'quick action: optional')], code: [NOT_YET] }, line: 3 },
    purpose: { rows: { test: [NEW_TEST], compiler: [chip('s', 'no stubs', 'bad')], ide: [chip('i', 'quick action: optional')], code: [NOT_YET], runs: [RED, RIGHT] }, line: 4 },
  }),

  'timing-claim': spec(rows('test', 'runs', 'perf'), {
    run: { rows: { test: [NEW_TEST], runs: [chip('r1', 'red: run time measured')] }, line: null },
    baseline: { rows: { test: [NEW_TEST], runs: [chip('r1', 'red: run time measured')], perf: [chip('b', 'baseline: that time')] }, line: null },
  }),
  'timing-reality': spec(rows('test', 'runs', 'perf'), {
    unrelated: { rows: { test: [NEW_TEST], runs: [RED, RIGHT], perf: [chip('b', 'not the purpose', 'bad')] }, line: 4 },
    useless: { rows: { test: [NEW_TEST], runs: [RED, chip('fast', 'no real work ran', 'bad')], perf: [chip('b', 'measures nothing real', 'bad')] }, line: 3 },
  }),

  'ci-claim': spec(rows('test', 'runs', 'ci'), {
    push: { rows: { test: [NEW_TEST], runs: [chip('r1', 'red')], ci: [chip('c1', 'build: red')] }, line: null },
    required: { rows: { test: [NEW_TEST], runs: [chip('r1', 'red')], ci: [chip('c1', 'build: red'), chip('req', 'required per feature')] }, line: null },
  }),
  'ci-reality': spec(rows('test', 'runs', 'ci'), {
    local: { rows: { test: [NEW_TEST], runs: [RED, GREEN2, chip('t', 'minutes, local', 'ok')] }, line: null },
    green: { rows: { test: [NEW_TEST], runs: [RED, GREEN2, chip('t', 'minutes, local', 'ok')], ci: [chip('c1', 'push: green', 'ok'), chip('c2', 'build: green', 'ok')] }, line: null },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
