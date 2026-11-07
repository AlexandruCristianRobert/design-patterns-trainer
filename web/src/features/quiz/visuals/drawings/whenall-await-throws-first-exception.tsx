import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'var first = Task.FromException(new InvalidOperationException("first"));',
  'var second = Task.FromException(new ArgumentException("second"));',
  'var all = Task.WhenAll(first, second);',
  '',
  'try { await all; }',
  'catch (Exception e) { Console.WriteLine(e.Message); }',
  '',
  'Console.WriteLine(all.Exception!.InnerExceptions.Count);',
]
const L = { TASKS: [0, 1] as [number, number], WHENALL: 2, AWAIT: [4, 5] as [number, number], COUNT: 7, SETUP_AWAIT: [4, 7] as [number, number] }

const regions: Region[] = [
  { id: 'locals', name: 'Locals', tone: 'ui' },
  { id: 'tasks', name: 'Tasks', sub: 'on the heap', tone: 'pool' },
  { id: 'errors', name: 'Exceptions', sub: 'on the heap', tone: 'io' },
]

type Mark = 'plain' | 'ok' | 'bad'
const locals = (all: boolean): Box => ({
  id: 'locals',
  region: 'locals',
  title: 'top-level',
  fields: [
    { name: 'first', ref: 'task-first', value: 'Task' },
    { name: 'second', ref: 'task-second', value: 'Task' },
    ...(all ? [{ name: 'all', ref: 'task-all', value: 'Task' }] : []),
  ],
})
const task = (who: 'first' | 'second'): Box => ({
  id: `task-${who}`,
  region: 'tasks',
  title: who,
  fields: [
    { name: 'Status', value: 'Faulted' },
    { name: 'fault', ref: `ex-${who}`, value: `"${who}"` },
  ],
})
const allTask = (faulted: boolean): Box => ({
  id: 'task-all',
  region: 'tasks',
  title: 'all',
  sub: 'from WhenAll',
  fields: faulted
    ? [
        { name: 'Status', value: 'Faulted' },
        { name: 'Exception', ref: 'agg', value: 'aggregate' },
      ]
    : [
        { name: 'Status', value: '?', kind: 'muted' },
        { name: 'Exception', value: '?', kind: 'muted' },
      ],
})
const ex = (who: 'first' | 'second', mark: Mark = 'plain'): Box => ({
  id: `ex-${who}`,
  region: 'errors',
  title: who === 'first' ? 'InvalidOperationException' : 'ArgumentException',
  sub: `Message "${who}"`,
  kind: mark,
})
/** inner: the aggregate's InnerExceptions in order ('count' draws only the number, with no claim about order). */
const agg = (inner: ('first' | 'second')[] | 'count', mark: Mark = 'plain'): Box => ({
  id: 'agg',
  region: 'errors',
  title: 'AggregateException',
  sub: 'InnerExceptions',
  kind: mark,
  fields:
    inner === 'count'
      ? [{ name: 'Count', value: '2' }]
      : inner.map((w, i): Field => ({ name: `[${i}]`, ref: `ex-${w}`, value: `"${w}"` })),
})

const out = (caught: string, lines: string[], kind: OutLine['kind'] = 'plain'): OutLine[] => [
  { label: 'e', text: caught, kind: caught === '?' ? 'muted' : kind },
  ...lines.map((t): OutLine => ({ label: 'Console', text: t, kind: t === '?' ? 'muted' : 'plain' })),
]
const IOE = 'InvalidOperationException'

const base = (all: Box | null, aggBox: Box | null, marks: { first?: Mark; second?: Mark } = {}): Box[] => [
  locals(all !== null),
  task('first'),
  task('second'),
  ...(all ? [all] : []),
  ex('first', marks.first),
  ex('second', marks.second),
  ...(aggBox ? [aggBox] : []),
]

const S = {
  tasks: { boxes: base(null, null), line: L.TASKS } as GraphStep,
  whenall: { boxes: base(allTask(true), agg(['first', 'second'])), line: L.WHENALL } as GraphStep,
  whenallCount: { boxes: base(allTask(true), agg('count')), line: L.WHENALL } as GraphStep,
  await: { boxes: base(allTask(true), agg(['first', 'second']), { first: 'ok' }), line: L.AWAIT, output: out(IOE, ['first'], 'ok') } as GraphStep,
  count: { boxes: base(allTask(true), agg(['first', 'second'], 'ok'), { first: 'ok' }), line: L.COUNT, output: out(IOE, ['first', '2'], 'ok') } as GraphStep,
}

const spec = (steps: Record<string, GraphStep>): GraphSpec => ({ regions, code: CODE, outputName: 'Output', steps })

const SPECS: Record<string, GraphSpec> = {
  setup: spec({
    tasks: S.tasks,
    whenall: { boxes: base(allTask(false), null), line: L.WHENALL },
    await: { boxes: base(allTask(false), null), line: L.SETUP_AWAIT, output: out('?', ['?', '?']) },
  }),
  'collect-and-rethrow': spec(S),

  'first-only-claim': spec({
    tasks: S.tasks,
    whenall: { boxes: base(allTask(true), agg(['first'], 'bad')), line: L.WHENALL },
    await: { boxes: base(allTask(true), agg(['first'], 'bad'), { first: 'ok' }), line: L.AWAIT, output: out(IOE, ['first']) },
    count: { boxes: base(allTask(true), agg(['first'], 'bad'), { first: 'ok' }), line: L.COUNT, bad: true, output: [...out(IOE, ['first']), { label: 'Console', text: '1', kind: 'bad' }] },
  }),
  'first-only-reality': spec(S),

  'second-claim': spec({
    tasks: S.tasks,
    whenall: S.whenallCount,
    await: { boxes: base(allTask(true), agg('count'), { second: 'bad' }), line: L.AWAIT, bad: true, output: out('ArgumentException', ['second'], 'bad') },
    count: { boxes: base(allTask(true), agg('count'), { second: 'bad' }), line: L.COUNT, output: out('ArgumentException', ['second', '2'], 'bad') },
  }),
  'second-reality': spec(S),

  'aggregate-claim': spec({
    tasks: S.tasks,
    whenall: S.whenall,
    await: {
      boxes: base(allTask(true), agg(['first', 'second'], 'bad')),
      line: L.AWAIT,
      bad: true,
      output: out('AggregateException', ['One or more errors occurred. (first) (second)'], 'bad'),
    },
    count: {
      boxes: base(allTask(true), agg(['first', 'second'], 'bad')),
      line: L.COUNT,
      output: out('AggregateException', ['One or more errors occurred. (first) (second)', '2'], 'bad'),
    },
  }),
  'aggregate-reality': spec(S),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
