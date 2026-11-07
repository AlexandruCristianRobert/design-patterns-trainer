import { useEffect, useRef } from 'react'
import type { StageDrawingProps } from './drawing'
import { CodePanel, type LineAt } from './CodePanel'

export type Tone = 'ui' | 'pool' | 'io' | 'muted' | 'bad' | 'ok'
/** item: a plain value · dead: unreachable or discarded · gone: freed, faded · run/ok/bad/wait: work on a thread. */
export type ChipKind = 'item' | 'dead' | 'gone' | 'run' | 'ok' | 'bad' | 'wait'
export interface Chip {
  /** Identity across steps (within its row): a chip that is new or changed since the previous step is marked as current. */
  key: string
  label: string
  kind?: ChipKind
}
export interface RowDef {
  id: string
  name: string
  sub?: string
  tone: Tone
  /** A fixed-size buffer: draws this many slots; chips beyond it are drawn as overflow slots. */
  slots?: number
  /** Labels under the first and last slot. */
  ends?: [string, string]
}
export interface RowStep {
  rows: Partial<Record<string, Chip[]>>
  line?: LineAt
  /** The highlighted code line marks a failure. */
  bad?: boolean
}
export interface RowSpec {
  rows: RowDef[]
  code?: string[]
  steps: Record<string, RowStep>
}

const same = (a: Chip, b: Chip) => a.label === b.label && (a.kind ?? 'item') === (b.kind ?? 'item')

/** Places as rows (buffers, queues, generations, threads), each holding chips; the step's new chips carry the accent ring. */
export function RowStage({ spec, stepIds, stepIndex, reduced }: { spec: RowSpec } & StageDrawingProps) {
  for (const id of stepIds) if (!spec.steps[id]) throw new Error(`no drawing for step "${id}"`)
  const known = new Set(spec.rows.map((r) => r.id))
  for (const [id, step] of Object.entries(spec.steps))
    for (const row of Object.keys(step.rows)) if (!known.has(row)) throw new Error(`step "${id}" uses unknown row "${row}"`)
  const step = spec.steps[stepIds[stepIndex]]
  const prev = stepIndex > 0 ? spec.steps[stepIds[stepIndex - 1]] : undefined
  const isNow = (row: string, c: Chip) => !prev || !(prev.rows[row] ?? []).some((p) => p.key === c.key && same(p, c))
  const rowsRef = useRef<HTMLDivElement>(null)
  // A buffer row that overflows a narrow stage scrolls sideways inside itself: keep the newest slot in view (never the page).
  useEffect(() => {
    rowsRef.current?.querySelectorAll<HTMLElement>('.qv-slots-wrap').forEach((el) => {
      if (el.scrollWidth > el.clientWidth) el.scrollLeft = el.scrollWidth
    })
  }, [stepIndex, stepIds.length])

  return (
    <div className={`qv-row-stage${reduced ? ' is-reduced' : ''}`}>
      <div className="qv-rows" ref={rowsRef}>
        {spec.rows.map((row) => {
          const chips = step.rows[row.id] ?? []
          const n = Math.max(row.slots ?? 0, chips.length)
          const chip = (c: Chip) => (
            <span key={c.key} className={`qv-chip is-${c.kind ?? 'item'}${isNow(row.id, c) ? ' is-now' : ''}`}>{c.label}</span>
          )
          return (
            <div key={row.id} className={`qv-row tone-${row.tone}`}>
              <div className="qv-row-name">
                {row.name}
                {row.sub && <small>{row.sub}</small>}
              </div>
              {row.slots ? (
                <div className="qv-slots-wrap">
                  <div className="qv-slots">
                    {Array.from({ length: n }, (_, i) => (
                      <span key={i} className={`qv-slot${i >= row.slots! ? ' is-over' : ''}`}>{chips[i] && chip(chips[i])}</span>
                    ))}
                  </div>
                  {row.ends && (
                    <div className="qv-slot-ends" style={{ width: `calc(${n} * var(--qv-slot) + ${n - 1} * var(--qv-slot-gap))` }}>
                      <span>{row.ends[0]}</span>
                      <span>{row.ends[1]}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="qv-row-track">{chips.map(chip)}</div>
              )}
            </div>
          )
        })}
      </div>
      {spec.code && <CodePanel code={spec.code} line={step.line ?? null} bad={step.bad} />}
    </div>
  )
}
