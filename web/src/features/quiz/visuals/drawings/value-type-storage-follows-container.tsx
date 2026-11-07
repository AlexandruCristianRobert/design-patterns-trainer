import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const TYPES = ['struct Point { public int X, Y; }', 'class Shape { public int Id; public Point Origin; }', '']
const CODE = [...TYPES, 'Shape Make()', '{', '    int count = 3;', '    var p = new Point();', '    var s = new Shape { Id = 7 };', '    var pts = new Point[2];', '    return s;', '}']
const L = { LOCALS: [5, 6] as [number, number], OBJECT: 7, ARRAY: 8, RETURN: 9, ALL: [5, 8] as [number, number] }
const BOX_CODE = [...TYPES, 'Shape Make()', '{', '    int count = 3;', '    object o = count;', '    var s = new Shape { Id = 7 };', '    var pts = new Point[2];', '    return s;', '}']
const SIZE_CODE = [
  'struct Point { public int X, Y; }       // 8 bytes',
  'struct Big { public long A, B, C; }     // 24 bytes',
  'class Shape { public int Id; public Point Origin; }',
  '',
  'Shape Make()',
  '{',
  '    var p = new Point();',
  '    var big = new Big();',
  '    var s = new Shape();',
  '    return s;',
  '}',
]

const regions: Region[] = [
  { id: 'stack', name: 'Stack', sub: 'the frame of Make', tone: 'ui' as const },
  { id: 'heap', name: 'Heap', sub: 'objects', tone: 'pool' as const },
]
const PT = '{ X 0, Y 0 }'
const inline = (name: string, value: string, ok = false): Field => ({ name, value, kind: ok ? 'ok' : 'inline' })
const TARGET: Record<string, string> = { shape: 'Shape', array: 'Point[]', boxed: 'boxed int', big: 'Big', slots: 'stack slot' }
const ref = (name: string, to: string): Field => ({ name, ref: to, value: TARGET[to] })

const frame = (fields: Field[], gone = false): Box => ({ id: 'frame', region: 'stack', title: 'Make()', sub: gone ? 'returned: frame popped' : 'stack frame', fields, kind: gone ? 'gone' : 'plain' })
const shape = (ok = false): Box => ({ id: 'shape', region: 'heap', title: 'Shape', sub: 'object on the heap', fields: [inline('Id', '7', ok), inline('Origin', PT, ok)] })
const array = (ok = false, unreachable = false): Box => ({
  id: 'array',
  region: 'heap',
  title: 'Point[]',
  sub: unreachable ? 'unreachable now' : 'array on the heap',
  kind: unreachable ? 'gone' : 'plain',
  fields: [inline('[0]', PT, ok), inline('[1]', PT, ok)],
})
const LOCALS = [inline('count', '3'), inline('p', PT)]

const spec = (code: string[], steps: Record<string, GraphStep>, regs: Region[] = regions): GraphSpec => ({ regions: regs, code, steps })

const object: GraphStep = { boxes: [frame([...LOCALS, ref('s', 'shape')]), shape()], line: L.OBJECT }
const returns: GraphStep = { boxes: [frame([...LOCALS, ref('s', 'shape'), ref('pts', 'array')], true), shape(), array()], line: L.RETURN }

/** Setup: every value-type value in Make, with no claim about where it is stored. */
const value = (id: string, title: string, sub: string): Box => ({ id, region: 'values', title, sub, fields: [{ name: 'stored in', value: '?', kind: 'muted' }] })
const SETUP_LOCALS = [value('count', 'count', 'int local'), value('p', 'p', 'Point local')]
const SETUP_FIELDS = [value('id', 's.Id', 'int field of a Shape'), value('origin', 's.Origin', 'Point field of a Shape')]
const SETUP_ARRAY = [value('pts0', 'pts[0]', 'Point element of an array'), value('pts1', 'pts[1]', 'Point element of an array')]

const SPECS: Record<string, GraphSpec> = {
  setup: spec(
    CODE,
    {
      locals: { boxes: SETUP_LOCALS, line: L.LOCALS },
      fields: { boxes: [...SETUP_LOCALS, ...SETUP_FIELDS], line: L.OBJECT },
      array: { boxes: [...SETUP_LOCALS, ...SETUP_FIELDS, ...SETUP_ARRAY], line: L.ARRAY },
    },
    [{ id: 'values', name: 'Value-type values in Make', sub: 'locals, fields and array elements', tone: 'muted' as const, wrap: true }],
  ),
  storage: spec(CODE, {
    locals: { boxes: [frame(LOCALS)], line: L.LOCALS },
    object,
    array: { boxes: [frame([...LOCALS, ref('s', 'shape'), ref('pts', 'array')]), shape(), array()], line: L.ARRAY },
    rule: { boxes: [frame([inline('count', '3', true), inline('p', PT, true), ref('s', 'shape'), ref('pts', 'array')]), shape(true), array(true)], line: L.ALL },
    returns: { ...returns, boxes: [frame([...LOCALS, ref('s', 'shape')], true), shape(true), array(true, true)] },
  }),
  'stack-pointer-claim': spec(CODE, {
    locals: { boxes: [frame(LOCALS)], line: L.LOCALS },
    object: {
      boxes: [
        frame([...LOCALS, ref('s', 'shape')]),
        { id: 'slots', region: 'stack', title: 'stack slots', sub: 'the Shape fields, as claimed', fields: [inline('Id', '7'), inline('Origin', PT)] },
        { id: 'shape', region: 'heap', title: 'Shape', sub: 'object on the heap', fields: [ref('Id', 'slots'), ref('Origin', 'slots')] },
      ],
      line: L.OBJECT,
    },
  }),
  'stack-pointer-reality': spec(CODE, {
    locals: { boxes: [frame(LOCALS)], line: L.LOCALS },
    object,
    returns: { boxes: [frame([...LOCALS, ref('s', 'shape')], true), shape(true)], line: L.RETURN },
  }),
  'boxing-only-claim': spec(BOX_CODE, {
    boxed: { boxes: [frame([inline('count', '3'), ref('o', 'boxed')]), { id: 'boxed', region: 'heap', title: 'int (boxed)', sub: 'a copy of count', fields: [inline('value', '3')] }], line: 6 },
    rest: {
      boxes: [
        frame([inline('count', '3'), ref('o', 'boxed'), ref('s', 'shape'), ref('pts', 'array')]),
        { id: 'slots', region: 'stack', title: 'stack slots', sub: 'as claimed: not boxed, so not on the heap', fields: [inline('s.Id', '7'), inline('s.Origin', PT), inline('pts[0]', PT), inline('pts[1]', PT)] },
        { id: 'boxed', region: 'heap', title: 'int (boxed)', sub: 'a copy of count', fields: [inline('value', '3')] },
        { id: 'shape', region: 'heap', title: 'Shape', sub: 'no value-type fields stored here' },
        { id: 'array', region: 'heap', title: 'Point[]', sub: 'no elements stored here' },
      ],
      line: [7, 8],
    },
  }),
  'boxing-only-reality': spec(BOX_CODE, {
    boxed: { boxes: [frame([inline('count', '3'), ref('o', 'boxed')]), { id: 'boxed', region: 'heap', title: 'int (boxed)', sub: 'a copy of count', fields: [inline('value', '3')] }], line: 6 },
    rest: {
      boxes: [
        frame([inline('count', '3'), ref('o', 'boxed'), ref('s', 'shape'), ref('pts', 'array')]),
        { id: 'boxed', region: 'heap', title: 'int (boxed)', sub: 'a copy of count', fields: [inline('value', '3')] },
        shape(true),
        array(true),
      ],
      line: [7, 8],
    },
  }),
  'size-claim': spec(SIZE_CODE, {
    small: { boxes: [frame([inline('p', PT)])], line: 6 },
    big: {
      boxes: [frame([inline('p', PT), ref('big', 'big')]), { id: 'big', region: 'heap', title: 'Big', sub: 'moved to the heap, as claimed', fields: [inline('A', '0'), inline('B', '0'), inline('C', '0')] }],
      line: 7,
    },
  }),
  'size-reality': spec(SIZE_CODE, {
    small: { boxes: [frame([inline('p', PT)])], line: 6 },
    big: { boxes: [frame([inline('p', PT), inline('big', '{ A 0, B 0, C 0 }', true)])], line: 7 },
    object: {
      boxes: [
        frame([inline('p', PT), inline('big', '{ A 0, B 0, C 0 }'), ref('s', 'shape')]),
        { id: 'shape', region: 'heap', title: 'Shape', sub: 'object on the heap', fields: [inline('Id', '0'), inline('Origin', PT, true)] },
      ],
      line: 8,
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
