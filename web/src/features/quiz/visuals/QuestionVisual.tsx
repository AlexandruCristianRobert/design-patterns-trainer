import { Pause, Play, StepBack, StepForward } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { QuizOption } from '../../../content/quiz'
import type { QuizVisual } from '../../../content/quizVisuals'
import { inlineCode } from '../../exercise/inlineCode'
import { typing } from '../typing'
import type { QuestionDrawing } from './drawing'
import { loadDrawing } from './registry'
import { answerViews, setupView, stepCount, stepIn } from './visualModel'

export const STEP_MS = 1600

export interface QuestionVisualProps {
  visual: QuizVisual
  /** The Options in file order (what content indexes refer to) and in this run's display order. */
  sourceOptions: QuizOption[]
  displayOptions: QuizOption[]
  answered: boolean
  /** The open view's key; QuizRun owns it so the Explanations' "See what X claims" buttons can open a tab. */
  view: string
  onView(key: string): void
  /** Increments when the open view should play once by itself (spec §5.2). */
  autoplay: number
  /** True while something else (the quit confirmation) owns the keyboard. */
  keysDisabled?: boolean
}

/** The shared frame around a question's bespoke drawings: views, synced stepping, playback, keys and captions. */
export function QuestionVisual({ visual, sourceOptions, displayOptions, answered, view, onView, autoplay, keysDisabled = false }: QuestionVisualProps) {
  const { t } = useTranslation('quiz')
  const reduced = useReducedMotion() ?? false
  const panel = useRef<HTMLElement>(null)
  const views = useMemo(
    () => (answered ? answerViews(visual, sourceOptions, displayOptions) : [setupView(visual)]),
    [answered, visual, sourceOptions, displayOptions],
  )
  const current = views.find((v) => v.key === view) ?? views[0]
  const count = stepCount(current)

  // Step and play state belong to one view; another view starts at step 1, stopped.
  const [shown, setShown] = useState({ key: current.key, step: 0, playing: false })
  const state = shown.key === current.key ? shown : { key: current.key, step: 0, playing: false }
  // Leaving a view forgets its step and play state, so coming back starts at step 1, stopped.
  if (shown.key !== current.key) setShown(state)
  // Playback ends by itself on the last step; the button then offers Play again.
  const playing = state.playing && state.step < count - 1
  const go = (n: number) => setShown({ key: current.key, step: Math.max(0, Math.min(count - 1, n)), playing: false })
  const toggle = () =>
    setShown(playing ? { ...state, playing: false } : { key: current.key, step: state.step >= count - 1 ? 0 : state.step, playing: true })

  // A new autoplay count starts the open view once, adjusted during render rather than in an effect.
  const [seenAutoplay, setSeenAutoplay] = useState(autoplay)
  if (seenAutoplay !== autoplay) {
    setSeenAutoplay(autoplay)
    if (!reduced) setShown({ key: current.key, step: 0, playing: true })
  }

  // One timeout per step, restarted whenever the step or play state changes.
  useEffect(() => {
    if (!playing) return
    const id = setTimeout(() => setShown({ key: state.key, step: state.step + 1, playing: true }), STEP_MS)
    return () => clearTimeout(id)
  }, [state.key, state.step, playing])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (keysDisabled) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target
      if (typing(target)) return
      if (target instanceof HTMLInputElement && target.type === 'radio') return // the Options own ←/→
      const inside = target instanceof Node && panel.current?.contains(target) === true
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (!answered && !inside) return
        e.preventDefault()
        go(state.step + (e.key === 'ArrowRight' ? 1 : -1))
      } else if (e.key === ' ' && inside && !(target instanceof HTMLButtonElement)) {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const [drawing, setDrawing] = useState<{ id: string; stages: QuestionDrawing } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    loadDrawing(visual.question)
      ?.then((stages) => live && setDrawing({ id: visual.question, stages }))
      .catch(() => live && setFailed(visual.question))
    return () => {
      live = false
    }
  }, [visual.question])
  const stages = drawing?.id === visual.question ? drawing.stages : null

  const title = current.kind === 'setup' ? visual.setup.title : current.kind === 'reality' ? visual.reality.title : t('visual.claimTitle', { letter: current.letter })
  const tag = (i: number) => (current.kind !== 'claim' ? null : i === 0 ? ['is-claim', t('visual.tagClaim')] : ['is-reality', t('visual.tagReality')])

  return (
    <section ref={panel} className="panel quiz-visual" tabIndex={0} aria-label={t('visual.label')}>
      <div className="prog-panel-body">
        <div className="qv-head">
          <div>
            <p className="qv-phase">{answered ? t('visual.explanation') : t('visual.setup')}</p>
            <h2 className="qv-title">{title}</h2>
          </div>
          {answered && (
            <div className="qv-tabs" role="group" aria-label={t('visual.views')}>
              {views.map((v) => (
                <button key={v.key} type="button" className={`qv-tab is-${v.kind}`} aria-pressed={v.key === current.key} onClick={() => onView(v.key)}>
                  {v.kind === 'reality' ? t('visual.reality') : t('visual.claimTab', { letter: v.letter })}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={current.stages.length > 1 ? 'qv-stages is-pair' : 'qv-stages'}>
          {current.stages.map((s, i) => {
            const at = stepIn(s, state.step)
            const Stage = stages?.[s.id]
            const tg = tag(i)
            return (
              <figure key={s.id} className="qv-stage">
                {/* the Setup's single stage is titled like the panel header, so only the header shows it */}
                {current.kind !== 'setup' && (
                  <figcaption className="qv-stage-title">
                    <span className="qv-stage-name">{s.title}</span>
                    {tg && <span className={`qv-tag ${tg[0]}`}>{tg[1]}</span>}
                  </figcaption>
                )}
                {Stage ? <Stage stepIds={s.steps.map((x) => x.id)} stepIndex={at} reduced={reduced} /> : <p className="prog-hint">{failed === visual.question ? t('visual.loadFailed') : t('visual.loading')}</p>}
                <p className="qv-caption" aria-live="polite">{inlineCode(s.steps[at].caption)}</p>
              </figure>
            )
          })}
        </div>
        <div className="qv-player">
          <button type="button" className="btn btn-quiet btn-small" onClick={() => go(state.step - 1)} aria-disabled={state.step === 0}>
            <StepBack size={14} aria-hidden="true" /> {t('visual.stepBack')}
          </button>
          <button type="button" className="btn btn-quiet btn-small" onClick={toggle}>
            {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />} {playing ? t('visual.pause') : t('visual.play')}
          </button>
          <button type="button" className="btn btn-quiet btn-small" onClick={() => go(state.step + 1)} aria-disabled={state.step >= count - 1}>
            <StepForward size={14} aria-hidden="true" /> {t('visual.stepForward')}
          </button>
          <span className="qv-pos">{t('visual.position', { n: state.step + 1, m: count })}</span>
        </div>
      </div>
    </section>
  )
}
