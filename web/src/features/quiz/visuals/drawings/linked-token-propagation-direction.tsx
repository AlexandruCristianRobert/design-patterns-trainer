import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { LineAt } from '../CodePanel'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'using var parent = new CancellationTokenSource();',
  'using var child = CancellationTokenSource',
  '    .CreateLinkedTokenSource(parent.Token);',
  'child.Cancel();',
  'Console.WriteLine(',
  '    $"{parent.IsCancellationRequested} " +',
  '    $"{child.IsCancellationRequested}");',
  '',
  'using var parent2 = new CancellationTokenSource();',
  'using var child2 = CancellationTokenSource',
  '    .CreateLinkedTokenSource(parent2.Token);',
  'parent2.Cancel();',
  'Console.WriteLine(',
  '    $"{parent2.IsCancellationRequested} " +',
  '    $"{child2.IsCancellationRequested}");',
]
const FIRST = CODE.slice(0, 7)
const SECOND = CODE.slice(8)
/** Line numbers in CODE; the second pair's lines are also used, shifted by 8, in SECOND. */
const L = { LINK1: [1, 2] as [number, number], CANCEL1: 3, PRINT1: [4, 6] as [number, number], LINK2: [9, 10] as [number, number], CANCEL2: 11, PRINT2: [12, 14] as [number, number] }
const shift = ([a, b]: [number, number]): [number, number] => [a - 8, b - 8]

const SRC: Region = { id: 'src', name: 'Sources', tone: 'ui' }
const LINKED: Region = { id: 'linked', name: 'Linked sources', tone: 'pool' }
const REGIONS = [SRC, LINKED]

type Val = '?' | 'false' | 'true'
const cancelled = (v: Val, kind?: Field['kind']): Field => ({ name: 'cancelled', value: v, kind: kind ?? (v === '?' ? 'muted' : 'plain') })
/** The callback a linked source registers on its source's token. */
const hook = (target: string, kind?: Field['kind']): Field => ({ name: 'callback', value: `cancel ${target}`, ref: target, kind })
const none: Field = { name: 'callbacks', value: 'none', kind: 'muted' }

const parent = (n: '' | '2', fields: Field[]): Box => ({ id: `parent${n}`, region: 'src', title: `parent${n}`, fields })
const child = (n: '' | '2', fields: Field[]): Box => ({ id: `child${n}`, region: 'linked', title: `child${n}`, fields })
const from = (n: '' | '2'): Field => ({ name: 'from', value: `parent${n}.Token` })

const line = (n: 1 | 2, text: string, kind?: OutLine['kind']): OutLine => ({ label: `line ${n}`, text, kind })
const step = (boxes: Box[], at: LineAt, output?: OutLine[], bad = false): GraphStep => ({ boxes, line: at, output, bad })
const spec = (steps: Record<string, GraphStep>, code = CODE): GraphSpec => ({ regions: REGIONS, code, outputName: 'Console', steps })

// ---- Setup: the two pairs, results unknown ----
const PAIR1_SETUP = [parent('', [cancelled('?')]), child('', [from(''), cancelled('?')])]
const PAIR2_SETUP = [parent('2', [cancelled('?')]), child('2', [from('2'), cancelled('?')])]

// ---- Reality ----
const pair1 = (p: Field, c: Field, hookKind?: Field['kind']) => [parent('', [p, hook('child', hookKind)]), child('', [c, none])]
const pair2 = (p: Field, c: Field, hookKind?: Field['kind']) => [parent('2', [p, hook('child2', hookKind)]), child('2', [c, none])]
const LINE1 = line(1, 'False True', 'ok')
const LINE2 = line(2, 'True True', 'ok')

const SPECS: Record<string, GraphSpec> = {
  setup: spec({
    first: step(PAIR1_SETUP, { each: [L.LINK1, L.CANCEL1] }),
    second: step([...PAIR1_SETUP, ...PAIR2_SETUP], { each: [L.LINK2, L.CANCEL2] }),
    question: step([...PAIR1_SETUP, ...PAIR2_SETUP], { each: [L.PRINT1, L.PRINT2] }, [line(1, '? ?', 'muted'), line(2, '? ?', 'muted')]),
  }),

  'cancel-child': spec(
    {
      link: step(pair1(cancelled('false'), cancelled('false')), L.LINK1),
      cancel: step(pair1(cancelled('false'), cancelled('true', 'ok')), L.CANCEL1),
      print: step(pair1(cancelled('false', 'ok'), cancelled('true', 'ok')), L.PRINT1, [LINE1]),
    },
    FIRST,
  ),
  'cancel-parent': spec(
    {
      link: step(pair2(cancelled('false'), cancelled('false')), shift(L.LINK2)),
      cancel: step(pair2(cancelled('true'), cancelled('false')), L.CANCEL2 - 8),
      propagate: step(pair2(cancelled('true'), cancelled('true', 'ok'), 'ok'), L.CANCEL2 - 8),
      print: step(pair2(cancelled('true', 'ok'), cancelled('true', 'ok'), 'ok'), shift(L.PRINT2), [LINE2]),
    },
    SECOND,
  ),

  'two-way-claim': spec({
    cancel: step([parent('', [cancelled('false')]), child('', [cancelled('true')])], L.CANCEL1),
    back: step([parent('', [cancelled('true', 'bad')]), child('', [cancelled('true')])], L.CANCEL1, [line(1, 'True True', 'bad'), line(2, 'True True')], true),
  }),
  'two-way-reality': spec({
    cancel: step(pair1(cancelled('false'), cancelled('true')), L.CANCEL1),
    back: step(pair1(cancelled('false', 'ok'), cancelled('true')), L.CANCEL1, [LINE1, line(2, 'True True')]),
  }),

  'no-propagation-claim': spec({
    first: step([parent('2', [cancelled('false')]), child('2', [cancelled('false')])], L.PRINT1, [line(1, 'False True')]),
    cancel: step([parent('2', [cancelled('true')]), child('2', [cancelled('false', 'bad')])], L.CANCEL2, [line(1, 'False True'), line(2, 'True False', 'bad')], true),
  }),
  'no-propagation-reality': spec({
    first: step(pair2(cancelled('false'), cancelled('false')), L.PRINT1, [line(1, 'False True')]),
    cancel: step(pair2(cancelled('true'), cancelled('true', 'ok'), 'ok'), L.CANCEL2, [line(1, 'False True'), LINE2]),
  }),

  'cancels-parent-claim': spec({
    cancel: step([parent('', [cancelled('true', 'bad')]), child('', [cancelled('false', 'bad')])], L.CANCEL1, [line(1, 'True False', 'bad')], true),
    second: step([parent('', [cancelled('true', 'bad')]), child('', [cancelled('false', 'bad')])], L.PRINT2, [line(1, 'True False', 'bad'), line(2, 'True True')]),
  }),
  'cancels-parent-reality': spec({
    cancel: step(pair1(cancelled('false', 'ok'), cancelled('true', 'ok')), L.CANCEL1, [LINE1]),
    second: step(pair1(cancelled('false', 'ok'), cancelled('true', 'ok')), L.PRINT2, [LINE1, line(2, 'True True')]),
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
