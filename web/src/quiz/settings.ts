import { useCallback, useState } from 'react'
import { z } from 'zod'
import type { TopicSelection } from './run'

export const QUIZ_SETTINGS_KEY = 'dpt.quiz.settings'
export const PRESET_LENGTHS = [5, 10, 25] as const
export const MAX_QUIZ_LENGTH = 100

export type QuizLength = (typeof PRESET_LENGTHS)[number] | 'custom'
export interface QuizSettings {
  length: QuizLength
  /** The Custom count, kept even while a preset is chosen. */
  custom: number
  topics: TopicSelection
}
export const DEFAULT_QUIZ_SETTINGS: QuizSettings = { length: 10, custom: 15, topics: 'all' }

const stored = z.strictObject({
  length: z.union([z.literal(5), z.literal(10), z.literal(25), z.literal('custom')]),
  custom: z.number().int().min(1).max(MAX_QUIZ_LENGTH),
  topics: z.union([z.literal('all'), z.array(z.string())]),
})

/**
 * The remembered settings (a device preference, like the theme). Unknown topics are dropped, and a list they emptied
 * falls back to all; "Choose topics" with nothing ticked stays an empty choice.
 */
export function loadQuizSettings(topicIds: ReadonlySet<string>): QuizSettings {
  try {
    const raw = localStorage.getItem(QUIZ_SETTINGS_KEY)
    if (raw === null) return DEFAULT_QUIZ_SETTINGS
    const s = stored.safeParse(JSON.parse(raw))
    if (!s.success) return DEFAULT_QUIZ_SETTINGS
    if (s.data.topics === 'all' || s.data.topics.length === 0) return s.data
    const topics = s.data.topics.filter((t) => topicIds.has(t))
    return { ...s.data, topics: topics.length === 0 ? 'all' : topics }
  } catch {
    return DEFAULT_QUIZ_SETTINGS
  }
}

export function saveQuizSettings(s: QuizSettings): void {
  try {
    localStorage.setItem(QUIZ_SETTINGS_KEY, JSON.stringify(s))
  } catch {
    // storage full or blocked: the setting just isn't remembered
  }
}

export function requestedLength(s: QuizSettings): number {
  return s.length === 'custom' ? s.custom : s.length
}

export function useQuizSettings(topicIds: ReadonlySet<string>): [QuizSettings, (s: QuizSettings) => void] {
  const [settings, setState] = useState(() => loadQuizSettings(topicIds))
  const set = useCallback((s: QuizSettings) => {
    setState(s)
    saveQuizSettings(s)
  }, [])
  return [settings, set]
}
