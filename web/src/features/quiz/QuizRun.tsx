import { Check, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { recordAnswer, type BoxChange } from '../../quiz/quizStore'
import type { AnswerRecord, RunQuestion } from '../../quiz/run'
import { inlineCode } from '../exercise/inlineCode'
import { QuizCode, QuizText } from './QuizText'

const LETTERS = ['A', 'B', 'C', 'D'] as const

interface Locked {
  index: number
  chosen: number
  correct: boolean
  change: BoxChange | null
  saveFailed: boolean
}

/** Keys belong to a text field while one has focus (radios are fine: they are the options). */
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLInputElement) return target.type !== 'radio' && target.type !== 'checkbox'
  return target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
}

export function QuizRun({ questions, onFinish, onQuit }: { questions: RunQuestion[]; onFinish(answers: AnswerRecord[]): void; onQuit(): void }) {
  const { t } = useTranslation('quiz')
  const ids = useId()
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [locked, setLocked] = useState<Locked | null>(null)
  const [answers, setAnswers] = useState<AnswerRecord[]>([])
  const [confirming, setConfirming] = useState(false)
  const finished = useRef(false)
  const keepGoing = useRef<HTMLButtonElement>(null)
  const nextButton = useRef<HTMLButtonElement>(null)
  const group = useRef<HTMLDivElement>(null)
  /**
   * Where focus goes once the render a step causes is on screen. Each request names the question it is for: effects
   * left over from an earlier render (e.g. the Box change arriving) can run first, and must not use it up.
   */
  const focusAfter = useRef<{ to: 'next' | 'options' | 'restore'; index: number } | null>(null)
  /** The element that had focus when the quit confirmation opened. */
  const returnTo = useRef<Element | null>(null)

  const current = questions[index]
  const last = index === questions.length - 1

  function submit() {
    if (selected === null || locked) return
    const i = index
    const correct = current.options[selected].correct
    setLocked({ index: i, chosen: selected, correct, change: null, saveFailed: false })
    focusAfter.current = { to: 'next', index: i }
    setAnswers((a) => [...a, { questionId: current.question.id, topicId: current.question.topicId, correct }])
    recordAnswer(current.question.id, correct, new Date()).then(
      (change) => setLocked((l) => (l?.index === i ? { ...l, change } : l)),
      () => setLocked((l) => (l?.index === i ? { ...l, saveFailed: true } : l)),
    )
  }

  function next() {
    if (!locked) return
    if (last) {
      if (!finished.current) {
        finished.current = true
        onFinish(answers)
      }
      return
    }
    setIndex(index + 1)
    setSelected(null)
    setLocked(null)
    focusAfter.current = { to: 'options', index: index + 1 }
  }

  function openConfirm() {
    returnTo.current = document.activeElement
    setConfirming(true)
  }

  function closeConfirm() {
    setConfirming(false)
    focusAfter.current = { to: 'restore', index }
  }

  /** The selected radio, or the first one; once the answer is locked the radios are disabled, so Next stands in. */
  function focusOptions() {
    const radios = [...(group.current?.querySelectorAll<HTMLInputElement>('input[type=radio]') ?? [])]
    const target = radios.find((r) => r.checked) ?? radios[0]
    if (target && !target.disabled) target.focus()
    else nextButton.current?.focus()
  }

  useEffect(() => {
    if (confirming) keepGoing.current?.focus()
  }, [confirming])

  useEffect(() => {
    const request = focusAfter.current
    if (request === null || request.index !== index) return
    if (request.to === 'next' && !locked) return
    if (request.to === 'options' && locked) return
    if (request.to === 'restore' && confirming) return
    focusAfter.current = null
    if (request.to === 'next') nextButton.current?.focus()
    else if (request.to === 'options') focusOptions()
    else {
      const prev = returnTo.current
      returnTo.current = null
      if (prev instanceof HTMLElement && prev !== document.body && prev.isConnected) {
        prev.focus()
        if (document.activeElement === prev) return
      }
      focusOptions()
    }
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      if (typing(e.target)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        if (confirming) closeConfirm()
        else openConfirm()
        return
      }
      if (confirming) return
      if (/^[1-4]$/.test(e.key)) {
        if (!locked) {
          e.preventDefault()
          setSelected(Number(e.key) - 1)
        }
        return
      }
      if (e.key === 'Enter') {
        // a focused button, link or disclosure keeps its own Enter activation
        if ((e.target as Element).closest?.('a,button,summary,[role=button]')) return
        e.preventDefault()
        if (locked) next()
        else submit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const qid = `${ids}-q`
  const boxText = (c: BoxChange) => (c.from === undefined ? t('run.boxNew', { to: c.to }) : t('run.boxMove', { from: c.from, to: c.to }))

  return (
    <section className="panel quiz-run" aria-labelledby={qid}>
      <div className="prog-panel-body">
        <div className="quiz-meta">
          <span>{t('run.progress', { index: index + 1, total: questions.length })}</span>
          <span className="quiz-topic">{current.topicTitle}</span>
        </div>
        <div id={qid} className="quiz-question">
          <QuizText text={current.question.question} />
          {current.question.code && <QuizCode code={current.question.code} />}
        </div>

        <div ref={group} role="radiogroup" aria-labelledby={qid} className="quiz-options">
          {current.options.map((o, i) => {
            const state = !locked ? (selected === i ? 'selected' : 'open') : o.correct ? 'correct' : locked.chosen === i ? 'wrong' : 'other'
            return (
              <div key={`${index}-${i}`} className={`quiz-option is-${state}`} data-letter={LETTERS[i]}>
                <label className="quiz-choice">
                  <input
                    type="radio"
                    name={`${ids}-option`}
                    checked={locked ? locked.chosen === i : selected === i}
                    disabled={locked !== null}
                    onChange={() => setSelected(i)}
                  />
                  <span className="quiz-letter" aria-hidden="true">
                    {LETTERS[i]}
                  </span>
                  <span className="quiz-option-text">{inlineCode(o.text)}</span>
                  {locked && (o.correct || locked.chosen === i) && (
                    <span className={`quiz-verdict ${o.correct ? 'is-correct' : 'is-wrong'}`}>
                      {o.correct ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
                      {locked.chosen === i ? (o.correct ? t('run.yourAnswerCorrect') : t('run.yourAnswerWrong')) : t('run.correctAnswer')}
                    </span>
                  )}
                </label>
                {locked && (
                  <div className="quiz-explanation">
                    <QuizText text={o.explanation} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* present from the start, so the text that arrives on Submit is announced */}
        <p className={locked ? `quiz-outcome ${locked.correct ? 'is-correct' : 'is-wrong'}` : 'sr-only'} role="status">
          {locked && (locked.correct ? t('run.correct') : t('run.wrong'))}
          {locked?.change && <span className="quiz-box">{boxText(locked.change)}</span>}
        </p>
        {locked?.saveFailed && <p className="prog-hint exam-bad">{t('run.saveFailed')}</p>}

        {confirming && (
          <div className="quiz-confirm" role="alertdialog" aria-labelledby={`${ids}-quit`}>
            <p id={`${ids}-quit`}>{t('run.quitConfirm')}</p>
            <div className="reset-actions">
              <button type="button" ref={keepGoing} className="btn btn-quiet" onClick={closeConfirm}>
                {t('run.quitNo')}
              </button>
              <button type="button" className="btn btn-primary" onClick={onQuit}>
                {t('run.quitYes')}
              </button>
            </div>
          </div>
        )}
        {/* hidden, not unmounted, while confirming: the button that opened the confirmation gets focus back */}
        <div className="quiz-actions" hidden={confirming}>
          {locked ? (
            <button key="next" ref={nextButton} type="button" className="btn btn-primary" onClick={next}>
              {last ? t('run.finish') : t('run.next')}
            </button>
          ) : (
            <button key="submit" type="button" className="btn btn-primary" disabled={selected === null} onClick={submit}>
              {t('run.submit')}
            </button>
          )}
          <button type="button" className="btn btn-quiet" onClick={openConfirm}>
            {t('run.quit')}
          </button>
          <span className="prog-hint quiz-keys">{t('run.keys')}</span>
        </div>
      </div>
    </section>
  )
}
