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
  /** Why the phase is `failed`: grading couldn't be saved, or the C# engine never started. */
  cause: 'storage' | 'compiler' | null
  /** Try the automatic submit again now. */
  retry: () => void
}

/**
 * Mounted once in the Shell. Reads the in-progress session on mount and whenever progress changes; the 1 s tick runs
 * only while a timed session exists, so pages are untouched otherwise. An expired session is submitted by the timer
 * (once per session: `submitExam` shares one grading per id), except while the session's own page is open, which submits
 * for itself. Grading waits for the compiler: without it every answer would score 0.
 */
export function useExamWatcher(): ExamWatch {
  const { status, compiler, runner } = useCompiler()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [session, setSession] = useState<ExamSession | undefined>()
  const [now, setNow] = useState(() => Date.now())
  // Keyed by session id, so a failure never carries over to the next exam.
  const [run, setRun] = useState<{ id: string; phase: 'submitting' | 'failed' } | null>(null)

  const latest = useRef({ pathname, navigate, compiler, runner })
  useEffect(() => {
    latest.current = { pathname, navigate, compiler, runner }
  })
  const busy = useRef(false)
  const failedAt = useRef<{ id: string; at: number } | null>(null)
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
    if (!manual && failedAt.current?.id === s.id && Date.now() - failedAt.current.at < RETRY_AFTER_MS) return
    busy.current = true
    setRun({ id: s.id, phase: 'submitting' })
    try {
      const { compiler, runner } = latest.current
      await submitExam(s.id, 'timer', { compiler, runner })
      if (failedAt.current?.id === s.id) failedAt.current = null
      done.current.add(s.id)
      setRun((r) => (r?.id === s.id ? null : r))
      const { pathname, navigate } = latest.current
      if (pathname === '/exam' || pathname === `/exam/${s.id}`) navigate(`/exam/${s.id}/report`)
    } catch {
      failedAt.current = { id: s.id, at: Date.now() }
      setRun({ id: s.id, phase: 'failed' })
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
      // The session's own page owns the submit while it is open: it flushes the last keystrokes first.
      if (isExpired(session, t) && latest.current.pathname !== `/exam/${session.id}`) void attempt(session, false)
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

  const compilerDown = status === 'failed' && session !== undefined && isExpired(session, now)
  const own = session && run?.id === session.id ? run.phase : 'idle'
  const phase = compilerDown ? 'failed' : own
  return {
    session,
    remaining: session ? remainingMs(session, now) : null,
    phase,
    cause: phase !== 'failed' ? null : compilerDown ? 'compiler' : 'storage',
    retry,
  }
}
