import { useId, type CSSProperties, type ReactNode } from 'react'
import type { Role } from '../../../content/schema'
import { LessonIcon, type LessonIconName } from './icons'
import type { Tone } from './inline'

/** A captioned drawing. The description is what screen readers get instead of the boxes. */
export function Figure({ caption, description, children }: { caption: string; description?: string; children: ReactNode }) {
  const id = useId()
  return (
    <figure className="lesson-figure lesson-wide" aria-labelledby={id}>
      <figcaption id={id}>{caption}</figcaption>
      {description && <p className="sr-only">{description}</p>}
      <div aria-hidden={description ? true : undefined}>{children}</div>
    </figure>
  )
}

/** A wrapping flex row; stacks on small screens. */
export function Row({ align = 'center', children }: { align?: 'center' | 'start'; children: ReactNode }) {
  return (
    <div className="fig-row" data-align={align}>
      {children}
    </div>
  )
}

/** A flex column. */
export function Stack({ align = 'center', children }: { align?: 'center' | 'stretch'; children: ReactNode }) {
  return (
    <div className="fig-stack" data-align={align}>
      {children}
    </div>
  )
}

/** A grid whose columns come from the MDX; `narrowCols` replaces them below 640px. */
export function Grid({ cols, narrowCols, children }: { cols: string; narrowCols?: string; children: ReactNode }) {
  const narrow = narrowCols ?? cols.replace(/\b\d+px\b/g, 'minmax(0, 70px)')
  const style = { '--cols': cols, '--narrow-cols': narrow } as CSSProperties
  return (
    <div className="fig-grid" style={style}>
      {children}
    </div>
  )
}

/** A bordered box, coloured by a role or a verdict, with an optional icon and sub line. */
export function Box({
  role,
  tone,
  icon,
  sub,
  mono = true,
  accent,
  children,
}: {
  role?: Role
  tone?: Tone
  icon?: LessonIconName
  sub?: string
  mono?: boolean
  accent?: boolean
  children?: ReactNode
}) {
  const cls = ['lesson-box', mono ? 'lesson-box-mono' : '', accent ? 'lesson-box-accent' : ''].filter(Boolean).join(' ')
  return (
    <div className={cls} data-role={role} data-tone={tone}>
      {icon && <LessonIcon name={icon} size={18} />}
      <div className="lesson-box-text">
        {children}
        {sub && <small>{sub}</small>}
      </div>
    </div>
  )
}

/** A line with a head and a small label. Decorative: the figure description carries the meaning. */
export function Arrow({ dir = 'right', label, dashed }: { dir?: 'right' | 'down'; label?: string; dashed?: boolean }) {
  return (
    <div className="fig-arrow" data-dir={dir} data-dashed={dashed ? 'true' : undefined} aria-hidden="true">
      {label && <span>{label}</span>}
    </div>
  )
}

/** A bordered card with a role-tinted header strip. */
export function Card({ title, role, icon, children }: { title: string; role?: Role; icon?: LessonIconName; children?: ReactNode }) {
  return (
    <div className="fig-card" data-role={role}>
      <div className="fig-card-head">
        {icon && <LessonIcon name={icon} size={16} />}
        <span>{title}</span>
      </div>
      <div className="fig-card-body">{children}</div>
    </div>
  )
}

/** One timeline row: a label, then a baseline with a dot at each position (percent). */
export function Track({
  label,
  dots,
  caption,
  tone = 'concrete',
}: {
  label: string
  dots: number[]
  caption: string
  tone?: 'concrete' | 'contract'
}) {
  return (
    <div className="fig-track" data-role={tone}>
      <span className="track-label">{label}</span>
      <div className="track-line">
        <span className="track-caption">{caption}</span>
        {dots.map((d) => (
          <span key={d} className="track-dot" style={{ left: `${d}%` }} />
        ))}
      </div>
    </div>
  )
}

/** A numbered card: number, title and text, with an aside figure beside (or below) them. */
export function Point({ n, title, aside, children }: { n: number; title: string; aside: ReactNode; children?: ReactNode }) {
  return (
    <div className="fig-point">
      <span className="point-num">{n}</span>
      <div className="point-text">
        <p className="point-title">{title}</p>
        {children}
      </div>
      <div className="point-aside">{aside}</div>
    </div>
  )
}
