import { useCallback, useEffect, useRef, useState } from 'react'
import { saveAnswer } from './examStore'
import type { ExamAnswer } from './types'

export const ANSWER_SAVE_DELAY_MS = 500

export interface ExamAnswerSaver {
  /** Saves `answer` for `questionKey` 500 ms after the last call. Switching to another question saves the pending one first. */
  schedule(questionKey: string, answer: ExamAnswer): void
  /** Saves any pending answer now. Rejects when a save failed, so a submit never grades answers that weren't stored. */
  flush(): Promise<void>
  /** The latest save failed. Cleared by the next one that works. */
  saveError: boolean
}

/** Debounced `saveAnswer` for one session. Flushes on unmount; writes happen one after another, in order. */
export function useExamAnswer(sessionId: string): ExamAnswerSaver {
  const [saveError, setSaveError] = useState(false)
  const pending = useRef<{ key: string; answer: ExamAnswer } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const chain = useRef<Promise<void>>(Promise.resolve())
  const alive = useRef(true)
  const failed = useRef(false)

  const write = useCallback(
    (key: string, answer: ExamAnswer) => {
      const p = chain.current.then(() => saveAnswer(sessionId, key, answer))
      // Later writes still run after a failed one.
      chain.current = p.then(
        () => undefined,
        () => undefined,
      )
      p.then(
        () => {
          failed.current = false
          if (alive.current) setSaveError(false)
        },
        () => {
          failed.current = true
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
    // Wait for earlier writes as well, whether or not something new is pending.
    if (next) await write(next.key, next.answer)
    else {
      await chain.current
      if (failed.current) throw new Error('An answer could not be saved.')
    }
  }, [write])

  const schedule = useCallback(
    (key: string, answer: ExamAnswer) => {
      const prev = pending.current
      if (prev && prev.key !== key) void write(prev.key, prev.answer).catch(() => undefined)
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
    return () => {
      alive.current = false
      void flush().catch(() => undefined)
    }
  }, [flush])

  return { schedule, flush, saveError }
}
