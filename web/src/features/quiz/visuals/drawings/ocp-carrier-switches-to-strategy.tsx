import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const BEHAVIOURS = [
  ['cost', 'Cost'],
  ['label', 'Label'],
  ['track', 'Track'],
  ['pickup', 'Pickup'],
  ['customs', 'Customs'],
  ['returns', 'Returns'],
] as const
type B = (typeof BEHAVIOURS)[number][0]

const switchRows = (sub: Partial<Record<B, string>> = {}): RowDef[] => BEHAVIOURS.map(([id, name]) => ({ id, name, sub: sub[id] ?? 'switch', tone: 'pool' }))
const BUILD: RowDef = { id: 'build', name: 'Build', tone: 'io' }

const c = (key: string, label: string, kind?: Chip['kind']): Chip => ({ key, label, kind })
const DHL = c('dhl', 'DHL')
const UPS = c('ups', 'UPS')
const POST = c('post', 'Post')
const NO_POST = c('post', 'no Post', 'dead')

/** Every switch row gets the same chips, with optional per-row overrides. */
const each = (chips: Chip[], over: Partial<Record<B, Chip[]>> = {}): RowStep['rows'] =>
  Object.fromEntries(BEHAVIOURS.map(([id]) => [id, over[id] ?? chips]))

const STRATEGY_CODE = [
  'interface ICarrier',
  '{',
  '    decimal Cost(Order o);',
  '    Label Label(Order o);',
  '    // … plus tracking, pickup, customs, returns',
  '}',
  'class DhlCarrier : ICarrier { … }',
  'class PostCarrier : ICarrier { … }',
  '',
  'ICarrier carrier = carriers.For(order.Carrier);',
  'var label = carrier.Label(order);',
]
const members = (kind?: Chip['kind'], over: Partial<Record<B, Chip>> = {}): Chip[] => BEHAVIOURS.map(([id, name]) => over[id] ?? c(id, name, kind))

const SPECS: Record<string, RowSpec> = {
  setup: {
    rows: switchRows(),
    steps: {
      six: { rows: each([DHL, UPS]) },
      added: { rows: each([DHL, UPS, POST], { label: [DHL, UPS, NO_POST] }) },
    },
  },

  strategy: {
    rows: [
      { id: 'iface', name: 'ICarrier', sub: 'interface', tone: 'ui' },
      { id: 'dhl', name: 'DhlCarrier', tone: 'pool' },
      { id: 'ups', name: 'UpsCarrier', tone: 'pool' },
      { id: 'post', name: 'PostCarrier', sub: 'new', tone: 'pool' },
      { id: 'pick', name: 'Choose', sub: 'once', tone: 'io' },
    ],
    code: STRATEGY_CODE,
    steps: {
      iface: { rows: { iface: members() }, line: [0, 5] },
      classes: { rows: { iface: members(), dhl: members(), ups: members() }, line: 6 },
      missed: {
        rows: { iface: members(), dhl: members(), ups: members(), post: [...members(undefined, { label: c('label', 'no Label', 'dead') }), c('err', 'CS0535', 'bad')] },
        line: 7,
        bad: true,
      },
      complete: { rows: { iface: members(), dhl: members(), ups: members(), post: members(undefined, { label: c('label', 'Label', 'ok') }) }, line: 7 },
      choose: {
        rows: { iface: members(), dhl: members(), ups: members(), post: members(), pick: [c('for', 'For(order)', 'run'), c('got', 'PostCarrier', 'ok')] },
        line: [9, 10],
      },
    },
  },

  'throw-claim': {
    rows: switchRows(),
    steps: {
      add: { rows: each([DHL, UPS, c('def', 'default: throw', 'run')]) },
      missed: { rows: each([DHL, UPS, POST, c('def', 'default: throw', 'run')], { label: [DHL, UPS, c('def', 'Post: throws', 'run')] }) },
    },
  },
  'throw-reality': {
    rows: [...switchRows(), BUILD],
    steps: {
      missed: {
        rows: { ...each([DHL, UPS, POST, c('def', 'default: throw', 'run')], { label: [DHL, UPS, c('def', 'throws at run time', 'bad')] }), build: [c('b', 'build OK')] },
      },
      next: { rows: { ...each([DHL, UPS, POST, c('def', 'default: throw', 'run'), c('next', 'edit', 'wait')]), build: [c('b', 'build OK')] } },
    },
  },

  'rules-claim': {
    rows: switchRows(),
    steps: {
      spread: {
        rows: each([], {
          cost: [c('loc', 'Pricing', 'gone'), DHL, UPS],
          label: [c('loc', 'Labels', 'gone'), DHL, UPS],
          track: [c('loc', 'Tracker', 'gone'), DHL, UPS],
          pickup: [c('loc', 'Pickups', 'gone'), DHL, UPS],
          customs: [c('loc', 'Customs', 'gone'), DHL, UPS],
          returns: [c('loc', 'Returns', 'gone'), DHL, UPS],
        }),
      },
      group: { rows: each([c('loc', 'CarrierRules', 'run'), DHL, UPS]) },
    },
  },
  'rules-reality': {
    rows: [...switchRows(), BUILD],
    steps: {
      edit: { rows: each([c('loc', 'CarrierRules', 'run'), DHL, UPS, c('next', 'edit', 'wait')]) },
      missed: {
        rows: { ...each([c('loc', 'CarrierRules', 'run'), DHL, UPS, POST], { label: [c('loc', 'CarrierRules', 'run'), DHL, UPS, NO_POST] }), build: [c('b', 'build OK')] },
      },
    },
  },

  'dict-claim': {
    rows: switchRows({ cost: 'lookup' }),
    steps: {
      dict: { rows: each([c('dhl', 'DHL', 'gone'), c('ups', 'UPS', 'gone')], { cost: [c('dict', 'Dictionary', 'run'), DHL, UPS] }) },
      often: { rows: each([c('dhl', 'DHL', 'gone'), c('ups', 'UPS', 'gone')], { cost: [c('dict', 'Dictionary', 'run'), DHL, UPS, c('often', 'changes often', 'run')] }) },
    },
  },
  'dict-reality': {
    rows: [...switchRows({ cost: 'lookup' }), BUILD],
    steps: {
      others: { rows: each([DHL, UPS], { cost: [c('dict', 'Dictionary', 'run'), DHL, UPS] }) },
      missed: {
        rows: { ...each([DHL, UPS, POST], { cost: [c('dict', 'Dictionary', 'run'), DHL, UPS, POST], label: [DHL, UPS, NO_POST] }), build: [c('b', 'build OK')] },
      },
    },
  },
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
