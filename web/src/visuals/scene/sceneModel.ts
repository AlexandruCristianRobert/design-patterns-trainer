import type { SceneScript } from '../../content/schema'

export interface SceneFrame {
  index: number
  caption: string
  activeCall?: { from: string; to: string[]; label: string }
  actorStates: Record<string, Record<string, string>>
  code?: [number, number]
}

/** How long one frame stays on screen during playback at 1×. */
export const STEP_MS = 2500

/** How long the call token takes to travel from caller to callee at 1×. */
export const TRAVEL_MS = 600

/** One frame per step; each frame's actor states are the previous frame's with this step's changes applied. */
export function sceneFrames(script: SceneScript, captions: Record<string, string>): SceneFrame[] {
  let states: Record<string, Record<string, string>> = Object.fromEntries(script.actors.map((a) => [a.id, {}]))
  return script.steps.map((step, index) => {
    if (step.state) {
      states = { ...states }
      for (const [actor, changes] of Object.entries(step.state)) states[actor] = { ...states[actor], ...changes }
    }
    const call = step.call
    return {
      index,
      caption: captions[step.id] ?? '',
      activeCall: call && { from: call.from, to: Array.isArray(call.to) ? call.to : [call.to], label: call.label },
      actorStates: states,
      code: step.code,
    }
  })
}
