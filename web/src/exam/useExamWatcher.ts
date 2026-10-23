import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useCompiler } from '../compiler/CompilerProvider'
import { subscribeProgress } from '../progress/progressStore'
import { isExpired, remainingMs } from './deadline'
import { getInProgressSession } from './examStore'
import { submitExam } from './submitExam'
import type { ExamSession } from './types'

/** After a failed automatic submit, wait this long before trying again by itself. */
export const RETRY_AFTER_MS = 30_000

export interface ExamWatch {
  /** The in-progress session, if any. */
  session: ExamSession | undefined
  /** Milliseconds left; null when untimed or when there is no session. */
  remaining: number | null
  phase: 'idle' | 'submitting' | 'failed'
  /** Try the automatic submit again now. */
  retry: () => void
}

/**
 * Mounted once in the Shell. Reads the in-progress session on mount and whenever progress changes; the 1 s tick runs
 * only while a timed session exists, so pages are untouched otherwise. An expired session is submitted by the timer
 * (once per session: `submitExam` shares one grading per id), and the learner is taken to the report if they are on
 * that session's page. Grading waits for the compiler: without it every answer would score 0.
 */
export function useExamWatcher(): ExamWatch {
  const { status, compiler, runner } = useCompiler()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [session, setSession] = useState<ExamSession | undefined>()
  const [now, setNow] = useState(() => Date.now())
  const [phase, setPhase] = useState<ExamWatch['phase']>('idle')

  const latest = useRef({ pathname, navigate, compiler, runner })
  useEffect(() => {
    latest.current = { pathname, navigate, compiler, runner }
  })
  const busy = useRef(false)
  const failedAt = useRef<number | null>(null)
  const done = useRef(new Set<string>())

  useEffect(() => {
    let live = true
    const load = () =>
      void getInProgressSession().then(
        (s) => {
          if (!live) return
          setNow(Date.now())
          setSession(s)
        },
        () => {
          // Storage can't be read: there is nothing to watch, and the pages report their own storage errors.
        },
      )
    load()
    const off = subscribeProgress(load)
    return () => {
      live = false
      off()
    }
  }, [])

  const attempt = useCallback(async (s: ExamSession, manual: boolean) => {
    if (busy.current || done.current.has(s.id)) return
    if (!manual && failedAt.current !== null && Date.now() - failedAt.current < RETRY_AFTER_MS) return
    busy.current = true
    setPhase('submitting')
    try {
      const { compiler, runner } = latest.current
      await submitExam(s.id, 'timer', { compiler, runner })
      failedAt.current = null
      done.current.add(s.id)
      setPhase('idle')
      const { pathname, navigate } = latest.current
      if (pathname === `/exam/${s.id}`) navigate(`/exam/${s.id}/report`)
    } catch {
      failedAt.current = Date.now()
      setPhase('failed')
    } finally {
      busy.current = false
    }
  }, [])

  const timed = session?.deadline != null
  useEffect(() => {
    if (!session || !timed || status !== 'ready') return
    const check = () => {
      const t = Date.now()
      setNow(t)
      if (isExpired(session, t)) void attempt(session, false)
    }
    check()
    const id = setInterval(check, 1000)
    return () => clearInterval(id)
  }, [session, timed, status, attempt])

  // The tick above also keeps `now` fresh while the compiler is still starting.
  useEffect(() => {
    if (!session || !timed || status === 'ready') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [session, timed, status])

  const retry = useCallback(() => {
    if (session) void attempt(session, true)
  }, [session, attempt])

  return { session, remaining: session ? remainingMs(session, now) : null, phase: session ? phase : 'idle', retry }
}
