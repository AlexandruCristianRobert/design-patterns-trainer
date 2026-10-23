import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/** A Lesson Section: `<section id aria-labelledby>` under its localized heading (`lesson.json` → `sections.<id>`). */
export function Section({ id, children }: { id: string; children?: ReactNode }) {
  const { t } = useTranslation('lesson')
  const headingId = `${id}-heading`
  return (
    <section id={id} className="lesson-section" aria-labelledby={headingId}>
      <h2 id={headingId} className="lesson-h2">
        {t(`sections.${id}`)}
      </h2>
      {children}
    </section>
  )
}
