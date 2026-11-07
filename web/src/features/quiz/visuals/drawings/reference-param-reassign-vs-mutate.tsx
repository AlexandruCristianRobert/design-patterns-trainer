import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'var list = new List<int> { 1 };',
  'Reset(list);',
  'Grow(list);',
  'Console.WriteLine(string.Join(",", list));',
  'ResetByRef(ref list);',
  'Console.WriteLine(list.Count);',
  '',
  'static void Reset(List<int> items)',
  '{',
  '    items = new List<int>();',
  '    items.Add(99);',
  '}',
  'static void Grow(List<int> items) => items.Add(2);',
  'static void ResetByRef(ref List<int> items) =>',
  '    items = new List<int>();',
]
const L = { NEW: 0, RESET: 1, GROW: 2, PRINT1: 3, BYREF: 4, PRINT2: 5, ASSIGN: [9, 10] as [number, number], ADD: 12, REFASSIGN: 14 }

const REGIONS: Region[] = [
  { id: 'stack', name: 'Stack', sub: 'method frames', tone: 'ui' },
  { id: 'heap', name: 'Heap', sub: 'objects', tone: 'pool' },
]
const NAMES: Record<string, string> = { l1: 'List #1', l2: 'List #2', l3: 'List #3', copy: 'Copy of #1' }

const main = (target: string): Box => ({ id: 'main', region: 'stack', title: 'Main', fields: [{ name: 'list', ref: target, value: NAMES[target] }] })
/** A method's frame; its `items` parameter points at a list, or (ref) at the caller's variable. */
const frame = (name: string, items: Pick<Field, 'ref' | 'value' | 'kind'>, kind?: Box['kind']): Box => ({
  id: 'frame',
  region: 'stack',
  title: name,
  kind,
  fields: [{ name: 'items', ...items }],
})
const to = (target: string, kind?: Field['kind']) => ({ ref: target, value: NAMES[target], kind })
const ALIAS = { ref: 'main', value: 'alias of list' }
const list = (id: string, items: number[], kind?: Box['kind']): Box => ({
  id,
  region: 'heap',
  title: `${NAMES[id]}: List<int>`,
  kind,
  fields: items.length ? items.map((x, i) => ({ name: `[${i}]`, value: String(x) })) : [{ name: 'Count', value: '0' }],
})

const console2 = (first: string, second: string, kind1?: OutLine['kind'], kind2?: OutLine['kind']): OutLine[] => [
  { label: 'line 1', text: first, kind: first === '?' ? 'muted' : kind1 },
  { label: 'line 2', text: second, kind: second === '?' ? 'muted' : kind2 },
]
const spec = (steps: Record<string, GraphStep>): GraphSpec => ({ regions: REGIONS, code: CODE, outputName: 'Console', steps })

const UNKNOWN = console2('?', '?')
const create: GraphStep = { boxes: [main('l1'), list('l1', [1])], line: L.NEW, output: UNKNOWN }
/** Before ResetByRef: list holds 1 and 2, and the first line is printed. */
const before = (frameBox: Box): Box[] => [main('l1'), frameBox, list('l1', [1, 2])]

const SPECS: Record<string, GraphSpec> = {
  setup: spec({
    create,
    calls: { boxes: [main('l1'), list('l1', [1])], line: [L.RESET, L.PRINT2], output: UNKNOWN },
  }),
  'by-value': spec({
    create,
    'reset-call': { boxes: [main('l1'), frame('Reset', to('l1')), list('l1', [1])], line: L.RESET, output: UNKNOWN },
    'reset-new': { boxes: [main('l1'), frame('Reset', to('l2')), list('l1', [1]), list('l2', [99])], line: L.ASSIGN, output: UNKNOWN },
    'reset-done': { boxes: [main('l1'), list('l1', [1]), list('l2', [99], 'gone')], line: L.RESET, output: UNKNOWN },
    grow: { boxes: [main('l1'), frame('Grow', to('l1')), list('l1', [1, 2]), list('l2', [99], 'gone')], line: L.ADD, output: UNKNOWN },
    print: { boxes: [main('l1'), list('l1', [1, 2]), list('l2', [99], 'gone')], line: L.PRINT1, output: console2('1,2', '?', 'ok') },
  }),
  'by-ref': spec({
    call: { boxes: before(frame('ResetByRef', ALIAS)), line: L.BYREF, output: console2('1,2', '?') },
    assign: { boxes: [main('l3'), frame('ResetByRef', ALIAS), list('l1', [1, 2], 'gone'), list('l3', [])], line: L.REFASSIGN, output: console2('1,2', '?') },
    print: { boxes: [main('l3'), list('l1', [1, 2], 'gone'), list('l3', [])], line: L.PRINT2, output: console2('1,2', '0', 'plain', 'ok') },
  }),

  'by-ref-claim': spec({
    'reset-call': { boxes: [main('l1'), frame('Reset', ALIAS), list('l1', [1])], line: L.RESET, output: UNKNOWN },
    'reset-new': { boxes: [main('l2'), frame('Reset', ALIAS), list('l1', [1], 'gone'), list('l2', [99])], line: L.ASSIGN, output: UNKNOWN },
    grow: { boxes: [main('l2'), frame('Grow', to('l2')), list('l1', [1], 'gone'), list('l2', [99, 2])], line: L.ADD, output: console2('99,2', '0', 'bad', 'plain') },
  }),
  'by-ref-reality': spec({
    'reset-call': { boxes: [main('l1'), frame('Reset', to('l1')), list('l1', [1])], line: L.RESET, output: UNKNOWN },
    'reset-new': { boxes: [main('l1'), frame('Reset', to('l2')), list('l1', [1]), list('l2', [99])], line: L.ASSIGN, output: UNKNOWN },
    grow: { boxes: [main('l1'), frame('Grow', to('l1')), list('l1', [1, 2]), list('l2', [99], 'gone')], line: L.ADD, output: console2('1,2', '?', 'ok') },
  }),

  'ref-ignored-claim': spec({
    call: { boxes: before(frame('ResetByRef', to('l1'))), line: L.BYREF, output: console2('1,2', '?') },
    assign: { boxes: [main('l1'), frame('ResetByRef', to('l3')), list('l1', [1, 2]), list('l3', [])], line: L.REFASSIGN, output: console2('1,2', '?') },
    print: { boxes: [main('l1'), list('l1', [1, 2]), list('l3', [], 'gone')], line: L.PRINT2, output: console2('1,2', '2', 'plain', 'bad') },
  }),
  'ref-ignored-reality': spec({
    call: { boxes: before(frame('ResetByRef', ALIAS)), line: L.BYREF, output: console2('1,2', '?') },
    assign: { boxes: [main('l3'), frame('ResetByRef', ALIAS), list('l1', [1, 2], 'gone'), list('l3', [])], line: L.REFASSIGN, output: console2('1,2', '?') },
    print: { boxes: [main('l3'), list('l1', [1, 2], 'gone'), list('l3', [])], line: L.PRINT2, output: console2('1,2', '0', 'plain', 'ok') },
  }),

  'copied-claim': spec({
    'grow-call': { boxes: [main('l1'), frame('Grow', to('copy')), list('l1', [1]), list('copy', [1])], line: L.GROW, output: UNKNOWN },
    'grow-add': { boxes: [main('l1'), frame('Grow', to('copy')), list('l1', [1]), list('copy', [1, 2])], line: L.ADD, output: UNKNOWN },
    print: { boxes: [main('l1'), list('l1', [1]), list('copy', [1, 2], 'gone')], line: L.PRINT1, output: console2('1', '?', 'bad') },
  }),
  'copied-reality': spec({
    'grow-call': { boxes: [main('l1'), frame('Grow', to('l1')), list('l1', [1])], line: L.GROW, output: UNKNOWN },
    'grow-add': { boxes: [main('l1'), frame('Grow', to('l1')), list('l1', [1, 2])], line: L.ADD, output: UNKNOWN },
    print: { boxes: [main('l1'), list('l1', [1, 2])], line: L.PRINT1, output: console2('1,2', '?', 'ok') },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
