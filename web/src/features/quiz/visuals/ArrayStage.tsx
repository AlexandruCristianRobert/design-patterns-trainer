import type { CSSProperties } from 'react'
import { OutputStrip, type OutLine } from './BoxGraph'
import type { StageDrawingProps } from './drawing'

/** One array (or one segment): its slots, how many hold an item, and which of those arrived this step. */
export interface Block {
  cap: number
  filled: number
  /** The first `copied` items were copied in from the previous array this step. */
  copied?: number
  /** The last `added` items were stored by this step's Add. */
  added?: number
}
export interface ArrRow {
  key: string
  name: string
  sub: string
  blocks: Block[]
  /** live: in use · garbage: dropped, faded · bad: the claim's failure. */
  state?: 'live' | 'garbage' | 'bad'
  /** Drawn with the accent ring: the array this step created or dropped. */
  now?: boolean
}
export interface ArrStep {
  count: string
  capacity: string
  /** A pending Add whose result the step leaves open. */
  pending?: string
  rows: ArrRow[]
  output?: OutLine[]
}

/** The widest array drawn; every slot has the same width, so a doubled array is visibly twice as long. */
const COLS = 16

/** Arrays as rows of equal-width slots, under a header with the collection's Count and Capacity; copied and just-added slots are marked. */
export function ArrayStage({ title, steps, stepIds, stepIndex, reduced }: { title: string; steps: Record<string, ArrStep> } & StageDrawingProps) {
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
        <span className="qv-arr-title">{title}</span>
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
