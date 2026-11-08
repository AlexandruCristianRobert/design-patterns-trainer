import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

// ---- Setup: the method, the variable and the stem's "pooled source"; nothing about what the struct holds ----
const READ: Box = { id: 'read', region: 'lib', title: 'ReadAsync()', fields: [{ name: 'returns', value: 'ValueTask<int>' }] }
const vtBox = (fields: Field[], still?: boolean): Box => ({ id: 'vt', region: 'caller', title: 'vt', sub: 'ValueTask<int>', fields, still })
const SETUP: GraphSpec = {
  regions: [
    { id: 'caller', name: 'Caller', tone: 'ui' },
    { id: 'lib', name: 'Library', tone: 'io' },
  ],
  code: ['ValueTask<int> vt = ReadAsync();'],
  steps: {
    returns: { boxes: [vtBox([]), READ], line: 0 },
    pooled: { boxes: [vtBox([{ name: 'backed by', value: 'pooled source' }]), { ...READ, still: true }], line: 0 },
    ask: {
      boxes: [vtBox([{ name: 'backed by', value: 'pooled source' }, { name: 'consume', value: '?', kind: 'muted' }]), { ...READ, still: true }],
      line: 0,
    },
  },
}

// ---- Shared pieces for the memory pictures ----
const REGIONS: Region[] = [
  { id: 'caller', name: 'Caller', tone: 'ui' },
  { id: 'pool', name: 'Pool', tone: 'io' },
]
const REGIONS_TASK: Region[] = [...REGIONS, { id: 'task', name: 'Task', tone: 'pool' }]
type K = Field['kind']
/** A ValueTask struct: a reference to the source and a token. */
const vt = (id: string, title: string, token = '7', kind?: K, boxKind?: Box['kind']): Box => ({
  id,
  region: 'caller',
  title,
  sub: 'ValueTask<int>',
  fields: [
    { name: 'source', ref: 'src' },
    { name: 'token', value: token, kind },
  ],
  kind: boxKind,
})
/** The pooled source and the operation it is serving. */
const src = (token: string, result: string, serves: string, kind?: K): Box => ({
  id: 'src',
  region: 'pool',
  title: 'Source',
  sub: 'IValueTaskSource',
  fields: [
    { name: 'token', value: token, kind },
    { name: 'result', value: result, kind: result === 'pending' ? 'muted' : kind },
    { name: 'serves', value: serves, kind },
  ],
})
const SRC_PENDING = src('7', 'pending', 'read 1')
const SRC_DONE = src('7', '42', 'read 1', 'ok')
const SRC_REUSED = src('8', 'pending', 'read 2', 'bad')
const SRC_REUSED_OK = src('8', 'pending', 'read 2')
const value = (id: string, name: string, v: string, kind?: K): Box => ({ id, region: 'caller', title: name, sub: 'int', fields: [{ name: 'value', value: v, kind }] })

const graph = (regions: Region[], code: string[], steps: Record<string, GraphStep>): GraphSpec => ({ regions, code, steps })

const ONCE_CODE = ['ValueTask<int> vt = ReadAsync();', 'int n = await vt;']
const TASK_CODE = ['Task<int> t = ReadAsync().AsTask();', 'int a = await t;', 'int b = await t;', 'await Task.WhenAll(t, other);']
const taskBox = (result: string, kind?: K, extra: Field[] = []): Box => ({
  id: 't',
  region: 'task',
  title: 't',
  sub: 'Task<int>',
  fields: [{ name: 'result', value: result, kind: result === 'pending' ? 'muted' : kind }, ...extra],
})

const FIELD_CODE = ['_pending = ReadAsync();', '…', 'int a = await _pending;', '…', 'int b = await _pending;']
const RESULT_CODE = ['int n = ReadAsync().Result;']
const COPY_CODE = ['ValueTask<int> vt = ReadAsync();', 'var a = vt;', 'var b = vt;', 'int x = await a;', 'int y = await b;']
/** The claim's picture of the field: no internals, a cached result as the claim says. */
const claimField = (fields: Field[]): Box => ({ id: 'f', region: 'caller', title: '_pending', sub: 'ValueTask<int>', fields })
const claimCopy = (id: string, fields: Field[]): Box => ({ id, region: 'caller', title: id, sub: 'ValueTask<int>', fields })

const SPECS: Record<string, GraphSpec> = {
  once: graph(REGIONS, ONCE_CODE, {
    struct: { boxes: [vt('vt', 'vt'), SRC_PENDING], line: 0 },
    await: { boxes: [vt('vt', 'vt', '7', 'ok'), SRC_DONE, value('n', 'n', '42', 'ok')], line: 1 },
    reuse: { boxes: [vt('vt', 'vt', '7: over', 'muted'), SRC_REUSED_OK, value('n', 'n', '42', 'ok')], line: 1 },
  }),
  astask: graph(REGIONS_TASK, TASK_CODE, {
    convert: { boxes: [SRC_PENDING, taskBox('pending')], line: 0 },
    many: {
      boxes: [SRC_REUSED_OK, taskBox('42', 'ok', [{ name: 'awaits', value: 'any number', kind: 'ok' }]), value('a', 'a', '42', 'ok'), value('b', 'b', '42', 'ok')],
      line: [1, 3],
    },
  }),

  'field-claim': graph([{ id: 'caller', name: 'Caller', tone: 'ui' }], FIELD_CODE, {
    store: { boxes: [claimField([{ name: 'holds', value: 'the ValueTask' }])], line: 0 },
    again: {
      boxes: [claimField([{ name: 'holds', value: 'the ValueTask' }, { name: 'result', value: 'cached' }]), value('a', 'a', '42'), value('b', 'b', '42')],
      line: { each: [2, 4] },
    },
  }),
  'field-reality': graph(REGIONS, FIELD_CODE, {
    holds: { boxes: [vt('f', '_pending'), SRC_PENDING], line: 0 },
    first: { boxes: [vt('f', '_pending'), SRC_REUSED_OK, value('a', 'a', '42', 'ok')], line: 2 },
    second: { boxes: [vt('f', '_pending', '7', 'bad', 'bad'), SRC_REUSED, value('a', 'a', '42', 'ok'), value('b', 'b', 'undefined', 'bad')], line: 4, bad: true },
  }),

  'result-claim': graph([{ id: 'caller', name: 'Caller', tone: 'ui' }], RESULT_CODE, {
    call: { boxes: [{ id: 'th', region: 'caller', title: 'Thread', fields: [{ name: 'calls', value: '.Result' }] }], line: 0 },
    block: {
      boxes: [{ id: 'th', region: 'caller', title: 'Thread', fields: [{ name: 'calls', value: '.Result' }, { name: 'blocks', value: 'until done' }, { name: 'cost', value: 'cheapest' }] }],
      line: 0,
    },
  }),
  'result-reality': graph(REGIONS, RESULT_CODE, {
    pending: { boxes: [vt('vt', 'ReadAsync()'), SRC_PENDING], line: 0 },
    unsupported: {
      boxes: [
        vt('vt', 'ReadAsync()', '7', undefined, 'bad'),
        { ...SRC_PENDING, fields: [...SRC_PENDING.fields!, { name: 'blocking', value: 'not supported', kind: 'bad' }] },
        value('n', '.Result', 'throws', 'bad'),
      ],
      line: 0,
      bad: true,
    },
    completed: {
      boxes: [
        { ...vt('vt', 'ReadAsync()'), fields: [{ name: 'source', ref: 'src' }, { name: 'token', value: '7' }, { name: 'IsCompleted', value: 'true', kind: 'ok' }] },
        SRC_DONE,
        value('n', '.Result', '42', 'ok'),
      ],
      line: 0,
    },
  }),

  'copy-claim': graph([{ id: 'caller', name: 'Caller', tone: 'ui' }], COPY_CODE, {
    copy: { boxes: [claimCopy('a', [{ name: 'copy', value: 'independent' }]), claimCopy('b', [{ name: 'copy', value: 'independent' }])], line: [1, 2] },
    await: {
      boxes: [
        claimCopy('a', [{ name: 'copy', value: 'independent' }, { name: 'awaited by', value: 'consumer 1' }]),
        claimCopy('b', [{ name: 'copy', value: 'independent' }, { name: 'awaited by', value: 'consumer 2' }]),
      ],
      line: [3, 4],
    },
  }),
  'copy-reality': graph(REGIONS, COPY_CODE, {
    same: { boxes: [vt('a', 'a'), vt('b', 'b'), SRC_PENDING], line: [1, 2] },
    first: { boxes: [vt('a', 'a', '7', 'ok'), vt('b', 'b'), SRC_REUSED_OK, value('x', 'x', '42', 'ok')], line: 3 },
    second: { boxes: [vt('a', 'a', '7', 'ok'), vt('b', 'b', '7', 'bad', 'bad'), SRC_REUSED, value('x', 'x', '42', 'ok'), value('y', 'y', 'undefined', 'bad')], line: 4, bad: true },
  }),
}

const drawing: QuestionDrawing = {
  setup: (p: StageDrawingProps) => <BoxGraph spec={SETUP} {...p} />,
  ...Object.fromEntries(Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />])),
}
export default drawing
