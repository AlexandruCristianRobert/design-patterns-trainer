import { parseContent, schemas, type QuizVisualMeta } from './schema'

const root = '../../../content/quiz/visuals/'
const files = import.meta.glob('../../../content/quiz/visuals/*.en.yaml', { eager: true, import: 'default' })

export type QuizVisual = QuizVisualMeta

let all: Map<string, QuizVisual> | undefined

/** Every Question Visual, keyed by Quiz Question id. The file name must be the question id. */
export function getQuizVisuals(): Map<string, QuizVisual> {
  if (all) return all
  all = new Map()
  for (const [path, data] of Object.entries(files)) {
    const id = path.slice(root.length).replace(/\.en\.yaml$/, '')
    const file = `content/quiz/visuals/${id}.en.yaml`
    const visual = parseContent(schemas.quizVisual, data, file)
    if (visual.question !== id) throw new Error(`${file}: question "${visual.question}" does not match the file name`)
    all.set(id, visual)
  }
  return all
}

export const getQuizVisual = (questionId: string): QuizVisual | undefined => getQuizVisuals().get(questionId)
