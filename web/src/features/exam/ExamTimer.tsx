import { Timer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { remainingMs } from '../../exam/deadline'
import { formatRemaining } from '../../exam/formatTime'

const FIVE_MIN = 5 * 60_000
const ONE_MIN = 60_000

/**
 * Time left, from the wall clock (so a slept laptop or a background tab is never wrong). Announces once at 5:00 and
 * once at 1:00, skipping any threshold already passed when the page opened. Calls `onExpire` once at zero.
 */
export function ExamTimer({ deadline, onExpire }: { deadline: string | null; onExpire(): void }) {
  const { t } = useTranslation('exam')
  const [now, setNow] = useState(() => Date.now())
  const [announcement, setAnnouncement] = useState('')
  const remaining = remainingMs({ deadline }, now)
  const announced = useRef<{ five: boolean; one: boolean } | null>(null)
  const expired = useRef(false)
  const onExpireRef = useRef(onExpire)
  useEffect(() => {
    onExpireRef.current = onExpire
  })

  useEffect(() => {
    if (deadline === null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [deadline])

  useEffect(() => {
    if (remaining === null) return
    announced.current ??= { five: remaining <= FIVE_MIN, one: remaining <= ONE_MIN }
    const a = announced.current
    if (remaining <= ONE_MIN && !a.one) {
      a.one = true
      a.five = true
      setAnnouncement(t('session.timer.one'))
    } else if (remaining <= FIVE_MIN && !a.five) {
      a.five = true
      setAnnouncement(t('session.timer.five'))
    }
    if (remaining === 0 && !expired.current) {
      expired.current = true
      onExpireRef.current()
    }
  }, [remaining, t])

  if (remaining === null) {
    return (
      <p className="exam-timer exam-timer-off">
        <Timer size={16} aria-hidden="true" />
        <span>{t('session.timer.untimed')}</span>
      </p>
    )
  }
  return (
    <>
      <div className={`exam-timer${remaining <= FIVE_MIN ? ' exam-timer-low' : ''}`} role="timer" aria-label={t('session.timer.label')}>
        <Timer size={16} aria-hidden="true" />
        <span>{formatRemaining(remaining)}</span>
      </div>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </>
  )
}
