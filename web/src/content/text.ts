import type { z } from 'zod'
import { parseContent, schemas } from './schema'
import type { ExamQuestionText, ExerciseText, PatternText } from './schema'

export interface Localized<T> { value: T; untranslated: boolean }

const files = import.meta.glob('../../../content/**/*.yaml', { eager: true, import: 'default' })
const prefix = '../../../content/'

/** Finds `<dir>/<name>.<lng>.yaml`, falling back to `en`; throws when even `en` is missing. */
export function loadText<T>(schema: z.ZodType<T>, dir: string, name: string, lng: string): Localized<T> {
  const path = (l: string) => `${prefix}${dir ? dir + '/' : ''}${name}.${l}.yaml`
  const exact = lng !== 'en' && path(lng) in files
  const file = exact ? path(lng) : path('en')
  if (!(file in files)) throw new Error(`${file}: missing file`)
  return { value: parseContent(schema, files[file], file), untranslated: lng !== 'en' && !exact }
}

export function getPatternText(id: string, lng: string): Localized<PatternText> {
  return loadText(schemas.patternText, `patterns/${id}`, 'text', lng)
}

export function getExerciseText(patternId: string, exerciseId: string, lng: string): Localized<ExerciseText> {
  return loadText(schemas.exerciseText, `patterns/${patternId}/exercises/${exerciseId}`, 'text', lng)
}

export function getExamQuestionText(key: string, lng: string): Localized<ExamQuestionText> {
  const [patternId, questionId] = key.split('/')
  return loadText(schemas.examQuestionText, `patterns/${patternId}/exam/${questionId}`, 'text', lng)
}
