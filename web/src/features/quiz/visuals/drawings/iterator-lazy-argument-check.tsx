import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'var evens = Evens(-1);',
  'Console.WriteLine("created");',
  'try',
  '{',
  '    foreach (var n in evens) Console.WriteLine(n);',
  '}',
  'catch (ArgumentOutOfRangeException)',
  '{',
  '    Console.WriteLine("thrown");',
  '}',
  '',
  'static IEnumerable<int> Evens(int max)',
  '{',
  '    if (max < 0) throw new ArgumentOutOfRangeException(nameof(max));',
  '    for (var i = 0; i <= max; i += 2) yield return i;',
  '}',
]
const L = { CALL: 0, CREATED: 1, LOOP: [1, 9] as [number, number], FOREACH: 4, CATCH: [6, 8] as [number, number], GUARD: 13, YIELD: 14 }

const actors: SeqActor[] = [
  { id: 'main', name: 'Program', sub: 'top-level code', tone: 'ui' },
  { id: 'evens', name: 'Evens', sub: 'local function', tone: 'pool' },
]
const spec = (steps: Record<string, SeqStep>): SeqSpec => ({ actors, code: CODE, outputName: 'Console', steps })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const out = (...lines: [string, OutLine['kind']?][]): OutLine[] =>
  lines.length ? lines.map(([text, kind], i) => ({ label: `line ${i + 1}`, text, kind })) : [{ label: 'output', text: 'nothing', kind: 'bad' }]
const UNKNOWN: OutLine[] = [{ label: 'output', text: '?', kind: 'muted' }]

const call = msg('call', 'main', 'evens', 'Evens(-1)')
const object = msg('object', 'evens', 'main', 'enumerable, body not run', 'ok')
const created = note('created', 'main', 'prints "created"')
const moveNext = msg('mn', 'main', 'evens', 'MoveNext()')
const guard = note('guard', 'evens', 'guard: -1 < 0, throws', 'bad')
const thrown = msg('ex', 'evens', 'main', 'ArgumentOutOfRangeException', 'bad')
const caught = note('caught', 'main', 'catch prints "thrown"', 'ok')
const START = [call, object, created]
const REAL_OUT = out(['created'], ['thrown', 'ok'])

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    call: { rows: [call, note('q', 'evens', '?', 'muted')], line: L.CALL, output: UNKNOWN },
    loop: { rows: [call, note('q', 'evens', '?', 'muted')], line: L.LOOP, output: UNKNOWN },
  }),

  deferred: spec({
    call: { rows: [call, object], line: L.CALL, output: [{ label: 'output', text: 'nothing yet', kind: 'muted' }] },
    created: { rows: START, line: L.CREATED, output: out(['created']) },
    'move-next': { rows: [...START, moveNext, note('body', 'evens', 'body starts, from the top')], line: L.FOREACH, output: out(['created']) },
    guard: { rows: [...START, moveNext, guard], line: L.GUARD, bad: true, output: out(['created']) },
    catch: { rows: [...START, moveNext, guard, thrown, caught], line: L.CATCH, output: REAL_OUT },
  }),

  'eager-claim': spec({
    call: { rows: [call, note('guard-now', 'evens', 'guard runs now, throws', 'bad')], line: L.GUARD, bad: true },
    crash: {
      rows: [call, note('guard-now', 'evens', 'guard runs now, throws', 'bad'), msg('ex', 'evens', 'main', 'ArgumentOutOfRangeException', 'bad'), note('unhandled', 'main', 'outside the try: unhandled', 'bad')],
      line: L.CALL,
      bad: true,
      output: out(),
    },
  }),
  'eager-reality': spec({
    call: { rows: [call, object], line: L.CALL },
    crash: { rows: [...START, moveNext, guard, thrown, caught], line: L.CATCH, output: REAL_OUT },
  }),

  'empty-claim': spec({
    'move-next': { rows: [...START, moveNext, msg('false', 'evens', 'main', 'false: no elements', 'bad')], line: L.FOREACH, bad: true, output: out(['created']) },
    end: { rows: [...START, moveNext, msg('false', 'evens', 'main', 'false: no elements', 'bad'), note('ends', 'main', 'loop ends, no exception', 'bad')], line: L.FOREACH, bad: true, output: out(['created']) },
  }),
  'empty-reality': spec({
    'move-next': { rows: [...START, moveNext, note('body', 'evens', 'body starts, from the top')], line: L.GUARD, output: out(['created']) },
    end: { rows: [...START, moveNext, note('body', 'evens', 'body starts, from the top'), guard, thrown, caught], line: L.CATCH, output: REAL_OUT },
  }),

  'yield-zero-claim': spec({
    first: { rows: [...START, moveNext, msg('zero', 'evens', 'main', 'true, Current = 0', 'bad')], line: L.YIELD, bad: true, output: out(['created'], ['0', 'bad']) },
    second: {
      rows: [...START, moveNext, msg('zero', 'evens', 'main', 'true, Current = 0', 'bad'), msg('mn2', 'main', 'evens', 'MoveNext()'), thrown, caught],
      line: L.CATCH,
      output: out(['created'], ['0', 'bad'], ['thrown']),
    },
  }),
  'yield-zero-reality': spec({
    first: { rows: [...START, moveNext, guard], line: L.GUARD, bad: true, output: out(['created']) },
    second: { rows: [...START, moveNext, guard, thrown, caught, note('none', 'evens', 'no element produced', 'muted')], line: L.CATCH, output: REAL_OUT },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
