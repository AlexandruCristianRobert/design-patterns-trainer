import { describe, expect, it } from 'vitest'
import { getPattern } from '../../content/patterns'
import { getPatternText } from '../../content/text'
import { sceneFrames } from './sceneModel'

const { scene } = getPattern('observer')!
const captions = getPatternText('observer', 'en').value.scene

describe('sceneFrames', () => {
  const frames = sceneFrames(scene, captions)

  it('makes one frame per step with its caption and code lines', () => {
    expect(frames).toHaveLength(scene.steps.length)
    expect(frames.map((f) => f.index)).toEqual(scene.steps.map((_, i) => i))
    expect(frames[0].caption).toBe(captions['phone-subscribes'])
    expect(frames[0].code).toEqual([5, 5])
  })

  it('accumulates state step by step', () => {
    // After step 4 (notify-23) both displays show 23 and the station still remembers its observers.
    expect(frames[3].actorStates.phone).toEqual({ shows: '23°C' })
    expect(frames[3].actorStates.tv).toEqual({ shows: '23°C' })
    expect(frames[3].actorStates.station).toEqual({ observers: 'phone, tv', temperature: '23' })
    // The TV unsubscribed before 25 was set, so it keeps showing 23.
    const last = frames[frames.length - 1]
    expect(last.actorStates.tv).toEqual({ shows: '23°C' })
    expect(last.actorStates.phone).toEqual({ shows: '25°C' })
    expect(last.actorStates.station).toEqual({ observers: 'phone', temperature: '25' })
  })

  it('starts every actor with an empty state and never mutates earlier frames', () => {
    expect(frames[0].actorStates.phone).toEqual({})
    expect(frames[0].actorStates.station).toEqual({ observers: 'phone' })
    expect(frames[1].actorStates.station).toEqual({ observers: 'phone, tv' })
  })

  it('normalises calls: single callee to a one-item list, fan-out to every callee', () => {
    expect(frames[0].activeCall).toEqual({ from: 'phone', to: ['station'], label: 'Subscribe(phone)' })
    expect(frames[2].activeCall).toBeUndefined()
    expect(frames[3].activeCall).toEqual({ from: 'station', to: ['phone', 'tv'], label: 'Update(23)' })
  })

  it('uses an empty caption when the text file has none for a step', () => {
    expect(sceneFrames(scene, {})[0].caption).toBe('')
  })
})
