import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'var p = new Person("Ana");',
  'p.Rename("Bea");',
  'Console.WriteLine($"{p.Name} {p.Greeting}");',
  '',
  'class Person(string name)',
  '{',
  '    public string Name { get; } = name;',
  '    public string Greeting => $"Hi {name}";',
  '    public void Rename(string newName) => name = newName;',
  '}',
]
const L = { NEW: 0, RENAME: 1, PRINT: 2, CLASS: 4, NAME: 6, GREETING: 7, RENAME_DEF: 8 }

const REGIONS = [
  { id: 'vars', name: 'Variables', tone: 'ui' as const },
  { id: 'objs', name: 'Objects', tone: 'pool' as const },
]
const P: Box = { id: 'p', region: 'vars', title: 'p', fields: [{ name: 'ref', ref: 'obj' }] }
const obj = (fields: Field[], kind?: Box['kind']): Box => ({ id: 'obj', region: 'objs', title: 'Person', sub: 'object', fields, kind })
const graph = (steps: Record<string, GraphStep>): GraphSpec => ({ regions: REGIONS, code: CODE, outputName: 'Console', steps })
const out = (text: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'prints', text, kind }]

// ---- Setup: only the calls the stem makes; no fields inside the object ----
const SETUP = graph({
  new: { boxes: [P, obj([{ name: 'created with', value: '"Ana"' }])], line: L.NEW },
  rename: { boxes: [P, obj([{ name: 'created with', value: '"Ana"' }, { name: 'then', value: 'Rename("Bea")' }])], line: L.RENAME },
  ask: { boxes: [{ ...P, still: true }, { ...obj([{ name: 'created with', value: '"Ana"' }, { name: 'then', value: 'Rename("Bea")' }]), still: true }], line: L.PRINT },
})

// ---- The real object: a hidden field for the captured parameter, and Name's own backing field ----
type K = Field['kind']
const hidden = (v: string, kind?: K): Field => ({ name: 'name (captured)', value: v, kind })
const backing = (v: string, kind?: K): Field => ({ name: 'Name (backing)', value: v, kind })
const REAL_END = [P, obj([hidden('"Bea"', 'ok'), backing('"Ana"', 'ok')])]

const SPECS: Record<string, GraphSpec> = {
  storage: graph({
    capture: { boxes: [P, obj([hidden('"Ana"', 'inline')])], line: { each: [L.CLASS, L.GREETING, L.RENAME_DEF] } },
    init: { boxes: [P, obj([hidden('"Ana"', 'inline'), backing('"Ana"', 'inline')])], line: L.NAME },
    rename: { boxes: [P, obj([hidden('"Bea"', 'bad'), backing('"Ana"', 'inline')])], line: { each: [L.RENAME, L.RENAME_DEF] } },
    print: { boxes: REAL_END, line: { each: [L.PRINT, L.NAME, L.GREETING] }, output: out('Ana Hi Bea', 'ok') },
    warn: {
      boxes: REAL_END,
      line: L.NAME,
      output: [...out('Ana Hi Bea', 'ok'), { label: 'build', text: 'warning CS9124: double storage', kind: 'bad' }],
    },
  }),

  'reads-claim': graph({
    reads: { boxes: [P, obj([{ name: 'name', value: '"Ana"' }, { name: 'Name', value: 'reads name' }])], line: L.NAME },
    output: { boxes: [P, obj([{ name: 'name', value: '"Bea"' }, { name: 'Name', value: 'reads name' }])], line: L.PRINT, output: out('Bea Hi Bea') },
  }),
  'reads-reality': graph({
    copy: { boxes: [P, obj([hidden('"Ana"', 'inline'), backing('"Ana"', 'ok')])], line: L.NAME },
    output: { boxes: [P, obj([hidden('"Bea"', 'inline'), backing('"Ana"', 'ok')])], line: L.PRINT, output: out('Ana Hi Bea', 'ok') },
  }),

  'fixed-claim': graph({
    fixed: { boxes: [P, obj([{ name: 'name', value: '"Ana"' }, { name: 'after Rename', value: '"Ana"' }])], line: L.RENAME_DEF },
    output: { boxes: [P, obj([{ name: 'name', value: '"Ana"' }, { name: 'after Rename', value: '"Ana"' }])], line: L.PRINT, output: out('Ana Hi Ana') },
  }),
  'fixed-reality': graph({
    mutable: { boxes: [P, obj([hidden('"Bea"', 'ok'), backing('"Ana"', 'inline')])], line: { each: [L.RENAME, L.RENAME_DEF] } },
    output: { boxes: [P, obj([hidden('"Bea"', 'ok'), backing('"Ana"', 'inline')])], line: { each: [L.PRINT, L.GREETING] }, output: out('Ana Hi Bea', 'ok') },
  }),

  'swap-claim': graph({
    swap: { boxes: [P, obj([{ name: 'Name', value: 'follows rename' }, { name: 'Greeting', value: 'keeps "Ana"' }])], line: [L.NAME, L.GREETING] },
    output: { boxes: [P, obj([{ name: 'Name', value: 'follows rename' }, { name: 'Greeting', value: 'keeps "Ana"' }])], line: L.PRINT, output: out('Bea Hi Ana') },
  }),
  'swap-reality': graph({
    swap: {
      boxes: [P, obj([hidden('"Ana"', 'inline'), backing('"Ana"', 'inline'), { name: 'Name reads', value: 'backing', kind: 'ok' }, { name: 'Greeting reads', value: 'captured', kind: 'ok' }])],
      line: [L.NAME, L.GREETING],
    },
    output: {
      boxes: [P, obj([hidden('"Bea"', 'ok'), backing('"Ana"', 'ok'), { name: 'Name reads', value: 'backing', kind: 'ok' }, { name: 'Greeting reads', value: 'captured', kind: 'ok' }])],
      line: L.PRINT,
      output: out('Ana Hi Bea', 'ok'),
    },
  }),
}

const drawing: QuestionDrawing = {
  setup: (p: StageDrawingProps) => <BoxGraph spec={SETUP} {...p} />,
  ...Object.fromEntries(Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />])),
}
export default drawing
