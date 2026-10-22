import { motion } from 'motion/react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { SceneActor } from '../../content/schema'
import { TRAVEL_MS, type SceneFrame } from './sceneModel'

const LANE_H = 40
const LANE_TOP = 30
const LANE_PAD = 14

/** Height of the call area for `lanes` parallel calls; the player reserves the script's maximum so nothing jumps. */
function callAreaHeight(lanes: number): number {
  return LANE_TOP + Math.max(lanes - 1, 0) * LANE_H + LANE_PAD
}

interface SceneStageProps {
  actors: SceneActor[]
  frame: SceneFrame
  previous?: SceneFrame
  lanes: number
  reduced: boolean
  speed: number
}

/**
 * One frame of an Interaction Scene, drawn like a small sequence diagram: each actor is an object box holding its
 * current state, with a lifeline below; the active call is an arrow per callee (fan-out gets one lane each).
 */
export function SceneStage({ actors, frame, previous, lanes, reduced, speed }: SceneStageProps) {
  const { t } = useTranslation('lesson')
  const markerId = `scene-arrow${useId().replace(/:/g, '')}`
  const n = actors.length
  const centre = (id: string) => ((actors.findIndex((a) => a.id === id) + 0.5) / n) * 100
  const call = frame.activeCall
  const travel = TRAVEL_MS / speed / 1000
  // Without a call the new state appears at once; with one it lands when the token arrives.
  const settle = reduced ? undefined : { duration: 0.2, ease: 'easeOut' as const, delay: call ? travel : 0 }

  return (
    <div className="scene-stage">
      <ol className="scene-actors" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {actors.map((a) => {
          const state = Object.entries(frame.actorStates[a.id] ?? {})
          const part = call?.from === a.id ? 'caller' : call?.to.includes(a.id) ? 'callee' : undefined
          return (
            <li key={a.id} className="scene-actor" data-testid={`actor-${a.id}`} data-role={a.role} data-part={part}>
              <span className="scene-actor-name">{a.name}</span>
              {state.length === 0 ? (
                <p className="scene-state scene-state-empty">{t('scene.noState')}</p>
              ) : (
                <dl className="scene-state">
                  {state.map(([key, value]) => {
                    const before = previous?.actorStates[a.id]?.[key]
                    const changed = before !== value
                    if (before === undefined && settle) {
                      // A new field: label and value arrive together.
                      return (
                        <motion.div key={`${key}-${frame.index}`} className="scene-state-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={settle}>
                          <dt>{key}</dt>
                          <dd className="scene-changed">{value}</dd>
                        </motion.div>
                      )
                    }
                    return (
                      <div key={key} className="scene-state-row">
                        <dt>{key}</dt>
                        {changed && settle ? (
                          <motion.dd key={frame.index} className="scene-changed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={settle}>
                            {value}
                          </motion.dd>
                        ) : (
                          <dd className={changed ? 'scene-changed' : undefined}>{value}</dd>
                        )}
                      </div>
                    )
                  })}
                </dl>
              )}
            </li>
          )
        })}
      </ol>
      <div className="scene-calls" style={{ height: callAreaHeight(lanes) }}>
        <svg className="scene-lines" width="100%" height="100%" aria-hidden="true" focusable="false">
          <defs>
            <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 Z" className="scene-arrowhead" />
            </marker>
          </defs>
          {actors.map((a) => (
            <line key={a.id} className="scene-lifeline" x1={`${centre(a.id)}%`} x2={`${centre(a.id)}%`} y1="0" y2="100%" />
          ))}
          {call?.to.map((to, k) => (
            <line
              key={to}
              className="scene-arrow"
              x1={`${centre(call.from)}%`}
              x2={`${centre(to)}%`}
              y1={LANE_TOP + k * LANE_H}
              y2={LANE_TOP + k * LANE_H}
              markerEnd={`url(#${markerId})`}
            />
          ))}
        </svg>
        {call && (
          <div data-testid="scene-call">
            {call.to.map((to, k) => {
              const from = centre(call.from)
              const target = centre(to)
              const role = actors.find((a) => a.id === call.from)?.role
              return (
                <div key={`${frame.index}-${to}`}>
                  <span className="scene-call-label" style={{ left: `${(from + target) / 2}%`, top: LANE_TOP + k * LANE_H - 22 }}>
                    {call.label}
                  </span>
                  {!reduced && (
                    // The layer spans the stage, so a translate in % of its own width is a move in % of the stage.
                    <motion.div
                      className="scene-token-track"
                      style={{ top: LANE_TOP + k * LANE_H }}
                      initial={{ x: '0%', opacity: 1 }}
                      animate={{ x: `${target - from}%`, opacity: 0 }}
                      transition={{ x: { duration: travel, ease: 'easeInOut' }, opacity: { duration: 0.15, delay: travel } }}
                    >
                      <span className="scene-token" data-testid="scene-token" data-role={role} style={{ left: `${from}%` }} />
                    </motion.div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
