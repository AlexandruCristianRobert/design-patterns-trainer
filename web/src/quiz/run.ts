import type { QuizOption, QuizQuestion, QuizTopic } from '../content/quiz'
import { getQuizTopics } from '../content/quiz'
import { selectQuiz, shuffle, type BoxRecord } from './leitner'

export type TopicSelection = 'all' | string[]
export interface RunQuestion {
  question: QuizQuestion
  topicTitle: string
  /** The four Options in display order (A–D). */
  options: QuizOption[]
}
export interface StartedRun {
  questions: RunQuestion[]
  topics: TopicSelection
}
export interface AnswerRecord {
  questionId: string
  topicId: string
  correct: boolean
}

export function poolFor(bank: QuizQuestion[], topics: TopicSelection): QuizQuestion[] {
  return topics === 'all' ? bank : bank.filter((q) => topics.includes(q.topicId))
}

/** Picks `count` questions from the selected topics (spec §4) and shuffles each one's Options. */
export function pickRun(
  bank: QuizQuestion[],
  topics: TopicSelection,
  count: number,
  boxes: ReadonlyMap<string, BoxRecord>,
  now: Date,
  rng: () => number,
  topicList: QuizTopic[] = getQuizTopics(),
): StartedRun {
  const pool = poolFor(bank, topics)
  const byId = new Map(pool.map((q) => [q.id, q]))
  const titles = new Map(topicList.map((t) => [t.id, t.title]))
  const questions = selectQuiz([...byId.keys()], boxes, count, now, rng).map((id) => {
    const question = byId.get(id)!
    return { question, topicTitle: titles.get(question.topicId) ?? question.topicId, options: shuffle(question.options, rng) }
  })
  return { questions, topics }
}

/** This Quiz's score per Quiz Topic, in topic order; topics without answers are left out. Shown, never stored. */
export function topicBreakdown(answers: AnswerRecord[], topics: QuizTopic[]) {
  return topics
    .map((t) => {
      const mine = answers.filter((a) => a.topicId === t.id)
      return { topicId: t.id, title: t.title, correct: mine.filter((a) => a.correct).length, total: mine.length }
    })
    .filter((r) => r.total > 0)
}
