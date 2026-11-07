import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'Console.WriteLine("start");',
  'Console.WriteLine(Config.Value);',
  'Console.WriteLine(Config.Value);',
  '',
  'static class Config',
  '{',
  '    public static readonly int Value = Load();',
  '',
  '    static Config() => Console.WriteLine("cctor");',
  '',
  '    static int Load()',
  '    {',
  '        Console.WriteLine("load");',
  '        return 42;',
  '    }',
  '}',
]
const L = {
  START: 0,
  READ1: 1,
  READ2: 2,
  MAIN: [0, 2] as [number, number],
  CLASS: [4, 15] as [number, number],
  FIELD: { each: [6, 12] as number[] },
  BODY: 8,
}

const TYPE: Region = { id: 'type', name: 'Config type', sub: 'static state', tone: 'pool' }
const EMIT: Region = { id: 'emit', name: 'Compiled static constructor', sub: 'what the compiler emits', tone: 'io' }

type Init = 'not run' | 'running' | 'done'
const config = (init: Init | null, value: string, kind?: Field['kind']): Box => ({
  id: 'config',
  region: 'type',
  title: 'Config',
  sub: 'static class',
  fields: [
    ...(init === null ? [] : [{ name: 'initializer', value: init, kind: init === 'running' ? ('ok' as const) : undefined }]),
    { name: 'Value', value, kind: value === '?' ? 'muted' : kind },
  ],
})
/** The emitted .cctor: field initializers first, then the constructor body; `at` marks the part running now. */
const cctor = (at: 1 | 2 | null, order: 'real' | 'claim' = 'real'): Box => {
  const field: Field = { name: 'Value = Load()', value: 'writes load', kind: at === 1 ? (order === 'real' ? 'ok' : 'bad') : undefined }
  const body: Field = { name: 'body', value: 'writes cctor', kind: at === 2 ? (order === 'real' ? 'ok' : 'bad') : undefined }
  return { id: 'cctor', region: 'emit', still: at === null, title: '.cctor', sub: order === 'real' ? 'in emitted order' : 'the claimed order', fields: order === 'real' ? [field, body] : [body, field] }
}

const out = (...lines: string[]): OutLine[] =>
  lines.length ? lines.map((text, i) => ({ label: `line ${i + 1}`, text })) : [{ label: 'output', text: 'nothing yet', kind: 'muted' }]
const spec = (regions: Region[], steps: Record<string, GraphStep>): GraphSpec => ({ regions, code: CODE, outputName: 'Console', steps })
const both = (steps: Record<string, GraphStep>) => spec([TYPE, EMIT], steps)

const BEFORE = config('not run', '0')
const DONE = config('done', '42')
const CC = cctor(null)

/** The real run. */
const R = {
  start: { boxes: [BEFORE, CC], line: L.START, output: out('start') },
  firstRead: { boxes: [config('running', '0'), CC], line: L.READ1, output: out('start') },
  fieldInit: { boxes: [config('running', '42', 'ok'), cctor(1)], line: L.FIELD, output: out('start', 'load') },
  cctorBody: { boxes: [DONE, cctor(2)], line: L.BODY, output: out('start', 'load', 'cctor') },
  firstValue: { boxes: [DONE, CC], line: L.READ1, output: out('start', 'load', 'cctor', '42') },
  secondRead: { boxes: [DONE, CC], line: L.READ2, output: out('start', 'load', 'cctor', '42', '42') },
} satisfies Record<string, GraphStep>

const SETUP_BOX = config(null, '?')
const UNKNOWN: OutLine[] = [{ label: 'output', text: '?', kind: 'muted' }]

const SPECS: Record<string, GraphSpec> = {
  setup: spec([TYPE], {
    class: { boxes: [SETUP_BOX], line: L.CLASS, output: UNKNOWN },
    main: { boxes: [SETUP_BOX], line: L.MAIN, output: UNKNOWN },
    question: { boxes: [SETUP_BOX], line: L.MAIN, output: UNKNOWN },
  }),
  'first-access': both({
    start: R.start,
    'first-read': R.firstRead,
    'field-init': R.fieldInit,
    'cctor-body': R.cctorBody,
    'first-value': R.firstValue,
    'second-read': R.secondRead,
  }),

  'eager-claim': both({
    startup: { boxes: [config('done', '42', 'bad'), CC], line: L.CLASS, bad: true, output: out('load', 'cctor') },
    start: { boxes: [DONE, CC], line: L.START, output: out('load', 'cctor', 'start') },
    reads: { boxes: [DONE, CC], line: [L.READ1, L.READ2], output: out('load', 'cctor', 'start', '42', '42') },
  }),
  'eager-reality': both({
    startup: { boxes: [BEFORE, CC], line: null, output: out() },
    start: R.start,
    reads: { boxes: [DONE, CC], line: [L.READ1, L.READ2], output: out('start', 'load', 'cctor', '42', '42') },
  }),

  'body-first-claim': both({
    start: { ...R.firstRead, boxes: [config('running', '0'), cctor(null, 'claim')] },
    body: { boxes: [config('running', '0'), cctor(2, 'claim')], line: L.BODY, bad: true, output: out('start', 'cctor') },
    'field-init': { boxes: [DONE, cctor(1, 'claim')], line: L.FIELD, bad: true, output: out('start', 'cctor', 'load') },
    reads: { boxes: [DONE, cctor(null, 'claim')], line: [L.READ1, L.READ2], output: out('start', 'cctor', 'load', '42', '42') },
  }),
  'body-first-reality': both({
    start: R.firstRead,
    body: R.fieldInit,
    'field-init': R.cctorBody,
    reads: { boxes: [DONE, CC], line: [L.READ1, L.READ2], output: out('start', 'load', 'cctor', '42', '42') },
  }),

  'every-read-claim': both({
    'first-read': R.firstValue,
    'second-read': {
      boxes: [config('running', '42', 'bad'), CC],
      line: L.READ2,
      bad: true,
      output: out('start', 'load', 'cctor', '42', 'load', 'cctor', '42'),
    },
  }),
  'every-read-reality': both({ 'first-read': R.firstValue, 'second-read': R.secondRead }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
