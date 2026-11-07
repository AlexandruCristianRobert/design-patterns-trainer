import { BoxGraph, OutputStrip, type Box, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import { CodePanel, type LineAt } from '../CodePanel'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const method = (decl: string, before: string, after: string | null) => [
  'async Task SendAsync(Stream stream, byte[] buffer)',
  '{',
  `    ${decl}`,
  `    ${before}`,
  '    await stream.WriteAsync(buffer);',
  ...(after === null ? [] : [`    ${after}`]),
  '}',
]
const CODE = method('Span<byte> header = buffer.AsSpan(0, 4);', 'header[0] = 1;', 'header[1] = 2;')
const OK_CODE = method('Span<byte> header = buffer.AsSpan(0, 4);', 'header[0] = 1;', null)
const MEM_CODE = method('Memory<byte> header = buffer.AsMemory(0, 4);', 'header.Span[0] = 1;', 'header.Span[1] = 2;')
const L = { METHOD: [0, 6] as [number, number], OK_METHOD: [0, 5] as [number, number], DECL: 2, BEFORE: [2, 3] as [number, number], AWAIT: 4, AFTER: 5 }

const build = (text: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'Build', text, kind }]
const REJECTED = build('error CS4007: Span<byte> cannot be preserved across await', 'bad')
const SUCCEEDED = build('succeeded', 'ok')

// ---- Code and build result only (the Setup, and a claim about the declaration) ----
interface CodeStep { line: LineAt; bad?: boolean; output?: OutLine[] }
/** Renders one step of a stage that is only code and the compiler's verdict. */
const codeOnly = (code: string[], steps: Record<string, CodeStep>, { stepIds, stepIndex, reduced }: StageDrawingProps) => {
  for (const id of stepIds) if (!steps[id]) throw new Error(`no drawing for step "${id}"`)
  const step = steps[stepIds[stepIndex]]
  const prev = stepIndex > 0 ? steps[stepIds[stepIndex - 1]] : undefined
  return (
    <div className={`qv-graph${reduced ? ' is-reduced' : ''}`}>
      {step.output && <OutputStrip name="Compiler" lines={step.output} prev={prev?.output} first={!prev} />}
      <CodePanel code={code} line={step.line} bad={step.bad} />
    </div>
  )
}

// ---- Memory: the thread stack and the heap ----
const MEMORY: Region[] = [
  { id: 'stack', name: 'Thread stack', sub: 'frames of running calls', tone: 'ui' },
  { id: 'heap', name: 'Managed heap', sub: 'objects', tone: 'pool' },
]
const mem = (code: string[], steps: Record<string, GraphStep>): GraphSpec => ({ regions: MEMORY, code, outputName: 'Compiler', steps })

const arr: Box = { id: 'arr', region: 'heap', title: 'byte[]', sub: 'buffer', still: true }
const frame = (type: string, kind?: Box['kind'], sub = 'running'): Box => ({
  id: 'frame',
  region: 'stack',
  title: 'SendAsync',
  sub,
  kind,
  fields: [
    { name: 'buffer', value: 'byte[]', ref: 'arr' },
    { name: 'header', value: type, ref: 'arr' },
  ],
})
const gone: Box = { id: 'frame', region: 'stack', title: 'SendAsync', sub: 'returned at the await', kind: 'gone' }
const machine = (header: Box['fields'], kind?: Box['kind']): Box => ({
  id: 'sm',
  region: 'heap',
  title: 'state machine',
  sub: 'boxed at the await',
  kind,
  fields: [{ name: 'stream', value: 'Stream' }, { name: 'buffer', value: 'byte[]', ref: 'arr' }, ...(header ?? [])],
})
const SPAN_FIELD = [{ name: 'header', value: 'Span: not allowed', ref: 'arr', kind: 'bad' as const }]
const R = {
  run: { boxes: [frame('Span<byte>'), arr], line: L.BEFORE },
  suspend: { boxes: [gone, arr, machine([])], line: L.AWAIT },
  header: { boxes: [gone, arr, machine(SPAN_FIELD, 'bad')], line: L.AFTER, bad: true, output: REJECTED },
} satisfies Record<string, GraphStep>

// ---- Other places: for the claims about locks and threads ----
const LOCK: Region[] = [
  { id: 'method', name: 'SendAsync', sub: 'waiting at the await', tone: 'ui' },
  { id: 'data', name: 'Data', tone: 'muted' },
  { id: 'other', name: 'Other code', sub: 'reads buffer', tone: 'io' },
]
const THREADS: Region[] = [
  { id: 't1', name: 'Thread 1', sub: 'before the await', tone: 'ui' },
  { id: 't2', name: 'Thread 2', sub: 'after the await', tone: 'pool' },
]
const span = (region: string, fields: Box['fields'], kind?: Box['kind']): Box => ({ id: 'span', region, title: 'header', sub: 'Span<byte>', kind, fields })
const dataArr: Box = { id: 'arr', region: 'data', title: 'byte[]', sub: 'buffer', still: true }
const SPAN_PARTS = [{ name: 'over', value: 'buffer[0..4]', ref: 'arr' }]
const SPAN_PARTS_NO_ARROW = [{ name: 'over', value: 'buffer[0..4]' }]

const SPECS: QuestionDrawing = {
  setup: (p) => codeOnly(CODE, { method: { line: L.BEFORE }, after: { line: [4, 5] }, error: { line: L.METHOD, bad: true, output: build('method rejected; reason ?', 'muted') } }, p),
  'declare-claim': (p) => codeOnly(OK_CODE, { declare: { line: L.DECL, bad: true }, build: { line: L.OK_METHOD, bad: true, output: build('rejected: Span local in async method', 'bad') } }, p),
}
const GRAPHS: Record<string, GraphSpec> = {
  hoisted: mem(CODE, R),
  memory: mem(MEM_CODE, {
    hoist: { boxes: [gone, arr, machine([{ name: 'header', value: 'Memory<byte>', ref: 'arr', kind: 'ok' }], 'ok')], line: L.AWAIT },
    resume: {
      boxes: [
        { id: 'frame', region: 'stack', title: 'SendAsync', sub: 'resumed', fields: [{ name: 'header.Span', value: 'Span<byte>', ref: 'arr', kind: 'ok' }] },
        arr,
        machine([{ name: 'header', value: 'Memory<byte>', ref: 'arr', kind: 'ok' }], 'ok'),
      ],
      line: L.AFTER,
      output: SUCCEEDED,
    },
  }),
  'declare-reality': mem(OK_CODE, {
    declare: { boxes: [frame('Span<byte>'), arr], line: L.BEFORE },
    build: { boxes: [gone, arr, machine([{ name: 'header', value: 'not needed', kind: 'muted' }])], line: L.AWAIT, output: SUCCEEDED },
  }),

  'lock-claim': {
    regions: LOCK,
    code: CODE,
    steps: {
      lock: { boxes: [span('method', [...SPAN_PARTS, { name: 'lock', value: 'held on buffer', kind: 'bad' }], 'bad'), dataArr], line: L.DECL, bad: true },
      await: {
        boxes: [
          span('method', [...SPAN_PARTS, { name: 'lock', value: 'held on buffer', kind: 'bad' }], 'bad'),
          { ...dataArr, fields: [{ name: 'locked by', value: 'header', kind: 'bad' }] },
          { id: 'reader', region: 'other', title: 'reader', fields: [{ name: 'reads', value: 'waits for lock', ref: 'arr', kind: 'bad' }], kind: 'bad' },
        ],
        line: L.AWAIT,
        bad: true,
      },
    },
  },
  'lock-reality': mem(CODE, {
    lock: { boxes: [frame('ref + length'), arr, { id: 'reader', region: 'stack', title: 'other code', sub: 'no lock to wait for', kind: 'ok', fields: [{ name: 'reads', value: 'buffer', ref: 'arr', kind: 'ok' }] }], line: L.BEFORE },
    await: { ...R.header },
  }),

  'thread-claim': {
    regions: THREADS,
    code: CODE,
    steps: {
      start: { boxes: [span('t1', [...SPAN_PARTS_NO_ARROW, { name: 'owner', value: 'thread 1 only', kind: 'bad' }], 'bad')], line: L.DECL, bad: true },
      resume: {
        boxes: [
          span('t1', [...SPAN_PARTS_NO_ARROW, { name: 'owner', value: 'thread 1 only', kind: 'bad' }], 'bad'),
          { id: 'resumed', region: 't2', title: 'SendAsync', sub: 'resumed', kind: 'bad', fields: [{ name: 'header[1] = 2', value: 'wrong thread', ref: 'span', kind: 'bad' }] },
        ],
        line: L.AFTER,
        bad: true,
      },
    },
  },
  'thread-reality': mem(CODE, {
    start: { boxes: [frame('ref + length'), arr], line: L.BEFORE },
    resume: { ...R.header },
  }),
}

const drawing: QuestionDrawing = {
  ...SPECS,
  ...Object.fromEntries(Object.entries(GRAPHS).map(([stage, spec]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={spec} {...p} />])),
}
export default drawing
