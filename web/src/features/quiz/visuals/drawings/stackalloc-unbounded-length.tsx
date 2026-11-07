import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import type { Chip, ChipKind, RowDef } from '../RowStage'
import { StackStage, type Seg, type StackStep } from '../StackStage'

const CODE = [
  'void Handle(Request request)',
  '{',
  '    Span<byte> buffer = stackalloc byte[request.Length];',
  '    Fill(buffer);',
  '}',
]
const C = { METHOD: [0, 4] as [number, number], ALLOC: 2, END: 4 }
const FIX = [
  'const int Max = 1024;',
  'byte[]? rented = null;',
  'Span<byte> buffer = request.Length <= Max',
  '    ? stackalloc byte[Max]',
  '    : (rented = ArrayPool<byte>.Shared',
  '          .Rent(request.Length));',
  'try { Fill(buffer[..request.Length]); }',
  'finally',
  '{',
  '    if (rented is not null)',
  '        ArrayPool<byte>.Shared',
  '            .Return(rented);',
  '}',
]
const F = { STACK: [2, 3] as [number, number], RENT: [4, 5] as [number, number], RETURN: [7, 12] as [number, number] }

const REQ: RowDef = { id: 'req', name: 'Request', sub: 'from the client', tone: 'ui' }
const HEAP: RowDef = { id: 'heap', name: 'Managed heap', tone: 'pool' }
const GC: RowDef = { id: 'gc', name: 'Garbage collector', tone: 'muted' }
const PROC: RowDef = { id: 'proc', name: 'Process', tone: 'io' }

const seg = (key: string, label: string, size: number, kind: Seg['kind']): Seg => ({ key, label, size, kind })
const CALLERS = seg('callers', 'callers', 12, 'frame')
const HANDLE = seg('handle', 'Handle', 7, 'frame')
const buf = (label: string, size: number, kind: Seg['kind'] = 'buf', key = 'buf') => seg(key, label, size, kind)
const chip = (key: string, label: string, kind: ChipKind = 'item'): Chip => ({ key, label, kind })
const len = (n: string) => [chip('len', `Length = ${n}`)]
const RUNNING = [chip('p', 'running', 'ok')]
const DEAD = [chip('p', 'terminated: stack overflow', 'bad'), chip('lost', 'every in-flight request lost', 'bad')]

const SMALL: StackStep = { segs: [CALLERS, HANDLE, buf('buffer 512 B', 4)], rows: { req: len('512'), proc: RUNNING }, line: C.ALLOC }
const RETURNED: StackStep = { segs: [CALLERS], rows: { req: len('512'), proc: RUNNING }, line: C.END }
const HUGE: StackStep = { segs: [CALLERS, HANDLE, { ...buf('10 MB', 81, 'bad'), fill: true }], over: '+9 MB past the end', rows: { req: len('10,000,000'), proc: RUNNING }, line: C.ALLOC, bad: true }
const CRASH: StackStep = { ...HUGE, rows: { req: len('10,000,000'), proc: DEAD } }
const big = (kind: Seg['kind'] = 'buf'): StackStep => ({ segs: [CALLERS, HANDLE, buf('buffer 100,000 B', 10, kind)], rows: { req: len('100,000'), proc: RUNNING }, line: C.ALLOC })

type Stage = { steps: Record<string, StackStep>; rows: RowDef[]; code: string[]; sized: boolean }
const MAIN_ROWS = [REQ, PROC]
const stage = (steps: Record<string, StackStep>, rows = MAIN_ROWS, code = CODE, sized = true): Stage => ({ steps, rows, code, sized })

const SETUP_SEGS = [CALLERS, HANDLE]
const STAGES: Record<string, Stage> = {
  setup: stage(
    {
      handler: { segs: SETUP_SEGS, rows: { req: len('?'), proc: RUNNING }, line: C.ALLOC },
      length: { segs: SETUP_SEGS, rows: { req: [chip('len', 'Length = any value the client sends')], proc: RUNNING }, line: C.ALLOC },
      question: { segs: SETUP_SEGS, rows: { req: [chip('len', 'Length = any value the client sends')], proc: RUNNING }, line: C.ALLOC },
    },
    MAIN_ROWS,
    CODE,
    false,
  ),
  unbounded: stage({ small: SMALL, returns: RETURNED, attack: HUGE, crash: CRASH }),
  bounded: stage(
    {
      small: { segs: [CALLERS, HANDLE, buf('buffer 1 KB', 4, 'ok')], rows: { req: len('512'), heap: [], proc: RUNNING }, line: F.STACK },
      large: { segs: [CALLERS, HANDLE], rows: { req: len('10,000,000'), heap: [chip('rent', 'rented array, 10 MB', 'ok')], proc: RUNNING }, line: F.RENT },
      returned: { segs: [CALLERS], rows: { req: len('10,000,000'), heap: [chip('rent', 'given back with Return', 'gone')], proc: [chip('p', 'still running', 'ok')] }, line: F.RETURN },
    },
    [REQ, HEAP, PROC],
    FIX,
  ),

  'leak-claim': stage({
    first: SMALL,
    returns: { segs: [CALLERS, buf('buffer 512 B, kept', 4, 'bad')], rows: { req: len('512'), proc: RUNNING }, line: C.END, bad: true },
    more: {
      segs: [CALLERS, buf('kept', 4, 'bad'), buf('kept', 4, 'bad', 'buf2'), buf('kept', 4, 'bad', 'buf3'), buf('kept …', 4, 'bad', 'buf4')],
      rows: { req: [chip('len', 'more requests, 512 B each')], proc: RUNNING },
      line: C.ALLOC,
      bad: true,
    },
  }),
  'leak-reality': stage({
    first: SMALL,
    returns: RETURNED,
    more: { segs: [CALLERS, seg('handle2', 'Handle', 7, 'frame'), buf('buffer 512 B', 4, 'buf', 'buf2')], rows: { req: [chip('len', 'next request: 512')], proc: RUNNING }, line: C.ALLOC },
  }),

  'heap-claim': stage(
    {
      small: { ...SMALL, rows: { req: len('512'), heap: [], proc: RUNNING } },
      large: { segs: [CALLERS, HANDLE], rows: { req: len('100,000'), heap: [chip('moved', 'buffer 100,000 B, moved here', 'bad')], proc: RUNNING }, line: C.ALLOC, bad: true },
    },
    [REQ, HEAP, PROC],
  ),
  'heap-reality': stage(
    {
      small: { ...SMALL, rows: { req: len('512'), heap: [], proc: RUNNING } },
      large: { ...big('ok'), rows: { req: len('100,000'), heap: [chip('none', 'nothing from stackalloc', 'gone')], proc: RUNNING } },
      huge: { ...CRASH, rows: { req: len('10,000,000'), heap: [chip('none', 'nothing from stackalloc', 'gone')], proc: DEAD } },
    },
    [REQ, HEAP, PROC],
  ),

  'gc-scan-claim': stage(
    {
      large: { ...big(), rows: { req: len('100,000'), gc: [], proc: RUNNING } },
      gc: { ...big(), rows: { req: len('100,000'), gc: [chip('scan', 'scans 100,000 bytes for references', 'bad')], proc: RUNNING }, bad: true },
      slow: { ...big(), rows: { req: len('100,000'), gc: [chip('scan', 'scans 100,000 bytes for references', 'bad'), chip('slow', 'every collection slower', 'bad')], proc: RUNNING }, bad: true },
    },
    [REQ, GC, PROC],
  ),
  'gc-scan-reality': stage(
    {
      large: { ...big(), rows: { req: len('100,000'), gc: [], proc: RUNNING } },
      gc: { ...big(), rows: { req: len('100,000'), gc: [chip('scan', 'bytes only: not scanned', 'ok')], proc: RUNNING } },
      slow: { ...big(), rows: { req: len('100,000'), gc: [chip('scan', 'bytes only: not scanned', 'ok'), chip('slow', 'same cost as without it', 'ok')], proc: RUNNING } },
    },
    [REQ, GC, PROC],
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(STAGES).map(([id, s]) => [id, (p: StageDrawingProps) => <StackStage {...s} {...p} />]),
)
export default drawing
