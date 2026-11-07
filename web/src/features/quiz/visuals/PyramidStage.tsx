import type { CSSProperties } from 'react'
import { OutputStrip, type OutLine } from './BoxGraph'
import type { StageDrawingProps } from './drawing'

export interface PyrLayer {
  id: string
  name: string
  sub?: string
  /** Width of the layer's band, 0..1 of the band column: narrow at the top, wide at the base. */
  width: number
}
export interface PyrColumn {
  id: string
  name: string
}
/** ok/bad: the point the step makes · muted: unknown or beside the point. */
export interface PyrCell {
  text: string
  kind?: 'plain' | 'ok' | 'bad' | 'muted'
  /** Draws a bar under the text, 0..1 of the cell's width (e.g. time per test on a shared scale). */
  bar?: number
}
export interface PyrStep {
  /** Per layer, per column: what the cell shows. A column is drawn only when the step has a cell in it. */
  cells: Partial<Record<string, Partial<Record<string, PyrCell>>>>
  output?: OutLine[]
}
export interface PyrSpec {
  layers: PyrLayer[]
  columns: PyrColumn[]
  outputName?: string
  steps: Record<string, PyrStep>
}

const same = (a?: PyrCell, b?: PyrCell) => !!a && !!b && a.text === b.text && (a.kind ?? 'plain') === (b.kind ?? 'plain') && a.bar === b.bar

/** A pyramid of layers (top to bottom) with a table of cells beside it; a cell that is new or changed since the previous step is marked. */
export function PyramidStage({ spec, stepIds, stepIndex, reduced }: { spec: PyrSpec } & StageDrawingProps) {
  for (const id of stepIds) if (!spec.steps[id]) throw new Error(`no drawing for step "${id}"`)
  const layerIds = new Set(spec.layers.map((l) => l.id))
  const colIds = new Set(spec.columns.map((c) => c.id))
  for (const [id, s] of Object.entries(spec.steps))
    for (const [layer, cells] of Object.entries(s.cells)) {
      if (!layerIds.has(layer)) throw new Error(`step "${id}" uses unknown layer "${layer}"`)
      for (const col of Object.keys(cells ?? {})) if (!colIds.has(col)) throw new Error(`step "${id}" uses unknown column "${col}"`)
    }
  const step = spec.steps[stepIds[stepIndex]]
  const prev = stepIndex > 0 ? spec.steps[stepIds[stepIndex - 1]] : undefined
  const cols = spec.columns.filter((c) => spec.layers.some((l) => step.cells[l.id]?.[c.id]))

  return (
    <div className={`qv-pyr-stage${reduced ? ' is-reduced' : ''}`}>
      <div className="qv-pyr" style={{ '--qv-pyr-cols': cols.length } as CSSProperties}>
        <div className="qv-pyr-row qv-pyr-head" aria-hidden={cols.length === 0 || undefined}>
          <span />
          {cols.map((c) => (
            <span key={c.id} className="qv-pyr-colname">{c.name}</span>
          ))}
        </div>
        {spec.layers.map((l) => (
          <div key={l.id} className="qv-pyr-row">
            <div className="qv-pyr-band-wrap">
              <div className="qv-pyr-band" style={{ width: `${Math.round(l.width * 100)}%` }}>
                {l.name}
                {l.sub && <small>{l.sub}</small>}
              </div>
            </div>
            {cols.map((c) => {
              const cell = step.cells[l.id]?.[c.id]
              if (!cell) return <span key={c.id} className="qv-pyr-cell is-empty" />
              const now = !!prev && !same(prev.cells[l.id]?.[c.id], cell)
              return (
                <span key={c.id} className={`qv-pyr-cell is-${cell.kind ?? 'plain'}${now ? ' is-now' : ''}`}>
                  <span className="qv-pyr-cell-name">{c.name}</span>
                  <span className="qv-pyr-cell-text">{cell.text}</span>
                  {cell.bar !== undefined && (
                    <span className="qv-pyr-bar" aria-hidden>
                      <span style={{ width: `${Math.max(2, Math.round(cell.bar * 100))}%` }} />
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        ))}
      </div>
      {step.output && <OutputStrip name={spec.outputName} lines={step.output} prev={prev?.output} first={!prev} />}
    </div>
  )
}
