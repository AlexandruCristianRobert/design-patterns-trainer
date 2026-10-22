import { Pause, Play, RotateCcw, StepBack, StepForward } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { SceneScript } from '../../content/schema'
import { useLinkedLines } from '../../features/lesson/LessonContext'
import { sceneFrames, STEP_MS } from './sceneModel'
import { SceneStage } from './SceneStage'

const speeds = [0.5, 1, 2] as const
type Speed = (typeof speeds)[number]

/**
 * Plays an Interaction Scene frame by frame. Each frame links its code lines to the Lesson example.
 * Playback is one timeout per frame, restarted whenever the frame, speed or play state changes, so it can't drift
 * into double steps; it stops on the last frame and is cleared on unmount.
 */
export function ScenePlayer({ script, captions }: { script: SceneScript; captions: Record<string, string> }) {
  const { t } = useTranslation('lesson')
  const { link } = useLinkedLines()
  const reduced = useReducedMotion() ?? false
  const frames = useMemo(() => sceneFrames(script, captions), [script, captions])
  const lanes = useMemo(() => Math.max(1, ...frames.map((f) => f.activeCall?.to.length ?? 0)), [frames])
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)
  const scrubberId = useId()
  const last = frames.length - 1

  const go = useCallback(
    (i: number) => {
      const next = Math.min(Math.max(i, 0), last)
      setIndex(next)
      link(frames[next]?.code ?? null)
    },
    [frames, last, link],
  )

  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => {
      go(index + 1)
      if (index + 1 >= last) setPlaying(false)
    }, STEP_MS / speed)
    return () => clearTimeout(timer)
  }, [playing, index, speed, last, go])

  if (frames.length === 0) return null

  const step = (i: number) => {
    setPlaying(false)
    go(i)
  }
  const togglePlay = () => {
    if (playing) return setPlaying(false)
    go(index >= last ? 0 : index)
    setPlaying(true)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const target = e.target as HTMLElement
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (target instanceof HTMLInputElement) return // the scrubber moves itself
      e.preventDefault()
      step(index + (e.key === 'ArrowRight' ? 1 : -1))
    } else if (e.key === ' ' && !(target instanceof HTMLButtonElement)) {
      // Buttons keep Space for themselves; anywhere else in the player it plays and pauses.
      e.preventDefault()
      togglePlay()
    }
  }

  const frame = frames[index]
  const position = t('scene.step', { n: index + 1, total: frames.length })
  return (
    <section
      className="scene-player"
      aria-label={t('scene.label')}
      tabIndex={0}
      aria-keyshortcuts="ArrowLeft ArrowRight Space"
      onKeyDown={onKeyDown}
    >
      <SceneStage actors={script.actors} frame={frame} previous={frames[index - 1]} lanes={lanes} reduced={reduced} speed={speed} />
      {/* Every caption sits in the same grid cell, invisible but sized, so the box is as tall as the longest one
          at any width and the controls below never move under the pointer. */}
      <div className="scene-caption-box">
        {frames.map((f) => (
          <p key={f.index} className="scene-caption scene-caption-sizer" aria-hidden="true">
            {f.caption}
          </p>
        ))}
        <p className="scene-caption" data-testid="scene-caption" aria-live="polite">
          {frame.caption}
        </p>
      </div>
      <div className="scene-controls">
        <div className="scene-buttons">
          <button type="button" className="icon-btn" aria-label={t('scene.previous')} title={t('scene.previous')} aria-disabled={index === 0} onClick={() => step(index - 1)}>
            <StepBack size={16} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn icon-btn-primary" aria-label={playing ? t('scene.pause') : t('scene.play')} title={playing ? t('scene.pause') : t('scene.play')} onClick={togglePlay}>
            {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          </button>
          <button type="button" className="icon-btn" aria-label={t('scene.next')} title={t('scene.next')} aria-disabled={index === last} onClick={() => step(index + 1)}>
            <StepForward size={16} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn" aria-label={t('scene.reset')} title={t('scene.reset')} onClick={() => step(0)}>
            <RotateCcw size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="scene-scrubber">
          <label htmlFor={scrubberId} className="scene-position">
            {position}
          </label>
          <input
            id={scrubberId}
            type="range"
            min={1}
            max={frames.length}
            step={1}
            value={index + 1}
            aria-valuetext={position}
            onChange={(e) => step(Number(e.target.value) - 1)}
          />
        </div>
        <div className="scene-speed">
          <span className="scene-speed-label" aria-hidden="true">
            {t('scene.speed')}
          </span>
          <div className="seg" role="group" aria-label={t('scene.speed')}>
            {speeds.map((s) => (
              <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)}>
                {`${s}×`}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="scene-keys muted">{t('scene.keys')}</p>
    </section>
  )
}
