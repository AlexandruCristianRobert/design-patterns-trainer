import { ArrayStage, type ArrRow, type ArrStep, type Block } from '../ArrayStage'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const live = (key: string, cap: number, filled: number, extra: Partial<Block> = {}, now = false, sub = 'in use'): ArrRow => ({
  key,
  name: `${cap} slots`,
  sub,
  blocks: [{ cap, filled, ...extra }],
  now,
})
const garbage = (key: string, cap: number): ArrRow => ({ key, name: `${cap} slots`, sub: 'garbage now', blocks: [{ cap, filled: cap }], state: 'garbage', now: true })

const S = {
  firstAdd: { count: '1', capacity: '4', rows: [live('a4', 4, 1, { added: 1 }, true)] },
  full: { count: '4', capacity: '4', rows: [live('a4', 4, 4, { added: 3 })] },
  grow8: { count: '5', capacity: '8', rows: [garbage('a4', 4), live('a8', 8, 5, { copied: 4, added: 1 }, true)] },
  grow16: { count: '9', capacity: '16', rows: [garbage('a8', 8), live('a16', 16, 9, { copied: 8, added: 1 }, true)] },
  million: {
    count: '1,000,000',
    capacity: '1,048,576',
    rows: [],
    output: [
      { label: 'Arrays', text: '4, 8, 16, 32, … 1,048,576 slots (19 arrays)' },
      { label: 'Copies', text: 'about 1 million in total', kind: 'ok' },
    ],
  },
} satisfies Record<string, ArrStep>

const STEPS: Record<string, Record<string, ArrStep>> = {
  setup: {
    'new-list': { count: '0', capacity: '?', rows: [] },
    'first-adds': { count: '4', capacity: '?', rows: [{ key: 'a', name: 'internal array', sub: 'full', blocks: [{ cap: 4, filled: 4 }], now: true }] },
    'next-add': { count: '4', capacity: '?', pending: 'Add(order) → ?', rows: [{ key: 'a', name: 'internal array', sub: 'full', blocks: [{ cap: 4, filled: 4 }] }] },
  },
  doubling: { 'first-add': S.firstAdd, full: S.full, 'grow-8': S.grow8, 'grow-16': S.grow16, million: S.million },

  'fixed-step-claim': {
    full: S.full,
    'grow-1': S.grow8,
    'grow-2': { count: '9', capacity: '12', rows: [garbage('a8', 8), live('a12', 12, 9, { copied: 8, added: 1 }, true)] },
    million: {
      count: '1,000,000',
      capacity: '1,000,000',
      rows: [],
      output: [
        { label: 'Arrays', text: '4, 8, 12, 16, … 1,000,000 slots (250,000 arrays)' },
        { label: 'Copies', text: 'about 125 billion: O(n²)', kind: 'bad' },
      ],
    },
  },
  'fixed-step-reality': { full: S.full, 'grow-1': S.grow8, 'grow-2': S.grow16, million: S.million },

  'segments-claim': {
    full: S.full,
    'add-5': { count: '5', capacity: '8', rows: [{ key: 'seg', name: '2 segments', sub: 'linked, not copied', blocks: [{ cap: 4, filled: 4 }, { cap: 4, filled: 1, added: 1 }], now: true }] },
    'add-9': {
      count: '9',
      capacity: '12',
      rows: [{ key: 'seg', name: '3 segments', sub: 'linked, not copied', blocks: [{ cap: 4, filled: 4 }, { cap: 4, filled: 4 }, { cap: 4, filled: 1, added: 1 }], now: true }],
    },
    million: {
      count: '1,000,000',
      capacity: '1,000,000',
      rows: [{ key: 'seg', name: '250,000 segments', sub: 'linked, not copied', blocks: [{ cap: 4, filled: 4 }, { cap: 4, filled: 4 }, { cap: 4, filled: 4 }, { cap: 4, filled: 4 }] }],
      output: [{ label: 'Copies', text: 'none' }],
    },
  },
  'segments-reality': {
    full: S.full,
    'add-5': S.grow8,
    'add-9': S.grow16,
    million: { ...S.million, output: [{ label: 'Layout', text: 'one contiguous array' }, ...S.million.output] },
  },

  'fixed-size-claim': {
    'first-add': { count: '1', capacity: '4', rows: [live('a4', 4, 1, { added: 1 }, true, 'default estimate')] },
    full: { count: '4', capacity: '4', rows: [live('a4', 4, 4, { added: 3 }, false, 'default estimate')] },
    'add-5': {
      count: '4',
      capacity: '4',
      rows: [{ ...live('a4', 4, 4, {}, true, 'never grows'), state: 'bad' }],
      output: [{ label: 'Add', text: 'throws: capacity exceeded', kind: 'bad' }],
    },
  },
  'fixed-size-reality': {
    'first-add': S.firstAdd,
    full: S.full,
    'add-5': { ...S.grow8, output: [{ label: 'Add', text: 'no exception, the list grew', kind: 'ok' }] },
  },
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(STEPS).map(([stage, steps]) => [stage, (p: StageDrawingProps) => <ArrayStage title="List<Order>" steps={steps} {...p} />]),
)
export default drawing
