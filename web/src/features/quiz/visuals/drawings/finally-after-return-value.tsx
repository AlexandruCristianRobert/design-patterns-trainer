import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'var box = new Box();',
  'Console.WriteLine(box.Next());',
  'Console.WriteLine(box.Value);',
  '',
  'class Box',
  '{',
  '    public int Value = 1;',
  '',
  '    public int Next()',
  '    {',
  '        try { return Value; }',
  '        finally { Value++; }',
  '    }',
  '}',
]
const L = { NEW: 0, CALL: 1, READ: 2, BODY: [10, 11] as [number, number], RETURN: 10, FINALLY: 11 }

const REGIONS: Region[] = [
  { id: 'stack', name: 'Stack', sub: 'method frames', tone: 'ui' },
  { id: 'heap', name: 'Heap', sub: 'objects', tone: 'pool' },
]

const main: Box = { id: 'main', region: 'stack', title: 'Main', fields: [{ name: 'box', ref: 'obj', value: 'Box' }] }
/** Next()'s frame: `this` and the slot that holds the value chosen to return (null: not drawn, as in the Setup). */
const next = (ret: string | null, kind?: Field['kind'], box?: Box['kind']): Box => ({
  id: 'next',
  region: 'stack',
  title: 'Next()',
  kind: box,
  fields: [
    { name: 'this', ref: 'obj', value: 'Box' },
    ...(ret === null ? [] : [{ name: 'return value', value: ret, kind }]),
  ],
})
const obj = (value: number, kind?: Field['kind']): Box => ({ id: 'obj', region: 'heap', title: 'Box object', fields: [{ name: 'Value', value: String(value), kind }] })

const out = (a: string, b: string, ka?: OutLine['kind'], kb?: OutLine['kind']): OutLine[] => [
  { label: 'line 1', text: a, kind: a === '?' ? 'muted' : ka },
  { label: 'line 2', text: b, kind: b === '?' ? 'muted' : kb },
]
const spec = (steps: Record<string, GraphStep>): GraphSpec => ({ regions: REGIONS, code: CODE, outputName: 'Console', steps })
const UNKNOWN = out('?', '?')

/** The real run. */
const R = {
  create: { boxes: [main, obj(1)], line: L.NEW, output: UNKNOWN },
  evaluate: { boxes: [main, next('1 (saved)', 'ok'), obj(1)], line: L.RETURN, output: UNKNOWN },
  finally: { boxes: [main, next('1 (saved)'), obj(2, 'ok')], line: L.FINALLY, output: UNKNOWN },
  return: { boxes: [main, obj(2)], line: L.CALL, output: out('1', '?', 'ok') },
  readField: { boxes: [main, obj(2)], line: L.READ, output: out('1', '2', 'plain', 'ok') },
} satisfies Record<string, GraphStep>

const SPECS: Record<string, GraphSpec> = {
  setup: spec({
    create: R.create,
    call: { boxes: [main, next(null), obj(1)], line: L.BODY, output: UNKNOWN },
    question: { boxes: [main, next(null), obj(1)], line: [L.CALL, L.READ], output: UNKNOWN },
  }),
  'return-then-finally': spec({ create: R.create, evaluate: R.evaluate, finally: R.finally, return: R.return, 'read-field': R.readField }),

  'read-after-finally-claim': spec({
    evaluate: { boxes: [main, next('not read yet', 'bad'), obj(1)], line: L.RETURN, bad: true, output: UNKNOWN },
    finally: { boxes: [main, next('not read yet', 'bad'), obj(2, 'ok')], line: L.FINALLY, output: UNKNOWN },
    return: { boxes: [main, next('2 (read now)', 'bad'), obj(2)], line: L.RETURN, bad: true, output: out('2', '?', 'bad') },
    'read-field': { boxes: [main, obj(2)], line: L.READ, output: out('2', '2', 'bad') },
  }),
  'read-after-finally-reality': spec({ evaluate: R.evaluate, finally: R.finally, return: R.return, 'read-field': R.readField }),

  'finally-skipped-claim': spec({
    evaluate: R.evaluate,
    return: { boxes: [main, obj(1, 'bad')], line: L.FINALLY, bad: true, output: out('1', '?') },
    'read-field': { boxes: [main, obj(1, 'bad')], line: L.READ, bad: true, output: out('1', '1', 'plain', 'bad') },
  }),
  'finally-skipped-reality': spec({ evaluate: R.evaluate, return: { boxes: [main, obj(2, 'ok')], line: L.FINALLY, output: out('1', '?') }, 'read-field': R.readField }),

  'two-increments-claim': spec({
    return: { boxes: [main, next('2', 'bad'), obj(2)], line: L.RETURN, bad: true, output: out('2', '?', 'bad') },
    'read-field': { boxes: [main, obj(3, 'bad')], line: L.READ, bad: true, output: out('2', '3', 'bad', 'bad') },
  }),
  'two-increments-reality': spec({ return: { boxes: [main, next('1 (saved)', 'ok'), obj(2)], line: L.BODY, output: out('1', '?', 'ok') }, 'read-field': R.readField }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
