import type { CSSProperties } from 'react'
import { OutputStrip, type OutLine } from './BoxGraph'
import type { StageDrawingProps } from './drawing'

type Kind = 'plain' | 'ok' | 'bad' | 'muted'
export interface Bar {
  /** Identity across steps: a bar that is new or changed since the previous step is marked as current. */
  key: string
  /** Centre of the bar on the time axis. */
  at: number
  value: number
  kind?: Kind
  /** Shown above the bar, e.g. its value. */
  label?: string
}
export interface Mark {
  key: string
  at: number
  label: string
  kind?: Kind
  /** 0: first line under the axis, 1: second line (for marks too close to fit on one line). */
  line?: 0 | 1
  /** true: hidden on narrow screens, where it would crowd its neighbours (the caption or status still carries it). */
  wideOnly?: boolean
}
export interface BarStep {
  bars: Bar[]
  marks?: Mark[]
  output?: OutLine[]
}
export interface BarSpec {
  /** The axis runs from 0 to span. */
  span: number
  /** Width of every bar, in axis units. */
  width: number
  /** The value drawn at full height. */
  max: number
  capacity?: { value: number; label: string }
  ticks: number[]
  axis: string
  /** false: only the time axis and its marks, no room for bars (a schedule rather than a load). */
  plot?: boolean
  outputName?: string
  steps: Record<string, BarStep>
}

const pct = (v: number) => `${(v * 100).toFixed(3)}%`

/** Load over time: bars on a time axis (with an optional capacity line), marks under the axis, an output strip. */
export function BarStage({ spec, stepIds, stepIndex, reduced }: { spec: BarSpec } & StageDrawingProps) {
  for (const id of stepIds) if (!spec.steps[id]) throw new Error(`no drawing for step "${id}"`)
  if (spec.plot === false && Object.values(spec.steps).some((s) => s.bars.length)) throw new Error('a chart without a plot cannot draw bars')
  for (const [id, s] of Object.entries(spec.steps))
    for (const t of [...s.bars, ...(s.marks ?? [])]) if (t.at < 0 || t.at > spec.span) throw new Error(`step "${id}": "${t.key}" is off the axis`)
  const step = spec.steps[stepIds[stepIndex]]
  const prev = stepIndex > 0 ? spec.steps[stepIds[stepIndex - 1]] : undefined
  const barNow = (b: Bar) => !!prev && !prev.bars.some((p) => p.key === b.key && p.at === b.at && p.value === b.value && p.kind === b.kind && p.label === b.label)
  const markNow = (m: Mark) => !!prev && !(prev.marks ?? []).some((p) => p.key === m.key && p.at === m.at && p.label === m.label && p.kind === m.kind)
  const x = (at: number) => pct(at / spec.span)
  /** Marks are centred on their time, except near the ends, where they lean inwards so they stay inside the chart. */
  const lean = (at: number) => {
    const f = at / spec.span
    return f < 0.12 ? (f / 0.12) * 50 : f > 0.88 ? 50 + ((f - 0.88) / 0.12) * 50 : 50
  }
  const lines = (step.marks ?? []).some((m) => m.line === 1) ? 2 : 1
  // A value label too close to the previous one (on a phone) is raised a line, so neighbouring labels never run together.
  const raised = new Set<string>()
  let last: Bar | undefined
  for (const b of [...step.bars].filter((b) => b.label).sort((p, q) => p.at - q.at)) {
    if (last && !raised.has(last.key) && (b.at - last.at) / spec.span < 0.2) raised.add(b.key)
    last = b
  }

  return (
    <div className={`qv-bar-stage${reduced ? ' is-reduced' : ''}`}>
      <div className={`qv-bar-chart${spec.plot === false ? ' is-flat' : ''}`}>
        <div className={`qv-bar-plot${spec.plot === false ? ' is-flat' : ''}`}>
          {spec.capacity && (
            <div className="qv-bar-cap" style={{ bottom: pct(spec.capacity.value / spec.max) }} aria-hidden />
          )}
          {step.bars.map((b) => (
            <div
              key={b.key}
              className={`qv-bar is-${b.kind ?? 'plain'}${barNow(b) ? ' is-now' : ''}`}
              style={{ left: pct((b.at - spec.width / 2) / spec.span), width: pct(spec.width / spec.span), height: pct(Math.min(1, b.value / spec.max)) }}
            >
              {b.label && <span className={`qv-bar-label${raised.has(b.key) ? ' is-raised' : ''}`}>{b.label}</span>}
            </div>
          ))}
        </div>
        <div className="qv-bar-ticks" aria-hidden>
          {spec.ticks.map((t) => (
            <span key={t} style={{ left: x(t) }}>
              {t}
            </span>
          ))}
        </div>
        <div className="qv-bar-marks" style={{ '--qv-mark-lines': lines } as CSSProperties}>
          {(step.marks ?? []).map((m) => (
            <span key={m.key} className={`qv-mark is-${m.kind ?? 'plain'}${markNow(m) ? ' is-now' : ''}${m.wideOnly ? ' is-wide-only' : ''}`} style={{ left: x(m.at), top: `calc(${m.line ?? 0} * 24px)`, transform: `translateX(-${lean(m.at).toFixed(1)}%)` }}>
              {m.label}
            </span>
          ))}
        </div>
        <div className="qv-bar-axis">
          {spec.axis}
          {spec.capacity && <span className="qv-bar-key">{spec.capacity.label}</span>}
        </div>
      </div>
      {step.output && <OutputStrip name={spec.outputName} lines={step.output} prev={prev?.output} first={!prev} />}
    </div>
  )
}
