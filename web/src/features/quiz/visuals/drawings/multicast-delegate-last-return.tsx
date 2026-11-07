import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'Func<int> f = () => { Console.Write("a "); return 1; };',
  'f += () => { Console.Write("b "); return 2; };',
  'Console.WriteLine(f());',
]
const L = { FIRST: 0, SECOND: 1, CALL: 2 }

const REGIONS: Region[] = [
  { id: 'stack', name: 'Locals', sub: 'Main', tone: 'ui' },
  { id: 'heap', name: 'Heap', sub: 'delegates and their targets', tone: 'pool' },
]

/** `f` points at a delegate box (or is unknown: null); `result` is what f() has handed back so far. */
const main = (f: string | null, result?: string, kind?: Field['kind'], fKind?: Field['kind']): Box => ({
  id: 'main',
  region: 'stack',
  title: 'Main',
  fields: [
    f === null ? { name: 'f', value: '?', kind: 'muted' } : { name: 'f', ref: f, value: 'Func<int>', kind: fKind },
    ...(result === undefined ? [] : [{ name: 'f() value', value: result, kind }]),
  ],
})
const one: Box = { id: 'd1', region: 'heap', title: 'Func<int>', sub: 'invocation list', fields: [{ name: '[0]', ref: 'l1', value: 'lambda 1' }] }
const both = (kind?: Box['kind']): Box => ({
  id: 'd2',
  region: 'heap',
  title: 'Func<int>',
  sub: 'invocation list',
  kind,
  fields: [
    { name: '[0]', ref: 'l1', value: 'lambda 1' },
    { name: '[1]', ref: 'l2', value: 'lambda 2' },
  ],
})
const onlySecond: Box = { id: 'd2', region: 'heap', title: 'Func<int>', sub: 'invocation list', kind: 'bad', fields: [{ name: '[0]', ref: 'l2', value: 'lambda 2' }] }
const lambda = (n: 1 | 2, kind?: Box['kind'], sub?: string): Box => ({
  id: `l${n}`,
  region: 'heap',
  title: `lambda ${n}`,
  sub,
  kind,
  fields: [
    { name: 'writes', value: n === 1 ? '"a "' : '"b "' },
    { name: 'returns', value: String(n) },
  ],
})

const con = (text: string | null, kind?: OutLine['kind']): OutLine[] => [{ label: 'Console', text: text ?? 'nothing yet', kind: text === null ? 'muted' : kind }]
const spec = (steps: Record<string, GraphStep>): GraphSpec => ({ regions: REGIONS, code: CODE, outputName: 'Output', steps })

/** The real run, after `+=` built the two-entry list. */
const R = {
  combine: { boxes: [main('d2', undefined, undefined, 'ok'), both('ok'), lambda(1), lambda(2)], line: L.SECOND, output: con(null) },
  first: { boxes: [main('d2', '?', 'muted'), both(), lambda(1, 'ok', 'called'), lambda(2)], line: L.FIRST, output: con('a ') },
  second: { boxes: [main('d2', '2 (1 discarded)', 'ok'), both(), lambda(1, 'plain', 'called'), lambda(2, 'ok', 'called')], line: L.SECOND, output: con('a b ') },
  print: { boxes: [main('d2', '2', 'ok'), both(), lambda(1, 'plain', 'called'), lambda(2, 'plain', 'called')], line: L.CALL, output: con('a b 2', 'ok') },
} satisfies Record<string, GraphStep>
/** Both targets have run; the value is left open (the point of the following step). */
const BOTH_RAN: GraphStep = { boxes: [main('d2'), both(), lambda(1, 'plain', 'called'), lambda(2, 'ok', 'called')], line: L.CALL, output: con('a b ') }

const SPECS: Record<string, GraphSpec> = {
  setup: spec({
    first: { boxes: [main('d1'), one, lambda(1)], line: L.FIRST, output: con(null) },
    combine: { boxes: [main(null), one, lambda(1), lambda(2)], line: L.SECOND, output: con(null) },
    call: { boxes: [main(null, '?', 'muted'), one, lambda(1), lambda(2)], line: L.CALL, output: con('?', 'muted') },
  }),
  invoke: spec(R),

  'first-value-claim': spec({
    run: BOTH_RAN,
    value: { boxes: [main('d2', '1', 'bad'), both(), lambda(1, 'bad', 'its value kept'), lambda(2, 'plain', 'called')], line: L.CALL, bad: true, output: con('a b 1', 'bad') },
  }),
  'first-value-reality': spec({ run: BOTH_RAN, value: R.print }),

  'replace-claim': spec({
    combine: { boxes: [main('d2', undefined, undefined, 'bad'), onlySecond, lambda(1, 'muted', 'replaced'), lambda(2)], line: L.SECOND, bad: true, output: con(null) },
    call: { boxes: [main('d2', '2', 'bad'), { ...onlySecond, kind: 'plain' }, lambda(1, 'muted', 'replaced'), lambda(2, 'bad', 'called')], line: L.CALL, bad: true, output: con('b 2', 'bad') },
  }),
  'replace-reality': spec({ combine: R.combine, call: R.print }),

  'stop-claim': spec({
    first: R.first,
    stop: { boxes: [main('d2', '1', 'bad'), both(), lambda(1, 'plain', 'called'), lambda(2, 'muted', 'never called')], line: L.CALL, bad: true, output: con('a 1', 'bad') },
  }),
  'stop-reality': spec({ first: R.first, stop: R.print }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
