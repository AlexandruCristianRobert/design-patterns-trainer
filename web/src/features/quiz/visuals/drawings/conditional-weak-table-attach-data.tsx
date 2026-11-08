import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const APP: Region = { id: 'app', name: 'App', tone: 'ui' }
const LIB: Region = { id: 'lib', name: 'Library', tone: 'pool' }
const OBJS: Region = { id: 'obj', name: 'Objects', tone: 'io' }
const REGIONS = [APP, LIB, OBJS]

const spec = (steps: Record<string, GraphStep>): GraphSpec => ({ regions: REGIONS, steps })

// ---- The app's variable and the two objects ----
const holds = (kind?: Field['kind']): Box => ({ id: 'var', region: 'app', title: 'widget', sub: 'variable', fields: [{ name: 'ref', ref: 'w', value: 'Widget', kind }] })
const dropped: Box = { id: 'var', region: 'app', title: 'widget', sub: 'variable', fields: [{ name: 'ref', value: 'null', kind: 'muted' }] }
const widget = (kind?: Box['kind'], sub = 'not the library\'s'): Box => ({ id: 'w', region: 'obj', title: 'Widget', sub, kind })
const state = (kind?: Box['kind'], owner = false): Box => ({
  id: 'st',
  region: 'obj',
  title: 'State',
  sub: 'attached',
  kind,
  fields: owner ? [{ name: 'owner', ref: 'w', value: 'Widget' }] : [],
})
const still = (boxes: Box[]) => boxes.map((b) => ({ ...b, still: true }))

// ---- Setup: the library's table, type unknown ----
const someTable: Box = { id: 'table', region: 'lib', title: 'table', sub: 'type ?', fields: [{ name: 'Widget → State', value: '?', kind: 'muted' }] }

// ---- ConditionalWeakTable ----
const cwt = (fields: Field[]): Box => ({ id: 'table', region: 'lib', title: 'table', sub: 'ConditionalWeakTable', fields })
const CWT_ENTRY: Field[] = [
  { name: 'key (weak)', ref: 'w', value: 'Widget' },
  { name: 'value (via key)', ref: 'st', value: 'State' },
]
const ADDED = [holds(), cwt(CWT_ENTRY), widget(), state()]
const BACK = [holds(), cwt(CWT_ENTRY), widget(), state(undefined, true)]
const DROPPED = [dropped, cwt(CWT_ENTRY), widget(), state(undefined, true)]
const COLLECTED = [dropped, cwt([{ name: 'entry', value: 'gone', kind: 'ok' }]), widget('gone'), state('gone')]

// ---- Dictionary<WeakReference<Widget>, State> ----
const weakKeyTable = (fields: Field[], kind?: Box['kind']): Box => ({ id: 'table', region: 'lib', title: 'table', sub: 'Dictionary<WeakReference<Widget>, State>', fields, kind })
const wkEntry = (valueKind?: Field['kind']): Field[] => [
  { name: 'key', ref: 'wr', value: 'WeakRef' },
  { name: 'value', ref: 'st', value: 'State', kind: valueKind },
]
const wr = (target: Field): Box => ({ id: 'wr', region: 'lib', title: 'WeakReference', sub: 'the key', fields: [target] })
const wrTo = (kind?: Field['kind']) => wr({ name: 'target (weak)', ref: 'w', value: 'Widget', kind })
const WK_ADDED = [holds(), weakKeyTable(wkEntry()), wrTo(), widget(), state()]
const WK_CLAIM_DROP = [dropped, weakKeyTable(wkEntry()), wrTo(), widget('gone', 'not kept alive'), state()]
const WK_STRONG = [dropped, weakKeyTable(wkEntry('bad')), wrTo(), widget('bad', 'still alive'), state('bad', true)]
const WK_DEAD = [
  dropped,
  weakKeyTable([...wkEntry('bad'), { name: 'entry', value: 'stays', kind: 'bad' }]),
  wr({ name: 'target', value: 'dead', kind: 'muted' }),
  widget('gone', 'collected'),
  state('bad'),
]
const newWr: Box = { id: 'wr2', region: 'lib', title: 'new WeakReference', sub: 'for the lookup', fields: [{ name: 'target (weak)', ref: 'w', value: 'Widget' }] }
const WK_LOOKUP = [
  holds(),
  weakKeyTable([...wkEntry(), { name: 'find(new wrapper)', value: 'not found', kind: 'bad' }]),
  { ...wrTo(), still: true },
  newWr,
  { ...widget(), still: true },
  { ...state(), still: true },
]

// ---- ConcurrentDictionary<Widget, State> ----
const concTable = (keyName: string, kind?: Field['kind']): Box => ({
  id: 'table',
  region: 'lib',
  title: 'table',
  sub: 'ConcurrentDictionary<Widget, State>',
  fields: [
    { name: keyName, ref: 'w', value: 'Widget', kind },
    { name: 'value', ref: 'st', value: 'State', kind },
  ],
})

// ---- Dictionary<Widget, WeakReference<State>> ----
const weakValueTable = (keyName: string, keyKind?: Field['kind'], extra: Field[] = []): Box => ({
  id: 'table',
  region: 'lib',
  title: 'table',
  sub: 'Dictionary<Widget, WeakReference<State>>',
  fields: [{ name: keyName, ref: 'w', value: 'Widget', kind: keyKind }, { name: 'value', ref: 'wr', value: 'WeakRef' }, ...extra],
})
const wrState = (alive: boolean): Box => ({
  id: 'wr',
  region: 'lib',
  title: 'WeakReference',
  sub: 'the value',
  fields: [alive ? { name: 'target (weak)', ref: 'st', value: 'State' } : { name: 'target', value: 'dead', kind: 'bad' }],
})

const SPECS: Record<string, GraphSpec> = {
  setup: spec({
    object: { boxes: [holds(), widget()] },
    attach: { boxes: [...still([holds(), widget()]), someTable, state()] },
    goal: { boxes: [dropped, { ...someTable, still: true }, widget(undefined, 'should be collectable'), { ...state(), still: true }] },
  }),

  cwt: spec({
    add: { boxes: ADDED },
    'back-ref': { boxes: BACK },
    drop: { boxes: DROPPED },
    collect: { boxes: COLLECTED },
    lookup: { boxes: [holds(), cwt([...CWT_ENTRY, { name: 'compares', value: 'by reference', kind: 'ok' }]), widget(), state()] },
  }),

  'weakkey-claim': spec({
    add: { boxes: WK_ADDED },
    drop: { boxes: WK_CLAIM_DROP },
  }),
  'weakkey-reality': spec({
    lookup: { boxes: WK_LOOKUP },
    'strong-value': { boxes: WK_STRONG },
    dead: { boxes: WK_DEAD },
  }),

  'concurrent-claim': spec({
    add: { boxes: [holds(), concTable('key'), widget(), state()] },
    drop: { boxes: [dropped, concTable('key'), widget('gone', 'not kept alive'), state()] },
  }),
  'concurrent-reality': spec({
    strong: { boxes: [holds(), concTable('key (strong)'), widget(), state()] },
    leak: { boxes: [dropped, concTable('key (strong)', 'bad'), widget('bad', 'never collected'), state('bad')] },
  }),

  'weakvalue-claim': spec({
    add: { boxes: [holds(), weakValueTable('key'), wrState(true), widget(), state()] },
    drop: { boxes: [dropped, weakValueTable('key'), wrState(true), widget('gone', 'not kept alive'), state()] },
  }),
  'weakvalue-reality': spec({
    'strong-key': { boxes: [holds(), weakValueTable('key (strong)', 'bad'), wrState(true), widget(), state()] },
    'lost-state': { boxes: [holds(), weakValueTable('key (strong)'), wrState(false), widget(), state('gone')] },
    leak: { boxes: [dropped, weakValueTable('key (strong)', 'bad'), wrState(false), widget('bad', 'never collected'), state('gone')] },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
