import type { CSSProperties } from 'react'
import { OutputStrip, type OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

/** One array (or one segment): its slots, how many hold an item, and which of those arrived this step. */
interface Block {
  cap: number
  filled: number
  /** The first `copied` items were copied in from the previous array this step. */
  copied?: number
  /** The last `added` items were stored by this step's Add. */
  added?: number
}
interface ArrRow {
  key: string
  name: string
  sub: string
  blocks: Block[]
  /** live: in use · garbage: dropped, faded · bad: the claim's failure. */
  state?: 'live' | 'garbage' | 'bad'
  /** Drawn with the accent ring: the array this step created or dropped. */
  now?: boolean
}
interface ArrStep {
  count: string
  capacity: string
  /** A pending Add whose result the step leaves open. */
  pending?: string
  rows: ArrRow[]
  output?: OutLine[]
}

/** The widest array drawn; every slot has the same width, so a doubled array is visibly twice as long. */
const COLS = 16

function ArrayStage({ steps, stepIds, stepIndex, reduced }: { steps: Record<string, ArrStep> } & StageDrawingProps) {
  for (const id of stepIds) if (!steps[id]) throw new Error(`no drawing for step "${id}"`)
  const step = steps[stepIds[stepIndex]]
  const prev = stepIndex > 0 ? steps[stepIds[stepIndex - 1]] : undefined
  const changed = (k: 'count' | 'capacity') => !!prev && prev[k] !== step[k]
  // The key names only the slot kinds this stage uses (a Setup never shows copying).
  const blocks = Object.values(steps).flatMap((s) => s.rows.flatMap((r) => r.blocks))
  const has = { copied: blocks.some((b) => b.copied), added: blocks.some((b) => b.added) }
  return (
    <div className={`qv-arr-stage${reduced ? ' is-reduced' : ''}`}>
      <div className="qv-arr-list tone-pool">
        <span className="qv-arr-title">List&lt;Order&gt;</span>
        <span className={`qv-chip is-run${changed('count') ? ' is-now' : ''}`}>Count {step.count}</span>
        <span className={`qv-chip is-run${changed('capacity') ? ' is-now' : ''}`}>Capacity {step.capacity}</span>
        {step.pending && <span className="qv-chip is-wait is-now">{step.pending}</span>}
      </div>
      {step.rows.length > 0 && (
        <div className="qv-arr-rows" style={{ '--qv-cols': COLS } as CSSProperties}>
          {step.rows.map((row) => (
            <div key={row.key} className={`qv-arr-row is-${row.state ?? 'live'}`}>
              <div className="qv-arr-name">
                {row.name}
                <small>{row.sub}</small>
              </div>
              <div className="qv-arr-track">
                {row.blocks.map((b, bi) => (
                  <div key={bi} className={`qv-arr${row.now ? ' is-now' : ''}`} style={{ gridColumn: `span ${b.cap}`, '--qv-cap': b.cap } as CSSProperties}>
                    {Array.from({ length: b.cap }, (_, i) => {
                      const full = i < b.filled
                      const copied = full && i < (b.copied ?? 0)
                      const added = full && i >= b.filled - (b.added ?? 0)
                      return <span key={i} className={`qv-arr-cell${full ? ' is-full' : ''}${copied ? ' is-copied' : ''}${added ? ' is-added' : ''}`} />
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {step.output && <OutputStrip lines={step.output} prev={prev?.output} first={!prev} />}
      {(has.copied || has.added) && (
        <div className="qv-arr-key" aria-hidden>
          <span><i className="qv-arr-cell is-full" /> item</span>
          {has.copied && <span><i className="qv-arr-cell is-full is-copied" /> copied</span>}
          {has.added && <span><i className="qv-arr-cell is-full is-added" /> just added</span>}
        </div>
      )}
    </div>
  )
}

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
  Object.entries(STEPS).map(([stage, steps]) => [stage, (p: StageDrawingProps) => <ArrayStage steps={steps} {...p} />]),
)
export default drawing
