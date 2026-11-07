import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'int[] scores = [10, 20, 30];',
  'ref int slot = ref Largest(scores);',
  'slot = 0;',
  'Console.WriteLine($"{string.Join(",", scores)} {Largest(scores)}");',
  '',
  'static ref int Largest(int[] values)',
  '{',
  '    var best = 0;',
  '    for (var i = 1; i < values.Length; i++)',
  '        if (values[i] > values[best]) best = i;',
  '    return ref values[best];',
  '}',
]
const L = { ARRAY: 0, SLOT: 1, WRITE: 2, PRINT: 3, SETUP: [1, 2] as [number, number], RETURN: 10, BODY: [7, 10] as [number, number] }

const regions: Region[] = [
  { id: 'stack', name: 'Stack', sub: 'locals and calls', tone: 'ui' },
  { id: 'heap', name: 'Heap', sub: 'the array', tone: 'pool' },
]

type Mark = Field['kind']
/** slot: absent, unknown, an alias of scores[2], or a claimed plain copy holding a value. */
type Slot = null | '?' | 'alias' | { copy: string; kind?: Mark }
const locals = (slot: Slot): Box => {
  const fields: Field[] = [{ name: 'scores', ref: 'arr', value: 'int[]' }]
  if (slot === '?') fields.push({ name: 'slot', value: '?', kind: 'muted' })
  else if (slot === 'alias') fields.push({ name: 'slot', ref: 'arr', value: '&scores[2]' })
  else if (slot) fields.push({ name: 'slot', value: slot.copy, kind: slot.kind ?? 'inline' })
  return { id: 'locals', region: 'stack', title: 'locals', fields }
}

/** The array; `aliasLabel` names what refers to element [2]. */
const arr = (values: string, marks: Record<number, Mark> = {}, aliasLabel: string | null = null): Box => ({
  id: 'arr',
  region: 'heap',
  title: 'int[3]',
  sub: 'scores refers to it',
  fields: values.split(',').map((v, i) => ({ name: i === 2 && aliasLabel ? `[2] · ${aliasLabel}` : `[${i}]`, value: v, kind: marks[i] ?? 'plain' })),
})

const firstCall: Box = {
  id: 'call1',
  region: 'stack',
  title: 'Largest(scores)',
  sub: 'first call',
  fields: [
    { name: 'best', value: '2' },
    { name: 'returns', ref: 'arr', value: 'ref values[2]', kind: 'ok' },
  ],
}
const secondCall = (returns: string, kind: Mark = 'ok', sub = 'second call, as a value'): Box => ({
  id: 'call2',
  region: 'stack',
  title: 'Largest(scores)',
  sub,
  fields: [{ name: 'returns', value: returns, kind }],
})

const out = (text: string, kind: OutLine['kind'] = 'plain'): OutLine[] => [{ label: 'Printed', text, kind: text === '?' ? 'muted' : kind }]
const spec = (steps: Record<string, GraphStep>): GraphSpec => ({ regions, code: CODE, outputName: 'Console', steps })

const ORIGINAL = '10,20,30'
const CHANGED = '10,20,0'
/** The real run. */
const R = {
  call: { boxes: [locals(null), firstCall, arr(ORIGINAL, { 2: 'ok' }, 'returned')], line: L.RETURN },
  slot: { boxes: [locals('alias'), arr(ORIGINAL, {}, 'slot')], line: L.SLOT },
  write: { boxes: [locals('alias'), arr(CHANGED, { 2: 'ok' }, 'slot')], line: L.WRITE },
  again: { boxes: [locals('alias'), secondCall('20'), arr(CHANGED, { 1: 'ok' }, 'slot')], line: L.PRINT },
  print: { boxes: [locals('alias'), secondCall('20'), arr(CHANGED, { 1: 'ok' }, 'slot')], line: L.PRINT, output: out('10,20,0 20', 'ok') },
} satisfies Record<string, GraphStep>

const SPECS: Record<string, GraphSpec> = {
  setup: spec({
    array: { boxes: [locals(null), arr(ORIGINAL)], line: L.ARRAY },
    slot: { boxes: [locals('?'), arr(ORIGINAL)], line: L.SETUP },
    print: { boxes: [locals('?'), arr(ORIGINAL)], line: L.PRINT, output: out('?') },
  }),
  alias: spec({ call: R.call, slot: R.slot, write: R.write, again: R.again, print: R.print }),

  'copy-claim': spec({
    slot: { boxes: [locals({ copy: '30', kind: 'bad' }), arr(ORIGINAL)], line: L.SLOT, bad: true },
    write: { boxes: [locals({ copy: '0', kind: 'bad' }), arr(ORIGINAL, { 2: 'bad' })], line: L.WRITE, bad: true },
    print: { boxes: [locals({ copy: '0' }), secondCall('30', 'bad'), arr(ORIGINAL)], line: L.PRINT, bad: true, output: out('10,20,30 30', 'bad') },
  }),
  'copy-reality': spec({ slot: R.slot, write: R.write, print: { ...R.print, boxes: [locals('alias'), secondCall('20'), arr(CHANGED, { 1: 'ok' }, 'slot')] } }),

  'remembered-claim': spec({
    write: R.write,
    again: { boxes: [locals('alias'), secondCall('30', 'bad', 'second call: remembered'), arr(CHANGED, {}, 'slot')], line: L.PRINT, bad: true },
    print: { boxes: [locals('alias'), secondCall('30', 'bad', 'second call: remembered'), arr(CHANGED, {}, 'slot')], line: L.PRINT, bad: true, output: out('10,20,0 30', 'bad') },
  }),
  'remembered-reality': spec({ write: R.write, again: { ...R.again, line: L.BODY }, print: R.print }),

  'wrong-side-claim': spec({
    write: { boxes: [locals('alias'), arr(ORIGINAL, { 2: 'bad' }, 'slot')], line: L.WRITE, bad: true },
    again: { boxes: [locals('alias'), secondCall('0', 'bad'), arr(ORIGINAL, {}, 'slot')], line: L.PRINT, bad: true },
    print: { boxes: [locals('alias'), secondCall('0', 'bad'), arr(ORIGINAL, {}, 'slot')], line: L.PRINT, bad: true, output: out('10,20,30 0', 'bad') },
  }),
  'wrong-side-reality': spec({ write: R.write, again: R.again, print: R.print }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
