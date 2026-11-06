import { parseContent, schemas, type QuizQuestionMeta, type QuizTopicMeta } from './schema'

const root = '../../../content/quiz/'
const topicsFile = import.meta.glob('../../../content/quiz/topics.yaml', { eager: true, import: 'default' })
const topicFiles = import.meta.glob('../../../content/quiz/*.en.yaml', { eager: true, import: 'default' })

export type QuizTopic = QuizTopicMeta
export type QuizOption = QuizQuestionMeta['options'][number]
export type QuizQuestion = QuizQuestionMeta & { topicId: string }

let topics: QuizTopic[] | undefined
let bank: QuizQuestion[] | undefined

/** The fixed Quiz Topic list, in display order. */
export function getQuizTopics(): QuizTopic[] {
  topics ??= parseContent(schemas.quizTopics, topicsFile[`${root}topics.yaml`], 'content/quiz/topics.yaml')
  return topics
}

/** Topic ids that have a `<id>.en.yaml` file (the validator compares these with topics.yaml). */
export function getQuizFileIds(): string[] {
  return Object.keys(topicFiles).map((f) => f.slice(root.length).replace(/\.en\.yaml$/, ''))
}

/** Every Quiz Question, in topic order, then file order. A topic without a file has no questions. */
export function getQuizBank(): QuizQuestion[] {
  if (bank) return bank
  bank = getQuizTopics().flatMap((t) => {
    const path = `${root}${t.id}.en.yaml`
    if (!(path in topicFiles)) return []
    return parseContent(schemas.quizFile, topicFiles[path], `content/quiz/${t.id}.en.yaml`).map((q) => ({ ...q, topicId: t.id }))
  })
  return bank
}
