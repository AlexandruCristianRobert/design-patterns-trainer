import type { CSSProperties } from 'react'
import { OutputStrip, type OutLine } from './BoxGraph'
import { CodePanel, type LineAt } from './CodePanel'
import type { StageDrawingProps } from './drawing'
import type { ChipKind, Tone } from './RowStage'

/** plain · read: read by the step · hit: matched or returned · skip: read and thrown away · bad: the failure · new: just inserted · muted: beside the point. */
export type TRowKind = 'plain' | 'read' | 'hit' | 'skip' | 'bad' | 'new' | 'muted'
export interface TRow {
  /** Identity across steps (within its table): a row that is new or changed since the previous step is marked as current. */
  key: string
  cells: string[]
  kind?: TRowKind
  /** A short note beside the row (e.g. "seek starts here"). */
  mark?: string
  markKind?: 'plain' | 'ok' | 'bad' | 'muted'
}
export interface TableDef {
  id: string
  name: string
  sub?: string
  tone: Tone
  columns: string[]
}
export interface TChip {
  key: string
  label: string
  kind?: ChipKind
}
export interface TableStep {
  tables: Partial<Record<string, TRow[]>>
  /** Facts about the step (rows read, plan used…), drawn above the tables. */
  chips?: TChip[]
  line?: LineAt
  /** The highlighted code line marks a failure. */
  bad?: boolean
  output?: OutLine[]
  /** This step's code, when it differs from the stage's. */
  code?: string[]
}
export interface TableSpec {
  tables: TableDef[]
  code?: string[]
  outputName?: string
  steps: Record<string, TableStep>
}

const same = (a: TRow, b: TRow) =>
  a.cells.join('\u0000') === b.cells.join('\u0000') && (a.kind ?? 'plain') === (b.kind ?? 'plain') && a.mark === b.mark && a.markKind === b.markKind

/** Tables of rows (index entries, feed items, test inputs); a row that is new or changed since the previous step carries the accent ring. */
export function TableStage({ spec, stepIds, stepIndex, reduced }: { spec: TableSpec } & StageDrawingProps) {
  for (const id of stepIds) if (!spec.steps[id]) throw new Error(`no drawing for step "${id}"`)
  const defs = new Map(spec.tables.map((t) => [t.id, t]))
  for (const [id, s] of Object.entries(spec.steps))
    for (const [t, rows] of Object.entries(s.tables)) {
      const def = defs.get(t)
      if (!def) throw new Error(`step "${id}" uses unknown table "${t}"`)
      for (const r of rows ?? []) if (r.cells.length !== def.columns.length) throw new Error(`step "${id}": row "${r.key}" has ${r.cells.length} cells, table "${t}" has ${def.columns.length} columns`)
    }
  const step = spec.steps[stepIds[stepIndex]]
  const prev = stepIndex > 0 ? spec.steps[stepIds[stepIndex - 1]] : undefined
  // On a stage's first step only the rows that make a point are current; later, every new or changed row is.
  const rowNow = (t: string, r: TRow) => {
    if (r.kind === 'muted') return false
    if (!prev) return (r.kind ?? 'plain') !== 'plain'
    const p = prev.tables[t]?.find((x) => x.key === r.key)
    return !p || !same(p, r)
  }
  const chipNow = (c: TChip) => !prev || !(prev.chips ?? []).some((p) => p.key === c.key && p.label === c.label && p.kind === c.kind)
  const shown = spec.tables.filter((t) => step.tables[t.id])
  const code = step.code ?? spec.code

  return (
    <div className={`qv-tbl-stage${reduced ? ' is-reduced' : ''}`}>
      {step.chips && step.chips.length > 0 && (
        <div className="qv-tbl-chips">
          {step.chips.map((c) => (
            <span key={c.key} className={`qv-chip is-${c.kind ?? 'run'}${chipNow(c) ? ' is-now' : ''}`}>{c.label}</span>
          ))}
        </div>
      )}
      <div className="qv-tbls">
        {shown.map((t) => (
          <div key={t.id} className={`qv-tbl tone-${t.tone}`}>
            <div className="qv-tbl-name">
              {t.name}
              {t.sub && <small>{t.sub}</small>}
            </div>
            <div className="qv-tbl-grid" style={{ '--qv-tcols': t.columns.length } as CSSProperties}>
              <div className="qv-tbl-row is-head">
                {t.columns.map((c) => (
                  <span key={c}>{c}</span>
                ))}
                <span />
              </div>
              {step.tables[t.id]!.map((r) => (
                <div key={r.key} className={`qv-tbl-row is-${r.kind ?? 'plain'}${rowNow(t.id, r) ? ' is-now' : ''}`}>
                  {r.cells.map((c, i) => (
                    <span key={i}>{c}</span>
                  ))}
                  <span className={`qv-tbl-mark is-${r.markKind ?? 'plain'}`}>{r.mark}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {step.output && <OutputStrip name={spec.outputName} lines={step.output} prev={prev?.output} first={!prev} />}
      {code && <CodePanel code={code} line={step.line ?? null} bad={step.bad} />}
    </div>
  )
}
