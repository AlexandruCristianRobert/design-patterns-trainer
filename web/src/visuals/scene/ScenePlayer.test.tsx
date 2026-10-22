import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPattern } from '../../content/patterns'
import { getPatternText } from '../../content/text'
import { LessonProvider, useLinkedLines } from '../../features/lesson/LessonContext'
import { STEP_MS } from './sceneModel'
import { ScenePlayer } from './ScenePlayer'

const { scene } = getPattern('observer')!
const captions = getPatternText('observer', 'en').value.scene
const total = scene.steps.length

function Probe() {
  const { lines } = useLinkedLines()
  return <output data-testid="linked">{JSON.stringify(lines)}</output>
}

function setup() {
  render(
    <LessonProvider>
      <ScenePlayer script={scene} captions={captions} />
      <Probe />
    </LessonProvider>,
  )
  return { player: screen.getByRole('region', { name: 'Interaction scene' }) }
}

const caption = () => screen.getByTestId('scene-caption').textContent

afterEach(() => vi.useRealTimers())

describe('ScenePlayer', () => {
  it('shows the first frame: actors, caption and a labelled step scrubber', () => {
    setup()
    for (const a of scene.actors) expect(screen.getByTestId(`actor-${a.id}`)).toHaveTextContent(a.name)
    expect(caption()).toBe(captions['phone-subscribes'])
    expect(screen.getByRole('slider', { name: `Step 1 of ${total}` })).toHaveValue('1')
    // aria-disabled, not disabled: a keyboard user stepping to the end keeps focus on the button.
    expect(screen.getByRole('button', { name: 'Previous step' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('next, previous and reset change the frame and link its code lines', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    expect(caption()).toBe(captions['tv-subscribes'])
    expect(screen.getByTestId('linked')).toHaveTextContent('[6,6]')
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous step' }))
    expect(caption()).toBe(captions['tv-subscribes'])
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(caption()).toBe(captions['phone-subscribes'])
    expect(screen.getByTestId('linked')).toHaveTextContent('[5,5]')
  })

  it('the scrubber jumps to a step', () => {
    setup()
    fireEvent.change(screen.getByRole('slider'), { target: { value: '4' } })
    expect(caption()).toBe(captions['notify-23'])
    expect(screen.getByRole('slider', { name: `Step 4 of ${total}` })).toBeInTheDocument()
    expect(screen.getByTestId('actor-tv')).toHaveTextContent('23°C')
  })

  it('← and → step through frames when the player has focus', () => {
    const { player } = setup()
    player.focus()
    fireEvent.keyDown(player, { key: 'ArrowRight' })
    fireEvent.keyDown(player, { key: 'ArrowRight' })
    expect(caption()).toBe(captions['set-23'])
    fireEvent.keyDown(player, { key: 'ArrowLeft' })
    expect(caption()).toBe(captions['tv-subscribes'])
  })

  it('Space toggles playback when the player has focus', () => {
    vi.useFakeTimers()
    const { player } = setup()
    fireEvent.keyDown(player, { key: ' ' })
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    fireEvent.keyDown(player, { key: ' ' })
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  it('play advances one frame per step interval and stops at the end', () => {
    vi.useFakeTimers()
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    act(() => vi.advanceTimersByTime(STEP_MS - 1))
    expect(caption()).toBe(captions['phone-subscribes'])
    act(() => vi.advanceTimersByTime(1))
    expect(caption()).toBe(captions['tv-subscribes'])
    for (let i = 0; i < total * 3; i++) act(() => vi.advanceTimersByTime(STEP_MS))
    expect(caption()).toBe(captions['notify-25'])
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: `Step ${total} of ${total}` })).toBeInTheDocument()
  })

  it('2× speed halves the step interval', () => {
    vi.useFakeTimers()
    setup()
    fireEvent.click(screen.getByRole('button', { name: '2×' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    act(() => vi.advanceTimersByTime(STEP_MS / 2))
    expect(caption()).toBe(captions['tv-subscribes'])
  })

  it('animates a travelling token for each callee of the active call', () => {
    setup()
    expect(screen.getAllByTestId('scene-token')).toHaveLength(1)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '4' } })
    expect(screen.getAllByTestId('scene-token')).toHaveLength(2)
  })
})
