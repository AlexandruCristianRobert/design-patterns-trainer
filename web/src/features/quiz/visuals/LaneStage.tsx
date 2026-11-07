import { Fragment, type CSSProperties } from 'react'
import type { StageDrawingProps } from './drawing'

export type Lane = 'ui' | 'pool' | 'io' | 'req'
export type Kind = 'run' | 'wait' | 'block' | 'dead' | 'ok' | 'q'
export interface Block {
  lane: Lane
  kind: Kind
  label: string
  /** Where the work came from, when it moved threads. */
  hop?: string
}
export interface LaneSpec {
  lanes: Lane[]
  /** Whether the first lane's thread has a SynchronizationContext. */
  context: boolean
  code: string[]
  /** Per step id: what appears in that step's column, and the code line (0-based) to highlight. */
  steps: Record<string, { blocks: Block[]; line: number }>
}

const LANE: Record<Lane, { name: string; sub: string; tone: string }> = {
  ui: { name: 'UI thread', sub: 'runs the click handler', tone: 'ui' },
  pool: { name: 'Thread pool', sub: 'any free worker', tone: 'pool' },
  io: { name: 'I/O', sub: 'disk or network', tone: 'io' },
  req: { name: 'Request thread', sub: 'ASP.NET Core', tone: 'ui' },
}

/** Threads as rows, steps as columns; the library code underneath with the step's line highlighted. */
export function LaneStage({ spec, stepIds, stepIndex, reduced }: { spec: LaneSpec } & StageDrawingProps) {
  for (const id of stepIds) if (!spec.steps[id]) throw new Error(`no drawing for step "${id}"`)
  const line = spec.steps[stepIds[stepIndex]].line
  return (
    <div className={`qv-lane-stage${reduced ? ' is-reduced' : ''}`}>
      <div className="qv-lanes" style={{ '--qv-cols': stepIds.length } as CSSProperties}>
        {spec.lanes.map((lane, li) => {
          const info = LANE[lane]
          return (
            <Fragment key={lane}>
              <div className={`qv-lane-name tone-${info.tone}`}>
                {info.name}
                <small>{info.sub}</small>
                {li === 0 && <span className={spec.context ? 'qv-badge' : 'qv-badge is-none'}>{spec.context ? 'SynchronizationContext' : 'no SynchronizationContext'}</span>}
              </div>
              <div className="qv-track">
                {stepIds.map((id, si) => {
                  const block = spec.steps[id].blocks.find((x) => x.lane === lane)
                  if (!block) return <div key={id} className="qv-cell" />
                  const state = si > stepIndex ? '' : si === stepIndex ? ' is-on is-now' : ' is-on'
                  return (
                    <div key={id} className={`qv-cell qv-block is-${block.kind} tone-${info.tone}${state}`} aria-hidden={si > stepIndex || undefined}>
                      {block.hop && <span className="qv-hop">{block.hop}</span>}
                      {block.label}
                    </div>
                  )
                })}
              </div>
            </Fragment>
          )
        })}
      </div>
      <pre className="qv-code">
        {spec.code.map((text, i) => (
          <span key={i} className={i === line ? 'qv-line is-on' : 'qv-line'}>
            {text || ' '}
            {'\n'}
          </span>
        ))}
      </pre>
    </div>
  )
}
