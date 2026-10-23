import { useCallback, useEffect, useRef, useState } from 'react'
import { saveAnswer } from './examStore'
import type { ExamAnswer } from './types'

export const ANSWER_SAVE_DELAY_MS = 500

export interface ExamAnswerSaver {
  /** Saves `answer` for `questionKey` 500 ms after the last call. Switching to another question saves the pending one first. */
  schedule(questionKey: string, answer: ExamAnswer): void
  /**
   * Saves any pending answer now, and writes again every answer whose last save failed. Rejects when one still
   * can't be stored, so a submit never grades answers that weren't saved.
   */
  flush(): Promise<void>
  /** Some answer isn't stored yet because its save failed. Cleared when it is written. */
  saveError: boolean
}

/** Debounced `saveAnswer` for one session. Flushes on unmount and when the page is hidden; writes run in order. */
export function useExamAnswer(sessionId: string): ExamAnswerSaver {
  const [saveError, setSaveError] = useState(false)
  const pending = useRef<{ key: string; answer: ExamAnswer } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const chain = useRef<Promise<void>>(Promise.resolve())
  const alive = useRef(true)
  /** Latest answer per question whose most recent write failed. Writes are in order, so a later success clears it. */
  const failed = useRef(new Map<string, ExamAnswer>())

  const write = useCallback(
    (key: string, answer: ExamAnswer) => {
      const p = chain.current.then(() => saveAnswer(sessionId, key, answer))
      // The bookkeeping lives in the chain, so whoever awaits it sees the outcome.
      chain.current = p.then(
        () => {
          failed.current.delete(key)
          if (alive.current) setSaveError(failed.current.size > 0)
        },
        () => {
          failed.current.set(key, answer)
          if (alive.current) setSaveError(true)
        },
      )
      return p
    },
    [sessionId],
  )

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    timer.current = undefined
    const next = pending.current
    pending.current = null
    if (next) void write(next.key, next.answer).catch(() => undefined)
    await chain.current
    for (const [key, answer] of [...failed.current]) void write(key, answer).catch(() => undefined)
    await chain.current
    if (failed.current.size > 0) throw new Error('An answer could not be saved.')
  }, [write])

  const schedule = useCallback(
    (key: string, answer: ExamAnswer) => {
      const prev = pending.current
      if (prev && prev.key !== key) void write(prev.key, prev.answer).catch(() => undefined)
      // A newer answer for a question replaces its failed one.
      failed.current.delete(key)
      pending.current = { key, answer }
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        void flush().catch(() => undefined)
      }, ANSWER_SAVE_DELAY_MS)
    },
    [write, flush],
  )

  useEffect(() => {
    alive.current = true
    const hidden = () => {
      if (document.visibilityState === 'hidden') void flush().catch(() => undefined)
    }
    const leave = () => void flush().catch(() => undefined)
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', leave)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', leave)
      alive.current = false
      void flush().catch(() => undefined)
    }
  }, [flush])

  return { schedule, flush, saveError }
}
