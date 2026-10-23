import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { lessonSectionIds, type LessonSectionId } from '../../content/lessons'

// A section counts as "in view" while it crosses a band in the upper part of the viewport (15%–45% from the top).
const BAND = '-15% 0px -55% 0px'

/**
 * Section links: a sticky left rail on desktop, a sticky horizontal strip on narrow screens. The entry of the
 * section in view is marked `aria-current="location"`; with two in the band, the earlier one wins.
 * `ready` turns true once the Lesson's sections are in the DOM, so they can be observed.
 */
export function LessonToc({ ready }: { ready: boolean }) {
  const { t } = useTranslation('lesson')
  const [active, setActive] = useState<LessonSectionId>(lessonSectionIds[0])
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    if (!ready || typeof IntersectionObserver === 'undefined') return
    const visible = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id)
          else visible.delete(e.target.id)
        }
        // Between sections (nothing in the band) the last one stays marked.
        const first = lessonSectionIds.find((id) => visible.has(id))
        if (first) setActive(first)
      },
      { rootMargin: BAND },
    )
    for (const id of lessonSectionIds) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [ready])

  // On the narrow strip, keep the marked entry scrolled into the strip.
  useEffect(() => {
    const link = listRef.current?.querySelector<HTMLElement>('[aria-current]')
    const list = listRef.current
    if (!link || !list || list.scrollWidth <= list.clientWidth) return
    list.scrollTo({ left: link.offsetLeft - list.clientWidth / 2 + link.offsetWidth / 2 })
  }, [active])

  return (
    <nav className="lesson-toc" aria-label={t('toc')}>
      <ol ref={listRef}>
        {lessonSectionIds.map((id) => (
          <li key={id}>
            <a href={`#${id}`} aria-current={active === id ? 'location' : undefined} onClick={() => setActive(id)}>
              {t(`sections.${id}`)}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
