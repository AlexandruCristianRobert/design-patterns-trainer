import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getQuizBank } from '../../content/quiz'
import { getBoxes, saveQuizResult } from '../../quiz/quizStore'
import { pickRun, type AnswerRecord, type StartedRun } from '../../quiz/run'
import { QuizEnd } from './QuizEnd'
import { QuizHistory } from './QuizHistory'
import { QuizRun } from './QuizRun'
import { QuizSetup } from './QuizSetup'

type Phase =
  | { kind: 'setup' }
  | { kind: 'run'; run: StartedRun; key: number }
  | { kind: 'end'; run: StartedRun; answers: AnswerRecord[]; saveFailed: boolean }

/** Setup → run → end, held in memory: leaving or reloading ends a Quiz (spec §5). */
export function QuizPage() {
  const { t } = useTranslation('quiz')
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' })
  const runs = useRef(0)

  const begin = (run: StartedRun) => setPhase({ kind: 'run', run, key: ++runs.current })

  async function finish(run: StartedRun, answers: AnswerRecord[]) {
    let saveFailed = false
    try {
      await saveQuizResult({ takenAt: new Date().toISOString(), topics: run.topics, total: answers.length, correct: answers.filter((a) => a.correct).length })
    } catch {
      saveFailed = true
    }
    setPhase({ kind: 'end', run, answers, saveFailed })
  }

  async function again(run: StartedRun) {
    const boxes = await getBoxes().catch(() => new Map())
    begin(pickRun(getQuizBank(), run.topics, run.questions.length, boxes, new Date(), Math.random))
  }

  return (
    <div className="quiz-page">
      <header className="page-head">
        <h1 className="page-title">{t('title')}</h1>
        {phase.kind === 'setup' && <p className="page-intro">{t('intro')}</p>}
      </header>
      {phase.kind === 'setup' && (
        <>
          <QuizSetup onStart={begin} />
          <QuizHistory />
        </>
      )}
      {phase.kind === 'run' && (
        <QuizRun key={phase.key} questions={phase.run.questions} onFinish={(a) => void finish(phase.run, a)} onQuit={() => setPhase({ kind: 'setup' })} />
      )}
      {phase.kind === 'end' && (
        <QuizEnd answers={phase.answers} saveFailed={phase.saveFailed} onNew={() => void again(phase.run)} onBack={() => setPhase({ kind: 'setup' })} />
      )}
    </div>
  )
}
