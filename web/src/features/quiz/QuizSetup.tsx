import { Play, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getQuizBank, getQuizTopics, type QuizQuestion } from '../../content/quiz'
import { useQuizBoxes } from '../../progress/useProgress'
import { stateOf } from '../../quiz/leitner'
import { pickRun, poolFor, type StartedRun } from '../../quiz/run'
import { MAX_QUIZ_LENGTH, PRESET_LENGTHS, requestedLength, useQuizSettings } from '../../quiz/settings'

function parseCustom(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null
  const n = Number(text)
  return n >= 1 && n <= MAX_QUIZ_LENGTH ? n : null
}

export function QuizSetup({ onStart }: { onStart(run: StartedRun): void }) {
  const { t } = useTranslation('quiz')
  const ids = useId()
  const startRef = useRef<HTMLButtonElement>(null)
  const topics = useMemo(() => getQuizTopics(), [])
  const bank = useMemo(() => getQuizBank(), [])
  const topicIds = useMemo(() => new Set(topics.map((x) => x.id)), [topics])
  const [settings, setSettings] = useQuizSettings(topicIds)
  const [customText, setCustomText] = useState(String(settings.custom))
  const { data: boxes, error: boxesError } = useQuizBoxes()
  const loading = boxes === undefined && !boxesError
  const focused = useRef(false)
  useEffect(() => {
    if (!loading && !focused.current) {
      focused.current = true
      startRef.current?.focus()
    }
  }, [loading])

  const [now] = useState(() => new Date())
  const countsOf = useMemo(() => {
    return (pool: QuizQuestion[]) => {
      let due = 0
      let fresh = 0
      for (const q of pool) {
        const s = stateOf(boxes?.get(q.id), now)
        if (s === 'due') due++
        else if (s === 'new') fresh++
      }
      return { due, fresh }
    }
  }, [boxes, now])

  const choosing = settings.topics !== 'all'
  const chosen = settings.topics === 'all' ? [] : settings.topics
  const pool = poolFor(bank, settings.topics)
  const customInvalid = settings.length === 'custom' && parseCustom(customText) === null
  const effective = Math.min(requestedLength(settings), pool.length, MAX_QUIZ_LENGTH)
  const noTopic = choosing && chosen.length === 0
  const customMax = pool.length > 0 ? Math.min(MAX_QUIZ_LENGTH, pool.length) : MAX_QUIZ_LENGTH
  const capped = !noTopic && !customInvalid && pool.length > 0 && requestedLength(settings) > pool.length
  const canStart = !loading && !noTopic && !customInvalid && effective > 0

  function start(e: React.FormEvent) {
    e.preventDefault()
    if (!canStart) return
    onStart(pickRun(bank, settings.topics, effective, boxes ?? new Map(), new Date(), Math.random))
  }

  const toggle = (id: string, on: boolean) => setSettings({ ...settings, topics: on ? [...chosen, id] : chosen.filter((x) => x !== id) })

  return (
    <form className="panel exam-panel" onSubmit={start} noValidate>
      <div className="prog-panel-body exam-fields">
        <div className="exam-field">
          <span id={`${ids}-length`} className="exam-label">
            {t('setup.length')}
          </span>
          <div className="seg quiz-seg" role="group" aria-labelledby={`${ids}-length`}>
            {[...PRESET_LENGTHS, 'custom' as const].map((l) => (
              <button key={l} type="button" aria-pressed={settings.length === l} onClick={() => setSettings({ ...settings, length: l })}>
                {l === 'custom' ? t('setup.custom') : l}
              </button>
            ))}
          </div>
          {settings.length === 'custom' && (
            <>
              <label htmlFor={`${ids}-custom`} className="sr-only">
                {t('setup.customLabel')}
              </label>
              <input
                id={`${ids}-custom`}
                className="exam-number"
                type="number"
                inputMode="numeric"
                min={1}
                max={customMax}
                value={customText}
                aria-invalid={customInvalid}
                onKeyDown={(e) => {
                  // Enter must not submit the form from here (spec §5)
                  if (e.key === 'Enter') e.preventDefault()
                }}
                aria-describedby={`${ids}-custom-hint`}
                onChange={(e) => {
                  setCustomText(e.target.value)
                  const n = parseCustom(e.target.value)
                  if (n !== null) setSettings({ ...settings, custom: n })
                }}
              />
              <span id={`${ids}-custom-hint`} className={customInvalid ? 'prog-hint exam-bad' : 'prog-hint'}>
                {customInvalid ? t('setup.customInvalid', { max: customMax }) : t('setup.customHint', { max: customMax })}
              </span>
            </>
          )}
        </div>

        <fieldset className="exam-field exam-group">
          <legend className="exam-label">{t('setup.topics')}</legend>
          <div className="exam-options">
            <label className="exam-option">
              <input type="radio" name={`${ids}-topics`} checked={!choosing} onChange={() => setSettings({ ...settings, topics: 'all' })} />
              {t('setup.allTopics')}
              <span className="prog-hint">{t('setup.topicCounts', countsOf(bank))}</span>
            </label>
            <label className="exam-option">
              <input type="radio" name={`${ids}-topics`} checked={choosing} onChange={() => setSettings({ ...settings, topics: [] })} />
              {t('setup.chooseTopics')}
            </label>
          </div>
          {choosing && (
            <fieldset className="exam-sub">
              <legend className="sr-only">{t('setup.chooseTopics')}</legend>
              {topics.map((topic) => (
                <label key={topic.id} className="exam-option">
                  <input type="checkbox" checked={chosen.includes(topic.id)} onChange={(e) => toggle(topic.id, e.target.checked)} />
                  {topic.title}
                  <span className="prog-hint">{t('setup.topicCounts', countsOf(poolFor(bank, [topic.id])))}</span>
                </label>
              ))}
            </fieldset>
          )}
        </fieldset>

        {noTopic && <p className="prog-hint exam-bad">{t('setup.noTopic')}</p>}
        {capped && <p className="prog-hint">{t('setup.capped', { count: pool.length })}</p>}
        {loading && (
          <p className="prog-hint" role="status">
            {t('setup.loading')}
          </p>
        )}
        {boxesError && (
          <div className="prog-error" role="alert">
            <TriangleAlert size={16} aria-hidden="true" />
            <p>{t('setup.boxesError')}</p>
          </div>
        )}

        <div className="reset-actions">
          <button ref={startRef} type="submit" className="btn btn-primary" disabled={!canStart}>
            <Play size={16} aria-hidden="true" />
            {t('setup.start')}
          </button>
        </div>
      </div>
    </form>
  )
}
