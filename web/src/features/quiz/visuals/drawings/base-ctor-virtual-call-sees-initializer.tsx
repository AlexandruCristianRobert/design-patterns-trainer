import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'new Derived();',
  '',
  'class Base',
  '{',
  '    public Base() => Describe();',
  '    protected virtual void Describe() =>',
  '        Console.WriteLine("base");',
  '}',
  '',
  'class Derived : Base',
  '{',
  '    private readonly string _a = "init";',
  '    private readonly string? _b;',
  '    public Derived() { _b = "ctor"; }',
  '    protected override void Describe() =>',
  '        Console.WriteLine($"{_a}|{_b ?? "null"}");',
  '}',
]
const L = {
  NEW: 0,
  BASE_CTOR: 4,
  BASE_DESCRIBE: [5, 6] as [number, number],
  BASE: [4, 6] as [number, number],
  A: 11,
  CTOR: 13,
  OVERRIDE: [14, 15] as [number, number],
  DERIVED: [11, 15] as [number, number],
}

const STACK: Region = { id: 'stack', name: 'Running now', sub: 'innermost call at the bottom', tone: 'ui' }
const HEAP: Region = { id: 'heap', name: 'The new object', tone: 'pool' }

/** A call frame; `part` says which part of the method is running or waiting. */
const frame = (id: string, title: string, part: string, kind?: Box['kind']): Box => ({ id, region: 'stack', title, sub: part, kind })
const NEW = frame('new', 'new Derived()', 'allocates')
const D_INIT = frame('derived', 'Derived()', 'field initializers')
const D_WAIT = frame('derived', 'Derived()', 'calling Base()')
const D_BODY = frame('derived', 'Derived()', 'constructor body')
const BASE = frame('base', 'Base()', 'calling Describe()')
const OVERRIDE = frame('describe', 'Derived.Describe()', 'the override')

type Val = { v: string; kind?: Field['kind'] }
const obj = (type: Val, a: Val, b: Val): Box => ({
  id: 'obj',
  region: 'heap',
  title: 'object',
  fields: [
    { name: 'runtime type', value: type.v, kind: type.kind },
    { name: '_a', value: a.v, kind: a.kind },
    { name: '_b', value: b.v, kind: b.kind },
  ],
})
const DER: Val = { v: 'Derived' }
const NUL: Val = { v: 'null' }
const INIT: Val = { v: '"init"' }

const con = (text: string | null, kind: OutLine['kind'] = 'plain'): OutLine[] => [text === null ? { label: 'output', text: 'nothing yet', kind: 'muted' } : { label: 'line 1', text, kind }]
const spec = (steps: Record<string, GraphStep>): GraphSpec => ({ regions: [STACK, HEAP], code: CODE, outputName: 'Console', steps })

/** The real order. */
const R = {
  alloc: { boxes: [NEW, obj(DER, NUL, NUL)], line: L.NEW, output: con(null) },
  initializers: { boxes: [D_INIT, obj(DER, { v: '"init"', kind: 'ok' }, NUL)], line: L.A, output: con(null) },
  baseCtor: { boxes: [D_WAIT, BASE, obj(DER, INIT, NUL)], line: L.BASE_CTOR, output: con(null) },
  call: { boxes: [D_WAIT, BASE, OVERRIDE, obj(DER, INIT, NUL)], line: L.OVERRIDE, output: con('init|null', 'ok') },
  body: { boxes: [D_BODY, obj(DER, INIT, { v: '"ctor"', kind: 'ok' })], line: L.CTOR, output: con('init|null') },
} satisfies Record<string, GraphStep>

const SETUP_OBJ: Box = { id: 'obj', region: 'heap', title: 'new Derived()', fields: [{ name: '_a', value: '?', kind: 'muted' }, { name: '_b', value: '?', kind: 'muted' }] }
const UNKNOWN: OutLine[] = [{ label: 'output', text: '?', kind: 'muted' }]

const SPECS: Record<string, GraphSpec> = {
  setup: {
    regions: [HEAP],
    code: CODE,
    outputName: 'Console',
    steps: {
      base: { boxes: [SETUP_OBJ], line: L.BASE, output: UNKNOWN },
      derived: { boxes: [SETUP_OBJ], line: L.DERIVED, output: UNKNOWN },
      question: { boxes: [SETUP_OBJ], line: L.NEW, output: UNKNOWN },
    },
  },
  construction: spec({ alloc: R.alloc, initializers: R.initializers, 'base-ctor': R.baseCtor, 'virtual-call': R.call, body: R.body }),

  'static-type-claim': spec({
    'base-ctor': { boxes: [D_WAIT, BASE, obj({ v: 'Base, for now', kind: 'bad' }, INIT, NUL)], line: L.BASE_CTOR, bad: true, output: con(null) },
    call: {
      boxes: [D_WAIT, BASE, frame('describe', 'Base.Describe()', 'the base version', 'bad'), obj({ v: 'Base, for now', kind: 'bad' }, INIT, NUL)],
      line: L.BASE_DESCRIBE,
      bad: true,
      output: con('base', 'bad'),
    },
  }),
  'static-type-reality': spec({
    'base-ctor': { boxes: [D_WAIT, BASE, obj({ v: 'Derived', kind: 'ok' }, INIT, NUL)], line: L.BASE_CTOR, output: con(null) },
    call: R.call,
  }),

  'java-order-claim': spec({
    'base-ctor': { boxes: [frame('derived', 'Derived()', 'calling Base() first'), BASE, obj(DER, { v: 'null', kind: 'bad' }, NUL)], line: L.BASE_CTOR, bad: true, output: con(null) },
    call: { boxes: [frame('derived', 'Derived()', 'calling Base() first'), BASE, OVERRIDE, obj(DER, { v: 'null', kind: 'bad' }, NUL)], line: L.OVERRIDE, bad: true, output: con('|null', 'bad') },
    initializers: { boxes: [frame('derived', 'Derived()', 'field initializers, late', 'bad'), obj(DER, INIT, NUL)], line: L.A, bad: true, output: con('|null', 'bad') },
  }),
  'java-order-reality': spec({ initializers: R.initializers, 'base-ctor': R.baseCtor, call: R.call }),

  'body-first-claim': spec({
    initializers: R.initializers,
    body: { boxes: [frame('derived', 'Derived()', 'constructor body, early', 'bad'), obj(DER, INIT, { v: '"ctor"', kind: 'bad' })], line: L.CTOR, bad: true, output: con(null) },
    call: { boxes: [D_WAIT, BASE, OVERRIDE, obj(DER, INIT, { v: '"ctor"', kind: 'bad' })], line: L.OVERRIDE, bad: true, output: con('init|ctor', 'bad') },
  }),
  'body-first-reality': spec({ initializers: R.initializers, 'base-ctor': R.baseCtor, call: R.call, body: R.body }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
