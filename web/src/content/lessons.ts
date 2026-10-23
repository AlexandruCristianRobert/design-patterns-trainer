import type { MDXContent } from 'mdx/types'

/** Every Lesson has exactly these Sections, in this order (checked by content.test.ts). */
export const lessonSectionIds = ['problem', 'analogy', 'structure', 'interaction', 'example', 'when-to-use'] as const
export type LessonSectionId = (typeof lessonSectionIds)[number]

// Lazy: each Lesson is its own chunk, loaded when its page opens.
const lessons = import.meta.glob<{ default: MDXContent }>('../../../content/patterns/*/lesson.*.mdx')
const path = (patternId: string, lng: string) => `../../../content/patterns/${patternId}/lesson.${lng}.mdx`

/** Loads `lesson.<lng>.mdx`, falling back to `en` (then `untranslated`); undefined when the Pattern has no Lesson. */
export async function loadLesson(
  patternId: string,
  lng: string,
): Promise<{ Component: MDXContent; untranslated: boolean } | undefined> {
  const exact = path(patternId, lng) in lessons
  const load = lessons[exact ? path(patternId, lng) : path(patternId, 'en')]
  if (!load) return undefined
  const { default: Component } = await load()
  return { Component, untranslated: !exact }
}
