import { BoxGraph, type Box, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'var fromFor = new List<Func<int>>();',
  'for (var i = 0; i < 3; i++) fromFor.Add(() => i);',
  '',
  'var fromForeach = new List<Func<int>>();',
  'foreach (var n in new[] { 0, 1, 2 }) fromForeach.Add(() => n);',
  '',
  'Console.WriteLine(string.Join(",", fromFor.Select(f => f())));',
  'Console.WriteLine(string.Join(",", fromForeach.Select(f => f())));',
]
const L = { FOR: 1, FOREACH: 4, PRINT_FOR: 6, PRINT_FOREACH: 7, PRINT: [6, 7] as [number, number] }

const LAMBDAS: Region = { id: 'lambdas', name: 'Lambdas', sub: 'in the list', tone: 'ui' }
const VARS: Region = { id: 'vars', name: 'Captured variables', sub: 'in closure objects on the heap', tone: 'pool' }
const regions = [LAMBDAS, VARS]

type Loop = 'for' | 'foreach'
const NAME = { for: 'i', foreach: 'n' }
const LIST = { for: 'fromFor', foreach: 'fromForeach' }

/** The lambdas of one loop; each captures the variable box `target(k)`. */
const lambdas = (loop: Loop, count: number, target: (k: number) => string): Box[] =>
  Array.from({ length: count }, (_, k) => ({
    id: `${loop}-l${k}`,
    region: 'lambdas',
    title: `${LIST[loop]}[${k}]`,
    sub: `() => ${NAME[loop]}`,
    fields: [{ name: 'captures', value: NAME[loop], ref: target(k) }],
  }))
const variable = (loop: Loop, id: string, value: number | string, sub = 'captured variable', kept = false): Box => ({
  id,
  region: 'vars',
  title: NAME[loop],
  sub,
  fields: [{ name: 'value', value: String(value), kind: kept ? 'ok' : 'plain' }],
})
const PASSES = '0, then 1, then 2'
/** One variable for the whole loop. */
const shared = (loop: Loop, count: number, value: number | string): Box[] => [variable(loop, `${loop}-v`, value, 'one variable for the whole loop'), ...lambdas(loop, count, () => `${loop}-v`)]
/** A fresh variable per pass, holding that pass's value (kept: marked as still holding it after the loop). */
const perPass = (loop: Loop, count: number, kept = false): Box[] => [
  ...Array.from({ length: count }, (_, k) => variable(loop, `${loop}-v${k}`, k, `pass ${k + 1}`, kept)),
  ...lambdas(loop, count, (k) => `${loop}-v${k}`),
]

const line1 = (text: string, kind: OutLine['kind'] = 'plain'): OutLine => ({ label: 'Line 1', text, kind })
const line2 = (text: string, kind: OutLine['kind'] = 'plain'): OutLine => ({ label: 'Line 2', text, kind })

const spec = (steps: Record<string, GraphStep>): GraphSpec => ({ regions, code: CODE, outputName: 'Console', steps })

const forReal = {
  'add-lambdas': { boxes: shared('for', 3, PASSES), line: L.FOR },
  'loop-ends': { boxes: shared('for', 3, 3), line: L.FOR },
}
const foreachReal = {
  'add-lambdas': { boxes: perPass('foreach', 3), line: L.FOREACH },
  'loop-ends': { boxes: perPass('foreach', 3, true), line: L.FOREACH },
}

const SPECS: Record<string, GraphSpec> = {
  setup: {
    regions: [
      { id: 'for', name: 'fromFor', sub: 'filled by the for loop', tone: 'ui' },
      { id: 'foreach', name: 'fromForeach', sub: 'filled by the foreach loop', tone: 'pool' },
    ],
    code: CODE,
    outputName: 'Console',
    steps: (() => {
      const list = (loop: Loop): Box[] =>
        [0, 1, 2].map((k) => ({ id: `${loop}-${k}`, region: loop, title: `${LIST[loop]}[${k}]`, fields: [{ name: 'returns', value: NAME[loop] }] }))
      return {
        'for-adds': { boxes: list('for'), line: L.FOR },
        'foreach-adds': { boxes: [...list('for'), ...list('foreach')], line: L.FOREACH },
        calls: { boxes: [...list('for'), ...list('foreach')], line: L.PRINT, output: [line1('?', 'muted'), line2('?', 'muted')] },
      }
    })(),
  },
  'for-loop': spec({
    declare: { boxes: [variable('for', 'for-v', 0, 'one variable for the whole loop')], line: L.FOR },
    ...forReal,
    call: { boxes: shared('for', 3, 3), line: L.PRINT_FOR, output: [line1('3,3,3', 'ok')] },
  }),
  'foreach-loop': spec({
    'first-pass': { boxes: [variable('foreach', 'foreach-v0', 0, 'pass 1'), ...lambdas('foreach', 1, () => 'foreach-v0')], line: L.FOREACH },
    ...foreachReal,
    call: { boxes: perPass('foreach', 3, true), line: L.PRINT_FOREACH, output: [line2('0,1,2', 'ok')] },
  }),
  'for-per-pass-claim': spec({
    'add-lambdas': { boxes: perPass('for', 3), line: L.FOR },
    'loop-ends': { boxes: perPass('for', 3, true), line: L.FOR },
    call: { boxes: perPass('for', 3, true), line: L.PRINT, output: [line1('0,1,2'), line2('0,1,2')] },
  }),
  'for-per-pass-reality': spec({
    ...forReal,
    call: { boxes: shared('for', 3, 3), line: L.PRINT, output: [line1('3,3,3', 'ok'), line2('0,1,2')] },
  }),
  'foreach-three-claim': spec({
    'add-lambdas': { boxes: shared('foreach', 3, PASSES), line: L.FOREACH },
    'loop-ends': { boxes: shared('foreach', 3, 3), line: L.FOREACH },
    call: { boxes: shared('foreach', 3, 3), line: L.PRINT, output: [line1('3,3,3'), line2('3,3,3')] },
  }),
  'foreach-three-reality': spec({
    ...foreachReal,
    call: { boxes: perPass('foreach', 3, true), line: L.PRINT, output: [line1('3,3,3'), line2('0,1,2', 'ok')] },
  }),
  'foreach-shared-claim': spec({
    'add-lambdas': { boxes: shared('foreach', 3, PASSES), line: L.FOREACH },
    'loop-ends': { boxes: shared('foreach', 3, 2), line: L.FOREACH },
    call: { boxes: shared('foreach', 3, 2), line: L.PRINT, output: [line1('3,3,3'), line2('2,2,2')] },
  }),
  'foreach-shared-reality': spec({
    ...foreachReal,
    call: { boxes: perPass('foreach', 3, true), line: L.PRINT, output: [line1('3,3,3'), line2('0,1,2', 'ok')] },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
