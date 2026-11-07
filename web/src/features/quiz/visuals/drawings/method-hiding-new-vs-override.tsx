import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { LineAt } from '../CodePanel'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'Animal a = new Dog();',
  'var d = (Dog)a;',
  'Console.WriteLine($"{a.Speak()} {a.Name()} {d.Name()}");',
  '',
  'class Animal',
  '{',
  '    public virtual string Speak() => "...";',
  '    public string Name() => "animal";',
  '}',
  '',
  'class Dog : Animal',
  '{',
  '    public override string Speak() => "woof";',
  '    public new string Name() => "dog";',
  '}',
]
const L = { VARS: [0, 1] as [number, number], PRINT: 2 }
const at = (method: number): LineAt => ({ each: [L.PRINT, method] })
const M = { aSpeak: 6, aName: 7, dSpeak: 12, dName: 13 }

const REGIONS: Region[] = [
  { id: 'vars', name: 'Variables', tone: 'ui' },
  { id: 'methods', name: 'Methods', tone: 'io' },
]
const spec = (steps: Record<string, GraphStep>): GraphSpec => ({ regions: REGIONS, code: CODE, outputName: 'Console', steps })

type MethodId = keyof typeof M
const METHOD: Record<MethodId, { title: string; sub?: string; returns: string }> = {
  aSpeak: { title: 'Animal.Speak', sub: 'virtual', returns: '"..."' },
  aName: { title: 'Animal.Name', returns: '"animal"' },
  dSpeak: { title: 'Dog.Speak', sub: 'override', returns: '"woof"' },
  dName: { title: 'Dog.Name', sub: 'new', returns: '"dog"' },
}
/** The four methods. Reality: the methods run so far are marked ok. Claim: the claimed ones stay plain, the rest are dimmed. */
const methods = (hits: MethodId[] = [], claim = false): Box[] =>
  (Object.keys(METHOD) as MethodId[]).map((id) => ({
    id,
    region: 'methods',
    title: METHOD[id].title,
    sub: METHOD[id].sub,
    fields: [{ name: 'returns', value: METHOD[id].returns }],
    kind: hits.includes(id) ? (claim ? undefined : 'ok') : claim ? 'muted' : undefined,
  }))

/** A call field: `runs` points at the method while it is the current call; afterwards it keeps only the name. */
type Call = [label: string, target: MethodId | '?', current?: boolean]
const call = ([label, target, current]: Call): Field =>
  target === '?'
    ? { name: label, value: '?', kind: 'muted' }
    : current
      ? { name: label, ref: target, value: METHOD[target].title }
      : { name: label, value: METHOD[target].title }
const OBJ: Field = { name: 'refers to', value: 'the Dog object', kind: 'inline' }
const vars = (aCalls: Call[] = [], dCalls: Call[] = []): Box[] => [
  { id: 'a', region: 'vars', title: 'a', sub: 'declared as Animal', fields: [OBJ, ...aCalls.map(call)] },
  { id: 'd', region: 'vars', title: 'd', sub: 'declared as Dog', fields: [OBJ, ...dCalls.map(call)] },
]
const out = (text: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'line', text, kind: text === '? ? ?' ? 'muted' : kind }]

const objects: GraphStep = { boxes: [...vars(), ...methods()], line: L.VARS, output: out('? ? ?') }
const done = (aName: MethodId, dName: MethodId, speak: MethodId, text: string, kind?: OutLine['kind']): GraphStep => ({
  boxes: [...vars([['a.Speak()', speak], ['a.Name()', aName]], [['d.Name()', dName]]), ...methods([speak, aName, dName], kind !== 'ok')],
  line: L.PRINT,
  output: out(text, kind),
})

const SPECS: Record<string, GraphSpec> = {
  setup: spec({
    objects,
    calls: { boxes: [...vars([['a.Speak()', '?'], ['a.Name()', '?']], [['d.Name()', '?']]), ...methods()], line: L.PRINT, output: out('? ? ?') },
  }),
  dispatch: spec({
    objects,
    speak: { boxes: [...vars([['a.Speak()', 'dSpeak', true]]), ...methods(['dSpeak'])], line: at(M.dSpeak), output: out('woof ? ?') },
    'a-name': { boxes: [...vars([['a.Speak()', 'dSpeak'], ['a.Name()', 'aName', true]]), ...methods(['dSpeak', 'aName'])], line: at(M.aName), output: out('woof animal ?') },
    'd-name': {
      boxes: [...vars([['a.Speak()', 'dSpeak'], ['a.Name()', 'aName']], [['d.Name()', 'dName', true]]), ...methods(['dSpeak', 'aName', 'dName'])],
      line: at(M.dName),
      output: out('woof animal dog', 'ok'),
    },
  }),

  'new-claim': spec({
    'a-name': { boxes: [...vars([['a.Speak()', 'dSpeak'], ['a.Name()', 'dName', true]]), ...methods(['dSpeak', 'dName'], true)], line: at(M.dName), output: out('woof dog ?') },
    print: done('dName', 'dName', 'dSpeak', 'woof dog dog'),
  }),
  'new-reality': spec({
    'a-name': { boxes: [...vars([['a.Speak()', 'dSpeak'], ['a.Name()', 'aName', true]]), ...methods(['dSpeak', 'aName'])], line: at(M.aName), output: out('woof animal ?') },
    print: done('aName', 'dName', 'dSpeak', 'woof animal dog', 'ok'),
  }),

  'static-claim': spec({
    speak: { boxes: [...vars([['a.Speak()', 'aSpeak', true]]), ...methods(['aSpeak'], true)], line: at(M.aSpeak), output: out('... ? ?') },
    print: done('aName', 'dName', 'aSpeak', '... animal dog'),
  }),
  'static-reality': spec({
    speak: { boxes: [...vars([['a.Speak()', 'dSpeak', true]]), ...methods(['dSpeak'])], line: at(M.dSpeak), output: out('woof ? ?') },
    print: done('aName', 'dName', 'dSpeak', 'woof animal dog', 'ok'),
  }),

  'base-claim': spec({
    'd-name': {
      boxes: [...vars([['a.Speak()', 'dSpeak'], ['a.Name()', 'aName']], [['d.Name()', 'aName', true]]), ...methods(['dSpeak', 'aName'], true)],
      line: at(M.aName),
      output: out('woof animal ?'),
    },
    print: done('aName', 'aName', 'dSpeak', 'woof animal animal'),
  }),
  'base-reality': spec({
    'd-name': {
      boxes: [...vars([['a.Speak()', 'dSpeak'], ['a.Name()', 'aName']], [['d.Name()', 'dName', true]]), ...methods(['dSpeak', 'aName', 'dName'])],
      line: at(M.dName),
      output: out('woof animal ?'),
    },
    print: done('aName', 'dName', 'dSpeak', 'woof animal dog', 'ok'),
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
