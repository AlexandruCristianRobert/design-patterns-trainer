import { createContext, useContext } from 'react'
import type { PatternContent } from '../../content/patterns'
import type { PatternText } from '../../content/schema'

export interface LessonData {
  patternId: string
  pattern: PatternContent
  text: PatternText
  lng: string
}

/** What the MDX components (`<StructureDiagram />`, `<LessonExample />`…) need, so lessons don't pass any props. */
export const LessonDataContext = createContext<LessonData | null>(null)

export function useLessonData(): LessonData {
  const value = useContext(LessonDataContext)
  if (!value) throw new Error('Lesson components must be rendered inside the Lesson page')
  return value
}
