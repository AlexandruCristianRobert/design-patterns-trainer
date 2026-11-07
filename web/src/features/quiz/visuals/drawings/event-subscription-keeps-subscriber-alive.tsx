import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'public static class AppEvents',
  '{',
  '    public static event EventHandler? SettingsChanged;',
  '}',
  '',
  'class SettingsViewModel',
  '{',
  '    public SettingsViewModel() =>',
  '        AppEvents.SettingsChanged += OnSettingsChanged;',
  '    void OnSettingsChanged(object? s, EventArgs e) { … }',
  '}',
]
const L = { EVENT: 2, SUB: [7, 8] as [number, number] }
const FIX_CODE = [
  ...CODE.slice(0, 10),
  '    public void Dispose() =>',
  '        AppEvents.SettingsChanged -= OnSettingsChanged;',
  '}',
]
const FIX = [10, 11] as [number, number]

const staticsRegion = (sub?: string): Region => ({ id: 'statics', name: 'Static fields', sub, tone: 'ui' })
const HEAP: Region = { id: 'heap', name: 'Heap', sub: 'delegates', tone: 'pool' }
const VMS: Region = { id: 'vms', name: 'View models', sub: 'on the heap', tone: 'io' }
const NEUTRAL: Region[] = [staticsRegion(), VMS]
const ROOTED: Region[] = [staticsRegion('reachable from a GC root'), HEAP, VMS]
const TRACED: Region[] = [staticsRegion('reachable from a GC root'), { ...HEAP, sub: 'objects' }, VMS]

type View = 'open' | 'closed'
const vm = (n: number, view: View, extra: Field[] = [], kind?: Box['kind']): Box => ({
  id: `vm${n}`,
  region: 'vms',
  title: `View model #${n}`,
  kind,
  fields: [{ name: 'view', value: view }, ...extra],
})
/** The event field: plain (nothing drawn behind it) or pointing at the delegates. */
const events = (value: Pick<Field, 'ref' | 'value' | 'kind'>): Box => ({ id: 'events', region: 'statics', title: 'AppEvents', fields: [{ name: 'SettingsChanged', ...value }] })
const PLAIN_EVENT = events({ value: 'event' })
/** The delegates the event holds; each Target points at its view model. */
const delegates = (ns: number[]): Box => ({
  id: 'list',
  region: 'heap',
  title: 'Delegates',
  sub: 'the invocation list',
  fields: ns.map((n) => ({ name: `#${n} Target`, ref: `vm${n}`, value: `VM #${n}` })),
})
const HELD = events({ ref: 'list', value: 'list' })
const vms = (ns: number[], view: View, kind?: Box['kind']) => ns.map((n) => vm(n, view, [], kind))
/** The event holding one delegate per view model, all views closed. */
const rooted = (ns: number[], kind?: Box['kind']): Box[] => [HELD, delegates(ns), ...vms(ns, 'closed', kind)]

const gc = (text: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'after a GC', text, kind: text === '?' ? 'muted' : kind }]
const ALL = [1, 2, 3]
const spec = (r: Region[], code: string[], steps: Record<string, GraphStep>): GraphSpec => ({ regions: r, code, outputName: 'Memory', steps })

/** The fix: #1 unsubscribed, nothing reaches it any more. */
const fixed: GraphStep = {
  boxes: [HELD, delegates([2, 3]), vm(1, 'closed', [], 'gone'), ...vms([2, 3], 'closed')],
  line: FIX,
  output: gc('view model #1 collected', 'ok'),
}

const SPECS: Record<string, GraphSpec> = {
  setup: spec(NEUTRAL, CODE, {
    open: { boxes: [PLAIN_EVENT, vm(1, 'open')], line: L.SUB },
    close: { boxes: [PLAIN_EVENT, vm(1, 'closed')], line: L.SUB },
    grow: { boxes: [PLAIN_EVENT, ...vms(ALL, 'closed')], line: L.SUB, output: [{ label: 'memory', text: 'grows with every view opened', kind: 'bad' }] },
  }),
  reachable: spec(ROOTED, FIX_CODE, {
    subscribe: { boxes: [HELD, delegates([1]), vm(1, 'open')], line: L.SUB },
    more: { boxes: rooted(ALL), line: L.SUB },
    gc: { boxes: rooted(ALL, 'bad'), line: L.EVENT, output: gc('every view model is reached, none collected', 'bad') },
    fix: fixed,
  }),

  'pinned-claim': spec(NEUTRAL, CODE, {
    pin: { boxes: [PLAIN_EVENT, ...ALL.map((n) => vm(n, 'closed', [{ name: 'handler', value: 'pinned', kind: 'bad' }]))], line: L.SUB },
    gc: {
      boxes: [PLAIN_EVENT, ...ALL.map((n) => vm(n, 'closed', [{ name: 'handler', value: 'pinned', kind: 'bad' }]))],
      line: L.SUB,
      output: gc('pinned, so none collected', 'bad'),
    },
  }),
  'pinned-reality': spec(ROOTED, FIX_CODE, {
    pin: { boxes: [HELD, { ...delegates(ALL), sub: 'not pinned' }, ...ALL.map((n) => vm(n, 'closed', [{ name: 'pinned', value: 'no', kind: 'ok' }]))], line: L.SUB },
    reach: { boxes: [HELD, { ...delegates(ALL), sub: 'not pinned' }, ...vms(ALL, 'closed', 'bad')], line: L.EVENT, output: gc('reachable, none collected', 'bad') },
    fix: fixed,
  }),

  'cycle-claim': spec(NEUTRAL, CODE, {
    cycle: {
      boxes: [
        { id: 'events', region: 'statics', title: 'AppEvents', sub: 'the publisher', fields: [{ name: 'SettingsChanged', ref: 'vm1', value: 'VM #1' }] },
        vm(1, 'closed', [{ name: 'publisher', ref: 'events', value: 'AppEvents' }]),
      ],
      line: L.SUB,
    },
    gc: {
      boxes: [
        { id: 'events', region: 'statics', title: 'AppEvents', sub: 'the publisher', fields: [{ name: 'SettingsChanged', ref: 'vm1', value: 'VM #1', kind: 'bad' }] },
        vm(1, 'closed', [{ name: 'publisher', ref: 'events', value: 'AppEvents', kind: 'bad' }], 'bad'),
      ],
      line: L.SUB,
      output: gc('a cycle, so none collected', 'bad'),
    },
  }),
  'cycle-reality': spec(TRACED, CODE, {
    trace: {
      boxes: [
        PLAIN_EVENT,
        { id: 'x', region: 'heap', title: 'Object X', sub: 'nothing else reaches it', kind: 'gone', fields: [{ name: 'other', ref: 'y', value: 'Y' }] },
        { id: 'y', region: 'heap', title: 'Object Y', sub: 'nothing else reaches it', kind: 'gone', fields: [{ name: 'other', ref: 'x', value: 'X' }] },
      ],
      line: null,
      output: gc('X and Y collected, cycle and all', 'ok'),
    },
    root: { boxes: rooted(ALL), line: L.EVENT, output: gc('?') },
    gc: { boxes: rooted(ALL, 'bad'), line: L.EVENT, output: gc('reachable, none collected', 'bad') },
  }),

  'finalizer-claim': spec(NEUTRAL, CODE, {
    subscribe: {
      boxes: [PLAIN_EVENT, ...ALL.map((n) => vm(n, 'closed', [{ name: 'finalizer', value: 'runs when raised' }]))],
      line: L.SUB,
    },
    silent: {
      boxes: [events({ value: 'never raised', kind: 'bad' }), ...ALL.map((n) => vm(n, 'closed', [{ name: 'finalizer', value: 'never runs', kind: 'bad' }]))],
      line: L.SUB,
      output: gc('nothing cleaned up', 'bad'),
    },
  }),
  'finalizer-reality': spec(ROOTED, FIX_CODE, {
    subscribe: { boxes: [HELD, { ...delegates(ALL), sub: 'no finalizer' }, ...vms(ALL, 'closed')], line: L.SUB },
    reach: { boxes: [HELD, { ...delegates(ALL), sub: 'no finalizer' }, ...vms(ALL, 'closed', 'bad')], line: L.EVENT, output: gc('reachable, none collected', 'bad') },
    fix: { ...fixed, boxes: [HELD, { ...delegates([2, 3]), sub: 'no finalizer' }, vm(1, 'closed', [], 'gone'), ...vms([2, 3], 'closed')] },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
