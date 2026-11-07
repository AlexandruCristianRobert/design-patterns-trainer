import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const RUN = [
  'Run();',
  'Console.WriteLine("after");',
  '',
  'static void Run()',
  '{',
  '    using var a = new Resource("a");',
  '    using var b = new Resource("b");',
  '    Console.WriteLine("body");',
  '}',
  '',
  'sealed class Resource(string name) : IDisposable',
  '{',
  '    public void Dispose() => Console.WriteLine($"dispose {name}");',
  '}',
]
const R = { CALL: 0, AFTER: 1, A: 5, B: 6, BODY: 7, END: 8, DECLS: [5, 6] as [number, number] }
const LOWERED = [
  'static void Run()',
  '{',
  '  var a = new Resource("a");',
  '  try {',
  '    var b = new Resource("b");',
  '    try {',
  '      Console.WriteLine("body");',
  '    }',
  '    finally { b?.Dispose(); }',
  '  }',
  '  finally { a?.Dispose(); }',
  '}',
]
const W = { OUTER: [2, 10] as [number, number], INNER: [4, 8] as [number, number], BODY: 6, B_FIN: 8, A_FIN: 10 }

const RES: RowDef = { id: 'res', name: 'Resources', sub: 'created in Run', tone: 'pool' }
const CONSOLE: RowDef = { id: 'console', name: 'Console', sub: 'lines in order', tone: 'io' }
const spec = (code: string[], steps: Record<string, RowStep>, rows: RowDef[] = [RES, CONSOLE]): RowSpec => ({ rows, code, steps })

type State = 'open' | 'disposed' | 'undisposed' | 'claimed'
const res = (name: string, state: State): Chip => {
  if (state === 'open') return { key: name, label: `${name} open` }
  if (state === 'undisposed') return { key: name, label: `${name} not disposed`, kind: 'bad' }
  if (state === 'claimed') return { key: name, label: `${name} disposed`, kind: 'dead' }
  return { key: name, label: `${name} disposed`, kind: 'gone' }
}
const out = (...lines: string[]): Chip[] => lines.map((t, i) => ({ key: `c${i}`, label: t, kind: t === '?' ? 'wait' : 'item' }))
const step = (resources: Chip[], lines: string[], line: RowStep['line'], bad = false): RowStep => ({ rows: { res: resources, console: out(...lines) }, line, bad })

const open = (...names: string[]) => names.map((n) => res(n, 'open'))
const S = {
  declareA: step(open('a'), [], R.A),
  declareB: step(open('a', 'b'), [], R.B),
  body: step(open('a', 'b'), ['body'], R.BODY),
  bGone: step([res('a', 'open'), res('b', 'disposed')], ['body', 'dispose b'], R.END),
  aGone: step([res('a', 'disposed'), res('b', 'disposed')], ['body', 'dispose b', 'dispose a'], R.END),
  after: step([res('a', 'disposed'), res('b', 'disposed')], ['body', 'dispose b', 'dispose a', 'after'], R.AFTER),
}

const DECLARED: RowDef = { id: 'declared', name: 'Declared in Run', sub: 'using var', tone: 'muted' }
const SETUP_CONSOLE: RowDef = { id: 'console', name: 'Console', sub: 'four lines', tone: 'io' }
const declared: Chip[] = [
  { key: 'a', label: 'a' },
  { key: 'b', label: 'b' },
]

const SPECS: Record<string, RowSpec> = {
  setup: spec(
    RUN,
    {
      declare: { rows: { declared, console: [] }, line: R.DECLS },
      body: { rows: { declared, console: [] }, line: R.BODY },
      after: { rows: { declared, console: out('?', '?', '?', '?') }, line: [R.CALL, R.AFTER] },
    },
    [DECLARED, SETUP_CONSOLE],
  ),
  'scope-end': spec(RUN, { 'declare-a': S.declareA, 'declare-b': S.declareB, body: S.body, 'scope-ends': S.bGone, 'dispose-a': S.aGone, after: S.after }),
  lowered: spec(LOWERED, {
    outer: step(open('a'), [], W.OUTER),
    inner: step(open('a', 'b'), [], W.INNER),
    body: step(open('a', 'b'), ['body'], W.BODY),
    'inner-finally': { ...S.bGone, line: W.B_FIN },
    'outer-finally': { ...S.aGone, line: W.A_FIN },
  }),

  'declaration-order-claim': spec(RUN, {
    body: S.body,
    first: step([res('a', 'claimed'), res('b', 'open')], ['body', 'dispose a'], R.END),
    second: step([res('a', 'claimed'), res('b', 'claimed')], ['body', 'dispose a', 'dispose b', 'after'], R.AFTER),
  }),
  'declaration-order-reality': spec(LOWERED, {
    body: { ...S.body, line: W.BODY },
    first: { ...S.bGone, line: W.B_FIN },
    second: { ...S.after, line: W.A_FIN },
  }),

  'deferred-claim': spec(RUN, {
    body: S.body,
    'run-returns': step([res('a', 'undisposed'), res('b', 'undisposed')], ['body', 'after'], R.AFTER),
    later: step([res('a', 'claimed'), res('b', 'claimed')], ['body', 'after', 'dispose b', 'dispose a'], null),
  }),
  'deferred-reality': spec(RUN, { body: S.body, 'run-returns': S.bGone, later: S.after }),

  'end-of-line-claim': spec(RUN, {
    'declare-a': step([res('a', 'claimed')], ['dispose a'], R.A),
    'declare-b': step([res('a', 'claimed'), res('b', 'claimed')], ['dispose a', 'dispose b'], R.B),
    body: step([res('a', 'claimed'), res('b', 'claimed')], ['dispose a', 'dispose b', 'body', 'after'], [R.BODY, R.END]),
  }),
  'end-of-line-reality': spec(RUN, { 'declare-a': S.declareA, 'declare-b': S.declareB, body: S.body, 'scope-ends': S.after }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
