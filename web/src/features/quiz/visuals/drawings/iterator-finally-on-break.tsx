import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'foreach (var n in Numbers())',
  '{',
  '    Console.WriteLine(n);',
  '    if (n == 1) break;',
  '}',
  'Console.WriteLine("done");',
  '',
  'static IEnumerable<int> Numbers()',
  '{',
  '    try',
  '    {',
  '        yield return 1;',
  '        yield return 2;',
  '    }',
  '    finally',
  '    {',
  '        Console.WriteLine("cleanup");',
  '    }',
  '}',
]
const L = { LOOP: [0, 4] as [number, number], FOREACH: 0, PRINT: 2, BREAK: 3, DONE: 5, TRY: [9, 13] as [number, number], Y1: 11, Y2: 12, FINALLY: [14, 17] as [number, number], ALL_OUT: { each: [2, 5, 16] } }

const actors: SeqActor[] = [
  { id: 'main', name: 'Program', sub: 'the foreach loop', tone: 'ui' },
  { id: 'it', name: 'Numbers()', sub: 'iterator', tone: 'pool' },
]
const spec = (steps: Record<string, SeqStep>): SeqSpec => ({ actors, code: CODE, outputName: 'Console', steps })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const out = (...lines: [string, OutLine['kind']?][]): OutLine[] => lines.map(([text, kind], i) => ({ label: `line ${i + 1}`, text, kind }))
const ASK: OutLine[] = [{ label: 'line 1', text: '1' }, { label: 'then', text: '?', kind: 'muted' }]

const moveNext = msg('mn', 'main', 'it', 'MoveNext()')
const suspended = note('y1', 'it', 'try: yield return 1')
const one = msg('one', 'it', 'main', 'true, Current = 1')
const printed = note('p1', 'main', 'prints 1')
const FIRST = [moveNext, suspended, one, printed]
const brk = note('break', 'main', 'break')
const noMore = note('break', 'main', 'break: no more MoveNext', 'ok')
const dispose = msg('dispose', 'main', 'it', 'Dispose()', 'ok')
const fin = note('fin', 'it', 'finally: prints "cleanup"', 'ok')
const back = msg('back', 'it', 'main', 'Dispose returns')
const done = note('done', 'main', 'prints "done"')
const REAL = [...FIRST, noMore, dispose, fin, back, done]
const REAL_OUT = out(['1'], ['cleanup', 'ok'], ['done'])

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    loop: { rows: [...FIRST, brk], line: L.LOOP, output: ASK },
    iterator: { rows: [...FIRST, brk], line: { each: [L.TRY, L.FINALLY] }, output: ASK },
    question: { rows: [...FIRST, brk, note('q-main', 'main', '?', 'muted'), note('q-it', 'it', '?', 'muted')], line: L.DONE, output: ASK },
  }),

  dispose: spec({
    first: { rows: FIRST, line: L.Y1, output: out(['1']) },
    break: { rows: [...FIRST, noMore], line: L.BREAK, output: out(['1']) },
    dispose: { rows: [...FIRST, noMore, dispose], line: L.LOOP, output: out(['1']) },
    cleanup: { rows: [...FIRST, noMore, dispose, fin], line: L.FINALLY, output: out(['1'], ['cleanup', 'ok']) },
    done: { rows: REAL, line: L.DONE, output: REAL_OUT },
  }),

  'end-only-claim': spec({
    break: { rows: [...FIRST, brk, note('only-end', 'it', 'finally only at the end', 'bad')], line: L.FINALLY, bad: true, output: out(['1']) },
    done: {
      rows: [...FIRST, brk, note('only-end', 'it', 'finally only at the end', 'bad'), note('skipped', 'it', 'finally never runs', 'bad'), done],
      line: L.DONE,
      output: out(['1'], ['done', 'bad']),
    },
  }),
  'end-only-reality': spec({
    break: { rows: [...FIRST, noMore, dispose], line: L.LOOP, output: out(['1']) },
    done: { rows: REAL, line: L.FINALLY, output: REAL_OUT },
  }),

  'later-claim': spec({
    break: { rows: [...FIRST, brk, note('left', 'it', 'left suspended', 'bad')], line: L.BREAK, bad: true, output: out(['1']) },
    done: {
      rows: [...FIRST, brk, note('left', 'it', 'left suspended', 'bad'), done, note('later', 'it', 'later (GC or exit): "cleanup"', 'bad')],
      line: L.DONE,
      output: out(['1'], ['done'], ['cleanup', 'bad']),
    },
  }),
  'later-reality': spec({
    break: { rows: [...FIRST, noMore, dispose], line: L.LOOP, output: out(['1']) },
    done: { rows: REAL, line: L.ALL_OUT, output: REAL_OUT },
  }),

  'resume-claim': spec({
    next: {
      rows: [...FIRST, msg('mn2', 'main', 'it', 'MoveNext()', 'bad'), msg('two', 'it', 'main', 'true, Current = 2', 'bad'), note('p2', 'main', 'prints 2', 'bad')],
      line: L.Y2,
      bad: true,
      output: out(['1'], ['2', 'bad']),
    },
    end: {
      rows: [...FIRST, msg('mn2', 'main', 'it', 'MoveNext()', 'bad'), msg('two', 'it', 'main', 'true, Current = 2', 'bad'), note('p2', 'main', 'prints 2', 'bad'), note('fin', 'it', 'finally: prints "cleanup"'), done],
      line: { each: [L.FINALLY, L.DONE] },
      output: out(['1'], ['2', 'bad'], ['cleanup'], ['done']),
    },
  }),
  'resume-reality': spec({
    next: { rows: [...FIRST, noMore, note('no-two', 'it', '2 never yielded', 'muted')], line: L.BREAK, output: out(['1']) },
    end: { rows: [...FIRST, noMore, note('no-two', 'it', '2 never yielded', 'muted'), dispose, fin, back, done], line: L.FINALLY, output: REAL_OUT },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
