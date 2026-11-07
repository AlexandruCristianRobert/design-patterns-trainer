import type { StageDrawingProps } from './drawing'
import { RowStage, type RowSpec, type RowStep } from './RowStage'

export interface MachineState {
  id: string
  name: string
  sub?: string
  /** ok/bad/warn: the colour of the state when it is the current one. */
  tone: 'ok' | 'bad' | 'warn'
}
export interface MachineEdge {
  id: string
  from: string
  to: string
  label: string
}
export interface StateStep extends RowStep {
  /** The current state; the node is marked as current when it changed since the previous step. */
  state: string
  /** The transition taken to get here, if any. */
  edge?: string
}
export interface StateSpec extends Omit<RowSpec, 'steps'> {
  states: MachineState[]
  edges: MachineEdge[]
  steps: Record<string, StateStep>
}

/** A state machine strip (states in a row, the transitions listed under them) above rows of chips. */
export function StateStage({ spec, stepIds, stepIndex, reduced }: { spec: StateSpec } & StageDrawingProps) {
  for (const id of stepIds) if (!spec.steps[id]) throw new Error(`no drawing for step "${id}"`)
  const states = new Map(spec.states.map((s) => [s.id, s]))
  const edges = new Set(spec.edges.map((e) => e.id))
  for (const e of spec.edges) for (const s of [e.from, e.to]) if (!states.has(s)) throw new Error(`edge "${e.id}" uses unknown state "${s}"`)
  for (const [id, s] of Object.entries(spec.steps)) {
    if (!states.has(s.state)) throw new Error(`step "${id}" uses unknown state "${s.state}"`)
    if (s.edge !== undefined && !edges.has(s.edge)) throw new Error(`step "${id}" uses unknown edge "${s.edge}"`)
  }
  const step = spec.steps[stepIds[stepIndex]]
  const prev = stepIndex > 0 ? spec.steps[stepIds[stepIndex - 1]] : undefined
  const name = (id: string) => states.get(id)!.name

  return (
    <div className={`qv-state-stage${reduced ? ' is-reduced' : ''}`}>
      <div className="qv-machine">
        <div className="qv-states">
          {spec.states.map((s, i) => {
            const on = s.id === step.state
            const now = on && (!prev || prev.state !== s.id)
            return (
              <span key={s.id} className="qv-state-cell">
                {i > 0 && <span className="qv-state-arrow" aria-hidden />}
                <span className={`qv-state tone-${s.tone}${on ? ' is-on' : ''}${now ? ' is-now' : ''}`}>
                  {s.name}
                  {s.sub && <small>{s.sub}</small>}
                </span>
              </span>
            )
          })}
        </div>
        <ul className="qv-edges">
          {spec.edges.map((e) => {
            const on = e.id === step.edge
            const now = on && (!prev || prev.edge !== e.id || prev.state !== step.state)
            return (
              <li key={e.id} className={`qv-edge${on ? ' is-on' : ''}${now ? ' is-now' : ''}`}>
                <span className="qv-edge-path">
                  {name(e.from)} → {name(e.to)}
                </span>
                {e.label}
              </li>
            )
          })}
        </ul>
      </div>
      <RowStage spec={spec} stepIds={stepIds} stepIndex={stepIndex} reduced={reduced} />
    </div>
  )
}
