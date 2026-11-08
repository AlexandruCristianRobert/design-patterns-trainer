import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const REGIONS: Region[] = [
  { id: 'stack', name: 'Thread stack', sub: 'Feed() calls', tone: 'ui' },
  { id: 'heap', name: 'Managed heap', sub: 'objects', tone: 'pool' },
]
const graph = (code: string[] | undefined, steps: Record<string, GraphStep>): GraphSpec => ({ regions: REGIONS, code, outputName: 'Compiler', steps })

const MEMORY_CODE = [
  'class Parser',
  '{',
  '    ReadOnlyMemory<byte> _pending;',
  '',
  '    public void Feed(byte[] chunk)',
  '    {',
  '        if (!_pending.IsEmpty) Parse(_pending.Span);',
  '        _pending = chunk.AsMemory(4, 4);',
  '    }',
  '}',
]
const SPAN_CODE = ['class Parser', '{', '    readonly ReadOnlySpan<byte> _pending;', '    …', '}']
const LAMBDA_CODE = [
  'class Parser',
  '{',
  '    Func<Span<byte>> _pending;',
  '',
  '    public void Feed(byte[] chunk)',
  '    {',
  '        Span<byte> slice = chunk.AsSpan(4, 4);',
  '        _pending = () => slice;',
  '    }',
  '}',
]
const REF_CODE = ['class Parser', '{', '    ref byte _start;', '    int _length;', '    …', '}']

const BUF: Box = { id: 'buf', region: 'heap', title: 'byte[]', sub: 'input buffer', fields: [{ name: '[4..8)', value: 'the slice' }], still: true }
const parser = (fields: Field[], kind?: Box['kind']): Box => ({ id: 'parser', region: 'heap', title: 'Parser', fields, kind })
const call = (id: string, sub: string, fields: Field[], kind?: Box['kind']): Box => ({ id, region: 'stack', title: 'Feed(chunk)', sub, fields, kind })
const CALL1 = call('call1', 'call 1', [{ name: 'chunk', value: 'byte[]', ref: 'buf' }])
const RETURNED: Box = { id: 'call1', region: 'stack', title: 'Feed(chunk)', sub: 'call 1 returned', kind: 'gone' }
const call2 = (fields: Field[] = [], kind?: Box['kind']) => call('call2', 'call 2', fields, kind)

const build = (text: string, kind: OutLine['kind'] = 'bad'): OutLine[] => [{ label: 'Build', text, kind }]
const CS8345 = build('error CS8345: span field outside a ref struct')
const CS8175 = build('error CS8175: cannot capture ref local slice')
const CS9059 = build('error CS9059: ref field outside a ref struct')

const MEM_FIELD: Field = { name: '_pending', value: 'array, 4, length 4', ref: 'buf', kind: 'ok' }

const SPECS: Record<string, GraphSpec> = {
  setup: graph(undefined, {
    feed: { boxes: [CALL1, parser([{ name: '_pending', value: '?' }]), BUF] },
    later: { boxes: [RETURNED, call2([{ name: 'reads', value: '_pending', ref: 'parser' }]), parser([{ name: '_pending', value: '?' }]), BUF] },
  }),

  stored: graph(MEMORY_CODE, {
    store: { boxes: [CALL1, parser([MEM_FIELD]), BUF], line: 7 },
    return: { boxes: [RETURNED, parser([MEM_FIELD], 'ok'), BUF], line: 2 },
    span: {
      boxes: [RETURNED, call2([{ name: '_pending.Span', value: 'ReadOnlySpan', ref: 'buf', kind: 'ok' }]), parser([MEM_FIELD], 'ok'), BUF],
      line: 6,
      output: build('succeeded', 'ok'),
    },
  }),

  'span-claim': graph(SPAN_CODE, {
    field: { boxes: [CALL1, parser([{ name: '_pending', value: 'ReadOnlySpan', ref: 'buf' }]), BUF], line: 2 },
    readonly: { boxes: [CALL1, parser([{ name: '_pending', value: 'ReadOnlySpan', ref: 'buf' }, { name: 'readonly', value: 'cannot change', kind: 'bad' }], 'bad'), BUF], line: 2, bad: true },
  }),
  'span-reality': graph(SPAN_CODE, {
    field: { boxes: [CALL1, parser([{ name: '_pending', value: 'ReadOnlySpan', ref: 'buf', kind: 'bad' }], 'bad'), BUF], line: 2, bad: true, output: CS8345 },
    readonly: {
      boxes: [CALL1, parser([{ name: '_pending', value: 'ReadOnlySpan', ref: 'buf', kind: 'bad' }, { name: 'readonly', value: 'no reassign only' }], 'bad'), BUF],
      line: 2,
      bad: true,
      output: CS8345,
    },
  }),

  'lambda-claim': graph(LAMBDA_CODE, {
    wrap: {
      boxes: [
        call('call1', 'call 1', [{ name: 'slice', value: 'Span<byte>', ref: 'buf' }]),
        parser([{ name: '_pending', value: 'Func', ref: 'closure' }]),
        { id: 'closure', region: 'heap', title: 'lambda', sub: '() => slice', fields: [{ name: 'slice', value: 'Span<byte>', ref: 'buf' }] },
        BUF,
      ],
      line: 7,
    },
    later: {
      boxes: [
        RETURNED,
        call2([{ name: '_pending()', value: 'the slice', ref: 'closure' }]),
        parser([{ name: '_pending', value: 'Func', ref: 'closure' }]),
        { id: 'closure', region: 'heap', title: 'lambda', sub: '() => slice', kind: 'bad', fields: [{ name: 'slice', value: 'Span<byte>', ref: 'buf', kind: 'bad' }] },
        BUF,
      ],
      line: 2,
    },
  }),
  'lambda-reality': graph(LAMBDA_CODE, {
    wrap: {
      boxes: [
        call('call1', 'call 1', [{ name: 'slice', value: 'Span<byte>', ref: 'buf' }]),
        parser([{ name: '_pending', value: 'Func', ref: 'closure' }]),
        { id: 'closure', region: 'heap', title: 'closure', sub: 'captured locals', kind: 'bad', fields: [{ name: 'slice', value: 'Span: not allowed', kind: 'bad' }] },
        BUF,
      ],
      line: 7,
      bad: true,
      output: CS8175,
    },
    later: { boxes: [RETURNED, call2([{ name: '_pending()', value: 'never stored', kind: 'muted' }]), parser([{ name: '_pending', value: 'no lambda', kind: 'bad' }], 'bad'), BUF], line: 2, bad: true, output: CS8175 },
  }),

  'ref-claim': graph(REF_CODE, {
    ref: { boxes: [CALL1, parser([{ name: '_start', value: 'ref byte', ref: 'buf' }]), BUF], line: 2 },
    length: { boxes: [CALL1, parser([{ name: '_start', value: 'ref byte', ref: 'buf', kind: 'bad' }, { name: '_length', value: '4' }], 'bad'), BUF], line: [2, 3], bad: true },
  }),
  'ref-reality': graph(REF_CODE, {
    ref: { boxes: [CALL1, parser([{ name: '_start', value: 'ref: not allowed', kind: 'bad' }], 'bad'), BUF], line: 2, bad: true, output: CS9059 },
    length: { boxes: [CALL1, parser([{ name: '_start', value: 'ref: not allowed', kind: 'bad' }, { name: '_length', value: '4' }], 'bad'), BUF], line: [2, 3], bad: true, output: CS9059 },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
