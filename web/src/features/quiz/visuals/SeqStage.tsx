import type { CSSProperties } from 'react'
import { OutputStrip, type OutLine } from './BoxGraph'
import { CodePanel, type LineAt } from './CodePanel'
import type { StageDrawingProps } from './drawing'
import type { Tone } from './RowStage'

export interface SeqActor {
  id: string
  name: string
  sub?: string
  tone: Tone
}
/** plain · ok/bad: the point the step makes · muted: a summary row · skip: something that never happens (dashed). */
export type SeqKind = 'plain' | 'ok' | 'bad' | 'muted' | 'skip'
export interface SeqRow {
  /** Identity across steps: a row that is new or changed since the previous step is marked as current. */
  key: string
  from: string
  /** The receiving actor; without it the row is a note on `from`'s lifeline. */
  to?: string
  label: string
  kind?: SeqKind
  /** A round trip: arrowheads at both ends. */
  both?: boolean
}
export interface SeqStep {
  rows: SeqRow[]
  line?: LineAt
  /** The highlighted code line marks a failure. */
  bad?: boolean
  output?: OutLine[]
}
export interface SeqSpec {
  actors: SeqActor[]
  code?: string[]
  /** Heading of the output strip, e.g. "Log". */
  outputName?: string
  steps: Record<string, SeqStep>
}

const same = (a: SeqRow, b: SeqRow) => a.from === b.from && a.to === b.to && a.label === b.label && (a.kind ?? 'plain') === (b.kind ?? 'plain')

/** A sequence diagram: actors as columns with lifelines, messages and notes as rows top to bottom; the step's new rows carry the accent. */
export function SeqStage({ spec, stepIds, stepIndex, reduced }: { spec: SeqSpec } & StageDrawingProps) {
  for (const id of stepIds) if (!spec.steps[id]) throw new Error(`no drawing for step "${id}"`)
  const col = new Map(spec.actors.map((a, i) => [a.id, i]))
  for (const [id, s] of Object.entries(spec.steps))
    for (const r of s.rows)
      for (const a of [r.from, r.to]) if (a !== undefined && !col.has(a)) throw new Error(`step "${id}": row "${r.key}" uses unknown actor "${a}"`)
  const step = spec.steps[stepIds[stepIndex]]
  const prev = stepIndex > 0 ? spec.steps[stepIds[stepIndex - 1]] : undefined
  const isNow = (r: SeqRow) => !prev || !prev.rows.some((p) => p.key === r.key && same(p, r))
  const n = spec.actors.length

  return (
    <div className={`qv-seq-stage${reduced ? ' is-reduced' : ''}`}>
      <div className="qv-seq" style={{ '--qv-actors': n } as CSSProperties}>
        <div className="qv-seq-head">
          {spec.actors.map((a) => (
            <div key={a.id} className={`qv-seq-actor tone-${a.tone}`}>
              {a.name}
              {a.sub && <small>{a.sub}</small>}
            </div>
          ))}
        </div>
        <div className="qv-seq-body">
          {spec.actors.map((a, i) => (
            <span key={a.id} className={`qv-seq-life tone-${a.tone}`} style={{ left: `calc(${i + 0.5} * 100% / ${n})` }} aria-hidden />
          ))}
          {step.rows.map((r) => {
            const from = col.get(r.from)!
            const cls = `qv-seq-row is-${r.kind ?? 'plain'}${isNow(r) ? ' is-now' : ''}`
            if (r.to === undefined || r.to === r.from) {
              return (
                <div key={r.key} className={cls}>
                  <div className="qv-seq-note" style={{ marginLeft: `calc(${from} * 100% / ${n} + 4px)`, width: `calc(100% / ${n} - 8px)` }}>
                    {r.label}
                  </div>
                </div>
              )
            }
            const to = col.get(r.to)!
            const [lo, hi] = from < to ? [from, to] : [to, from]
            const dir = r.both ? 'both' : from < to ? 'right' : 'left'
            return (
              <div key={r.key} className={cls}>
                <div className={`qv-seq-msg is-${dir}`} style={{ marginLeft: `calc(${lo + 0.5} * 100% / ${n})`, width: `calc(${hi - lo} * 100% / ${n})` }}>
                  <span className="qv-seq-label">{r.label}</span>
                  <span className="qv-seq-line" aria-hidden />
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {step.output && <OutputStrip name={spec.outputName} lines={step.output} prev={prev?.output} first={!prev} />}
      {spec.code && <CodePanel code={spec.code} line={step.line ?? null} bad={step.bad} />}
    </div>
  )
}
