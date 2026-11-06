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

  const current = questions[index]
  const last = index === questions.length - 1

  function submit() {
    if (selected === null || locked) return
    const i = index
    const correct = current.options[selected].correct
    setLocked({ index: i, chosen: selected, correct, change: null, saveFailed: false })
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
  }

  useEffect(() => {
    if (confirming) keepGoing.current?.focus()
  }, [confirming])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      if (typing(e.target)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        setConfirming((c) => !c)
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
        // a focused button keeps its own Enter activation
        if (e.target instanceof HTMLButtonElement) return
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

        <div role="radiogroup" aria-labelledby={qid} className="quiz-options">
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

        {locked && (
          <p className={`quiz-outcome ${locked.correct ? 'is-correct' : 'is-wrong'}`} role="status">
            {locked.correct ? t('run.correct') : t('run.wrong')}
            {locked.change && <span className="quiz-box">{boxText(locked.change)}</span>}
          </p>
        )}
        {locked?.saveFailed && <p className="prog-hint exam-bad">{t('run.saveFailed')}</p>}

        {confirming ? (
          <div className="quiz-confirm" role="alertdialog" aria-labelledby={`${ids}-quit`}>
            <p id={`${ids}-quit`}>{t('run.quitConfirm')}</p>
            <div className="reset-actions">
              <button type="button" ref={keepGoing} className="btn btn-quiet" onClick={() => setConfirming(false)}>
                {t('run.quitNo')}
              </button>
              <button type="button" className="btn btn-primary" onClick={onQuit}>
                {t('run.quitYes')}
              </button>
            </div>
          </div>
        ) : (
          <div className="quiz-actions">
            {locked ? (
              <button type="button" className="btn btn-primary" onClick={next}>
                {last ? t('run.finish') : t('run.next')}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" disabled={selected === null} onClick={submit}>
                {t('run.submit')}
              </button>
            )}
            <button type="button" className="btn btn-quiet" onClick={() => setConfirming(true)}>
              {t('run.quit')}
            </button>
            <span className="prog-hint quiz-keys">{t('run.keys')}</span>
          </div>
        )}
      </div>
    </section>
  )
}
