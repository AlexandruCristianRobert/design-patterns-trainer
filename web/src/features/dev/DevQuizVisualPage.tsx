import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { getQuizBank, getQuizTopics, type QuizQuestion } from '../../content/quiz'
import { getQuizVisual, getQuizVisuals } from '../../content/quizVisuals'
import type { RunQuestion } from '../../quiz/run'
import { QuizRun } from '../quiz/QuizRun'

// Dev-only harness (registered only when import.meta.env.DEV) for reviewing one Question Visual: its question with
// Options in file order, then a question without a visual. Answers are not recorded, so Boxes stay untouched.
const asRun = (q: QuizQuestion): RunQuestion => ({ question: q, topicTitle: getQuizTopics().find((t) => t.id === q.topicId)?.title ?? q.topicId, options: q.options })

export function DevQuizVisualPage() {
  const { id } = useParams()
  const [round, setRound] = useState(0)
  if (!id) {
    return (
      <ul>
        {[...getQuizVisuals().keys()].map((v) => (
          <li key={v}><Link to={`/dev/quiz-visual/${v}`}>{v}</Link></li>
        ))}
      </ul>
    )
  }
  const bank = getQuizBank()
  const q = bank.find((x) => x.id === id)
  if (!q || !getQuizVisual(id)) return <p>No Question Visual for “{id}”.</p>
  const plain = bank.find((x) => !getQuizVisual(x.id))!
  return (
    <div className="quiz-page is-running">
      <p hidden data-testid="dev-correct">{q.options.findIndex((o) => o.correct)}</p>
      <QuizRun key={round} questions={[asRun(q), asRun(plain)]} onFinish={() => setRound((r) => r + 1)} onQuit={() => setRound((r) => r + 1)} record={async () => null} />
    </div>
  )
}
