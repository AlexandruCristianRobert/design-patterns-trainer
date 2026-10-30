import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LessonIcon } from './LessonIcon'
import type { LessonIconName } from './icons'

/** The one sentence to remember, in a box with an accent edge. */
export function KeyIdea({ children }: { children: ReactNode }) {
  const { t } = useTranslation('lesson')
  return (
    <aside aria-label={t('visual.keyIdea')} className="lesson-callout key-idea">
      <LessonIcon name="lightbulb" />
      <div>
        <span className="key-idea-label" aria-hidden="true">
          {t('visual.keyIdea')}
        </span>
        {children}
      </div>
    </aside>
  )
}

/** A short aside with an icon of the author's choosing. */
export function Note({ icon, children }: { icon: LessonIconName; children: ReactNode }) {
  return (
    <div className="lesson-callout">
      <LessonIcon name={icon} />
      <div>{children}</div>
    </div>
  )
}

/** A mistake to avoid, headed by its title. */
export function Pitfall({ title, level = 4, children }: { title: string; level?: 3 | 4 | 5; children: ReactNode }) {
  const Heading = `h${level}` as const
  return (
    <div className="lesson-callout pitfall">
      <LessonIcon name="warning" />
      <div>
        <Heading>{title}</Heading>
        {children}
      </div>
    </div>
  )
}
