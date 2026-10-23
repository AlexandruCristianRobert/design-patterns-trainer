import { createContext, useContext } from 'react'
import type { ExamWatch } from './useExamWatcher'

/** The Shell's one watcher, shared so pages read its phase instead of running a second one. */
export const ExamWatchContext = createContext<ExamWatch | null>(null)

const idle: ExamWatch = { session: undefined, remaining: null, phase: 'idle', cause: null, retry: () => undefined }

/** The Shell watcher's state; idle when no watcher is mounted (a page rendered on its own). */
export function useExamWatch(): ExamWatch {
  return useContext(ExamWatchContext) ?? idle
}
