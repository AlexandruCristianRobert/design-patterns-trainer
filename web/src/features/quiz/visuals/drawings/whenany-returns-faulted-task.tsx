import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'var never = new TaskCompletionSource<int>().Task;',
  'var failed = Task.FromException<int>(new InvalidOperationException("boom"));',
  '',
  'Task<int> winner = await Task.WhenAny(never, failed);',
  'Console.WriteLine(winner == failed);',
  'Console.WriteLine(winner.Status);',
]
const OBSERVE_CODE = [...CODE, 'int value = await winner;']
const L = { TASKS: [0, 1] as [number, number], AWAIT: 3, PRINT: [4, 5] as [number, number], FIRST: 4, STATUS: 5, OBSERVE: 6, ALL: [3, 5] as [number, number] }

const REGIONS: Region[] = [
  { id: 'main', name: 'Main', sub: 'locals', tone: 'ui' },
  { id: 'tasks', name: 'Tasks', tone: 'pool' },
]
const graph = (steps: Record<string, GraphStep>, code = CODE): GraphSpec => ({ regions: REGIONS, code, outputName: 'Console', steps })

const box = (id: string, title: string, sub: string, fields: Field[], kind?: Box['kind'], region = 'tasks'): Box => ({ id, region, title, sub, fields, kind })
// Neutral: only what the code says about each task.
const NEVER = box('never', 'never', 'Task<int>', [{ name: 'from', value: 'TCS, never set' }])
const FAILED = box('failed', 'failed', 'Task<int>', [{ name: 'from', value: 'FromException' }])
// Real states.
const NEVER_STATE = box('never', 'never', 'Task<int>', [{ name: 'Status', value: 'WaitingForActivation', kind: 'muted' }])
const FAILED_STATE = box('failed', 'failed', 'Task<int>', [
  { name: 'Status', value: 'Faulted', kind: 'bad' },
  { name: 'Exception', value: 'boom' },
])
const ANY = box('any', 'WhenAny task', 'Task<Task<int>>', [
  { name: 'Status', value: 'RanToCompletion', kind: 'ok' },
  { name: 'Result', value: 'failed', ref: 'failed' },
])
const winner = (fields: Field[], kind?: Box['kind']) => box('winner', 'winner', 'Task<int>', fields, kind, 'main')
const WINNER = winner([{ name: 'is', value: 'failed', ref: 'failed', kind: 'ok' }])

const out = (...lines: [text: string, kind?: OutLine['kind']][]): OutLine[] => lines.map(([text, kind], i) => ({ label: `Line ${i + 1}`, text, kind }))
const REAL_OUT = out(['True', 'ok'], ['Faulted', 'ok'])
const REAL = [WINNER, ANY, NEVER_STATE, FAILED_STATE]

const SPECS: Record<string, GraphSpec> = {
  setup: graph({
    tasks: { boxes: [NEVER, FAILED], line: L.TASKS },
    whenany: { boxes: [winner([{ name: 'is', value: '?' }]), NEVER, FAILED], line: L.ALL },
  }),

  race: graph({
    states: { boxes: [NEVER_STATE, FAILED_STATE], line: L.TASKS },
    any: { boxes: [ANY, NEVER_STATE, FAILED_STATE], line: L.AWAIT },
    await: { boxes: REAL, line: L.AWAIT },
    print: { boxes: REAL, line: L.PRINT, output: REAL_OUT },
  }),
  observe: graph(
    {
      left: { boxes: [WINNER, { ...NEVER_STATE, fields: [{ name: 'Status', value: 'WaitingForActivation', kind: 'muted' }, { name: 'cancelled', value: 'no' }] }, FAILED_STATE], line: L.TASKS, output: REAL_OUT },
      throw: {
        boxes: REAL,
        line: L.OBSERVE,
        bad: true,
        output: [...REAL_OUT, { label: 'Then', text: 'InvalidOperationException: boom', kind: 'bad' }],
      },
    },
    OBSERVE_CODE,
  ),

  'status-claim': graph({
    winner: { boxes: [winner([{ name: 'is', value: 'failed', ref: 'failed' }]), NEVER, FAILED], line: L.FIRST, output: out(['True']) },
    status: {
      boxes: [winner([{ name: 'is', value: 'failed', ref: 'failed' }, { name: 'Status', value: 'RanToCompletion', kind: 'bad' }], 'bad'), NEVER, FAILED],
      line: L.STATUS,
      bad: true,
      output: out(['True'], ['RanToCompletion', 'bad']),
    },
  }),
  'status-reality': graph({
    winner: { boxes: [WINNER, ANY, NEVER, FAILED], line: L.AWAIT },
    status: { boxes: [winner([{ name: 'is', value: 'failed', ref: 'failed' }, { name: 'Status', value: 'Faulted', kind: 'ok' }], 'ok'), ANY, NEVER, FAILED_STATE], line: L.STATUS, output: REAL_OUT },
  }),

  'waiting-claim': graph({
    winner: { boxes: [winner([{ name: 'is', value: 'not failed', kind: 'bad' }], 'bad'), NEVER, FAILED], line: L.FIRST, bad: true, output: out(['False', 'bad']) },
    status: {
      boxes: [winner([{ name: 'is', value: 'never', ref: 'never', kind: 'bad' }, { name: 'Status', value: 'WaitingForActivation', kind: 'bad' }], 'bad'), NEVER, FAILED],
      line: L.STATUS,
      bad: true,
      output: out(['False', 'bad'], ['WaitingForActivation', 'bad']),
    },
  }),
  'waiting-reality': graph({
    winner: { boxes: [ANY, NEVER_STATE, FAILED_STATE], line: L.AWAIT },
    status: { boxes: REAL, line: L.PRINT, output: REAL_OUT },
  }),

  'throw-claim': graph({
    await: { boxes: [winner([{ name: 'is', value: 'never assigned', kind: 'muted' }]), NEVER, FAILED], line: L.AWAIT, bad: true, output: [{ label: 'Thrown', text: 'InvalidOperationException: boom', kind: 'bad' }] },
    print: {
      boxes: [winner([{ name: 'is', value: 'never assigned', kind: 'muted' }]), NEVER, FAILED],
      line: L.AWAIT,
      bad: true,
      output: [{ label: 'Thrown', text: 'InvalidOperationException: boom', kind: 'bad' }, { label: 'Result', text: 'unhandled, program ends', kind: 'bad' }],
    },
  }),
  'throw-reality': graph({
    await: { boxes: [WINNER, ANY, NEVER_STATE, FAILED_STATE], line: L.AWAIT, output: [{ label: 'Thrown', text: 'nothing', kind: 'ok' }] },
    print: { boxes: REAL, line: L.PRINT, output: REAL_OUT },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
