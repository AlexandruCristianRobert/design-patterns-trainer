import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'var holder = new Holder();',
  'holder.Bump();',
  'holder.Bump();',
  'Console.WriteLine(holder.Value);',
  '',
  'class Holder',
  '{',
  '    private readonly Counter _counter;',
  '    public void Bump() => _counter.Increment();',
  '    public int Value => _counter.Count;',
  '}',
  '',
  'struct Counter',
  '{',
  '    public int Count;',
  '    public void Increment() => Count++;',
  '}',
]
const L = { NEW: 0, CALL1: 1, CALL2: 2, PRINT: 3, FIELD: 7, BUMP: 8, VALUE: 9, INC: 15 }
const WRITABLE_CODE = CODE.map((line, i) => (i === L.FIELD ? '    private Counter _counter;  // not readonly' : line))
const COMPILE_CODE = [...CODE.slice(0, L.BUMP + 1), '    // _counter.Count = 1;    would be error CS1648', ...CODE.slice(L.BUMP + 1)]
const C = { BUMP: L.BUMP, ASSIGN: L.BUMP + 1, PRINT: L.PRINT }

const regions: Region[] = [
  { id: 'stack', name: 'Stack', tone: 'ui' },
  { id: 'heap', name: 'Heap', tone: 'pool' },
]
const spec = (steps: Record<string, GraphStep>, code = CODE, outputName = 'Output'): GraphSpec => ({ regions, code, outputName, steps })

const counter = (count: string) => `Counter { Count ${count} }`
const locals: Box = { id: 'locals', region: 'stack', title: 'locals', sub: 'top-level code', still: true, fields: [{ name: 'holder', value: 'Holder', ref: 'obj' }] }
const holder = (count: string, kind: Field['kind'] = 'inline', box?: Box['kind']): Box => ({
  id: 'obj',
  region: 'heap',
  title: 'Holder',
  kind: box,
  fields: [{ name: '_counter', value: counter(count), kind }],
})
/** A hidden temporary the compiler copies the field into; `gone` once the call has returned. */
const temp = (n: 1 | 2, count: string, kind: Box['kind'] = 'ok'): Box => ({
  id: `temp${n}`,
  region: 'stack',
  title: `hidden copy ${n}`,
  sub: `made for Bump call ${n}`,
  kind,
  fields: [{ name: 'value', value: counter(count), kind: 'inline' }],
})

const out = (text: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'output', text, kind }]
const UNKNOWN = out('?', 'muted')

/** The real run, step by step. */
const REAL = {
  'copy-1': { boxes: [locals, holder('0'), temp(1, '0')], line: { each: [L.CALL1, L.BUMP] } },
  'inc-1': { boxes: [locals, holder('0', 'ok'), temp(1, '1')], line: L.INC },
  'bump-2': { boxes: [locals, holder('0', 'ok'), temp(1, '1', 'gone'), temp(2, '1')], line: { each: [L.CALL2, L.BUMP] } },
  print: { boxes: [locals, holder('0', 'ok'), temp(1, '1', 'gone'), { ...temp(2, '1', 'gone'), still: true }], line: { each: [L.PRINT, L.VALUE] }, output: out('0', 'ok') },
} satisfies Record<string, GraphStep>

/** Compile time: nothing has run, so the data is drawn muted. */
const COMPILED: Box[] = [locals, holder('0')].map((b) => ({ ...b, kind: 'muted' as const }))

const SPECS: Record<string, GraphSpec> = {
  setup: spec({
    holder: { boxes: [{ ...locals, still: false }, holder('0')], line: { each: [L.NEW, L.FIELD] }, output: UNKNOWN },
    calls: { boxes: [locals, { ...holder('?', 'muted') }], line: { each: [[L.CALL1, L.PRINT], L.BUMP, L.INC] }, output: UNKNOWN },
  }),
  'defensive-copy': spec(REAL),
  'writable-field': spec(
    {
      bumps: { boxes: [{ ...locals, still: false }, holder('2', 'ok')], line: { each: [[L.CALL1, L.CALL2], L.FIELD] } },
      print: { boxes: [locals, holder('2', 'ok')], line: L.PRINT, output: out('2', 'ok') },
    },
    WRITABLE_CODE,
  ),

  'in-place-claim': spec({
    'bump-1': { boxes: [{ ...locals, still: false }, holder('1', 'bad')], line: { each: [L.CALL1, L.BUMP] }, bad: true },
    'bump-2': { boxes: [locals, holder('2', 'bad')], line: { each: [L.CALL2, L.BUMP] }, bad: true },
    print: { boxes: [locals, holder('2', 'bad')], line: L.PRINT, output: out('2', 'bad') },
  }),
  'in-place-reality': spec({
    'bump-1': { boxes: [{ ...locals, still: false }, holder('0', 'ok'), temp(1, '1')], line: { each: [L.CALL1, L.BUMP] } },
    'bump-2': { boxes: [locals, holder('0', 'ok'), temp(1, '1', 'gone'), temp(2, '1')], line: { each: [L.CALL2, L.BUMP] } },
    print: REAL.print,
  }),

  'one-claim': spec({
    bumps: { boxes: [{ ...locals, still: false }, holder('1', 'bad')], line: [L.CALL1, L.CALL2], bad: true },
    print: { boxes: [locals, holder('1', 'bad')], line: L.PRINT, output: out('1', 'bad') },
  }),
  'one-reality': spec({
    bumps: { boxes: [{ ...locals, still: false }, holder('0', 'ok'), temp(1, '1', 'gone'), temp(2, '1', 'gone')], line: [L.CALL1, L.CALL2] },
    print: REAL.print,
  }),

  'compile-claim': spec(
    {
      build: { boxes: COMPILED, line: C.BUMP, bad: true, output: [{ label: 'build', text: 'error: Increment mutates a readonly field', kind: 'bad' }] },
      result: { boxes: COMPILED, line: null, output: [{ label: 'build', text: 'failed', kind: 'bad' }, { label: 'run', text: 'nothing to run', kind: 'bad' }] },
    },
    COMPILE_CODE,
    'Compiler',
  ),
  'compile-reality': spec(
    {
      build: { boxes: COMPILED, line: { each: [C.BUMP, C.ASSIGN] }, output: [{ label: 'build', text: 'succeeded', kind: 'ok' }] },
      result: {
        boxes: [{ ...locals, still: false }, holder('0', 'ok'), temp(1, '1', 'gone'), temp(2, '1', 'gone')],
        line: C.PRINT,
        output: [{ label: 'build', text: 'succeeded', kind: 'ok' }, { label: 'output', text: '0', kind: 'ok' }],
      },
    },
    COMPILE_CODE,
    'Build and run',
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
