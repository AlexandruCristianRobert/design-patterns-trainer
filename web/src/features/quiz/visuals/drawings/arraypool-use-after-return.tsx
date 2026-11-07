import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const SETUP_CODE = [
  'byte[] buffer = ArrayPool<byte>.Shared.Rent(4096);',
  'try',
  '{',
  '    Fill(buffer);',
  '    _buffer = buffer;   // a background task reads it later',
  '}',
  'finally',
  '{',
  '    ArrayPool<byte>.Shared.Return(buffer);',
  '}',
  '',
  '// later, on the background task',
  'Parse(_buffer);',
]
const CODE = [...SETUP_CODE, '', '// meanwhile, other code in the process', 'byte[] mine = ArrayPool<byte>.Shared.Rent(4096);', 'Fill(mine);']
const L = { RENT: [0, 4] as [number, number], RETURN: 8, READ: 12, RENT2: 15, FILL2: 16 }

const REGIONS: Region[] = [
  { id: 'code', name: 'Code', tone: 'ui' },
  { id: 'heap', name: 'Heap', tone: 'pool' },
  { id: 'pool', name: 'ArrayPool<byte>.Shared', tone: 'io' },
]
const spec = (code: string[], steps: Record<string, GraphStep>): GraphSpec => ({ regions: REGIONS, code, outputName: 'Result', steps })

const ARR = 'byte[4096]'
const method = (kind?: Box['kind']): Box => ({ id: 'req', region: 'code', title: 'The method', fields: kind === 'gone' ? [{ name: 'buffer', value: 'out of scope' }] : [{ name: 'buffer', ref: 'arr', value: ARR }], kind })
const task = (reads = '?', kind?: Field['kind']): Box => ({
  id: 'task',
  region: 'code',
  title: 'Background task',
  fields: [{ name: '_buffer', ref: 'arr', value: ARR }, { name: 'reads', value: reads, kind: reads === '?' ? 'muted' : kind }],
})
const other = (kind?: Box['kind']): Box => ({ id: 'other', region: 'code', title: 'Other caller', sub: 'anywhere in the process', fields: [{ name: 'mine', ref: 'arr', value: ARR }], kind })
const arr = (bytes: string, kind?: Box['kind'], sub?: string): Box => ({
  id: 'arr',
  region: 'heap',
  title: ARR,
  sub,
  fields: [{ name: 'bytes', value: bytes, kind: bytes === '?' ? 'muted' : undefined }],
  kind,
})
const pool = (fields: Field[]): Box => ({ id: 'pool', region: 'pool', title: 'Free arrays', fields })
const FREE = pool([{ name: 'free', ref: 'arr', value: ARR }])
const TAKEN = pool([{ name: 'free', value: 'none of this size' }])

const A = "A's data"
const B = "other caller's data"
const SILENT = [{ label: 'Parse(_buffer)', text: 'no exception, wrong bytes' }]
const rent: GraphStep = { boxes: [method(), task(), arr(A), TAKEN], line: L.RENT }
const returned: GraphStep = { boxes: [method('gone'), task(), arr(A), FREE], line: L.RETURN }
const stolen = (reads = '?'): GraphStep => ({ boxes: [method('gone'), task(reads, 'bad'), other(), arr(B, reads === '?' ? undefined : 'bad'), TAKEN], line: reads === '?' ? [L.RENT2, L.FILL2] : { each: [L.READ, [L.RENT2, L.FILL2]] }, bad: reads !== '?', output: reads === '?' ? undefined : SILENT })

const SPECS: Record<string, GraphSpec> = {
  setup: spec(SETUP_CODE, {
    rent,
    returned: { boxes: [method('gone'), task(), arr('?'), pool([{ name: 'after Return', value: '?', kind: 'muted' }])], line: L.RETURN },
  }),
  reuse: spec(CODE, {
    rent,
    return: returned,
    'rent-again': { boxes: [method('gone'), task(), other(), arr(A), TAKEN], line: L.RENT2 },
    overwrite: { boxes: [method('gone'), task(), other(), arr(B), TAKEN], line: L.FILL2 },
    read: { boxes: [method('gone'), task(B, 'bad'), other(), arr(B, 'bad'), TAKEN], line: L.READ, bad: true, output: SILENT },
  }),

  'zero-claim': spec(SETUP_CODE, {
    return: { boxes: [method('gone'), task(), arr('0 0 0 0 …'), FREE], line: L.RETURN },
    read: { boxes: [method('gone'), task('0 0 0 0 …'), arr('0 0 0 0 …'), FREE], line: L.READ },
  }),
  'zero-reality': spec(CODE, {
    return: { ...returned, boxes: [method('gone'), task(), arr(A, 'ok', 'not cleared'), FREE] },
    reused: stolen(B),
  }),

  'gc-claim': spec(SETUP_CODE, {
    return: { boxes: [method('gone'), task(), arr(A, 'gone', 'released to the GC'), TAKEN], line: L.RETURN },
    read: { boxes: [method('gone'), task('exception'), arr(A, 'gone', 'released to the GC'), TAKEN], line: L.READ, output: [{ label: 'Parse(_buffer)', text: 'throws ObjectDisposedException' }] },
  }),
  'gc-reality': spec(CODE, {
    alive: { boxes: [method('gone'), task(), arr(A, 'ok', 'alive, in the pool'), FREE], line: L.RETURN },
    read: stolen(B),
  }),

  'detect-claim': spec(SETUP_CODE, {
    check: { boxes: [method('gone'), task(), arr(A), pool([{ name: 'checks', value: '_buffer still refers to it' }])], line: L.RETURN },
    throw: { boxes: [method('gone'), task(), arr(A), pool([{ name: 'checks', value: '_buffer still refers to it' }])], line: L.RETURN, output: [{ label: 'Return(buffer)', text: 'throws InvalidOperationException' }] },
  }),
  'detect-reality': spec(CODE, {
    'no-check': returned,
    silent: stolen(B),
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
