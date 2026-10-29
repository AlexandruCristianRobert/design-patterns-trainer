import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import type { Tone } from './inline'

export type CodeMark = { line: number; tone: Tone | 'concrete'; badge?: string; note?: string }

/** The badge a mark shows: the authored one, or "!" on a warn mark without one. */
function badgeOf(mark: CodeMark) {
  return mark.badge ?? (mark.tone === 'warn' ? '!' : undefined)
}

/**
 * Code with tinted lines, number badges at the line ends and short inline notes.
 * The notes are also listed under the code; CSS shows that list instead of the inline notes on narrow screens.
 * `wide` (the default) lets a top-level block use the whole column; pass `wide={false}` when nesting it.
 */
export function AnnotatedCode({
  code,
  marks = [],
  caption,
  wide = true,
}: {
  code: string
  marks?: CodeMark[]
  caption?: string
  wide?: boolean
}) {
  const lines = code.replace(/^\n/, '').replace(/\n$/, '').split('\n')
  for (const mark of marks) {
    if (mark.line < 1 || mark.line > lines.length) {
      throw new Error(`AnnotatedCode: mark on line ${mark.line}, but the code has ${lines.length} lines`)
    }
  }
  const noted = [...marks].sort((a, b) => a.line - b.line).filter((m) => m.note)
  return (
    <figure className={wide ? 'annotated-code lesson-wide' : 'annotated-code'}>
      <pre>
        <code>
          {lines.map((text, i) => {
            const mark = marks.find((m) => m.line === i + 1)
            const badge = mark && badgeOf(mark)
            return (
              <span key={i} className="code-line" data-tone={mark?.tone}>
                {text}
                {(badge || mark?.note) && (
                  <span className="code-annot">
                    <span className="sr-only"> (note </span>
                    {badge && (
                      <span className="code-badge" data-tone={mark.tone}>
                        {badge}
                      </span>
                    )}
                    {mark.note && (
                      <span className="code-note">
                        <span className="sr-only">: </span>
                        {mark.note}
                      </span>
                    )}
                    <span className="sr-only">)</span>
                  </span>
                )}
              </span>
            )
          })}
        </code>
      </pre>
      {noted.length > 0 && (
        <ul className="code-notes">
          {noted.map((mark) => (
            <li key={mark.line}>
              {badgeOf(mark) && (
                <span className="code-badge" data-tone={mark.tone}>
                  {badgeOf(mark)}
                </span>
              )}{' '}
              {mark.note}
            </li>
          ))}
        </ul>
      )}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}

/** Marks every list item after the first `count` as plain, so only those get a badge. */
function plainAfter(children: ReactNode, count: number): ReactNode {
  return Children.map(children, (list) => {
    if (!isValidElement<{ children?: ReactNode }>(list)) return list
    let n = 0
    const items = Children.map(list.props.children, (item) => {
      if (!isValidElement(item)) return item
      n += 1
      return n > count ? cloneElement(item as ReactElement<{ 'data-plain'?: string }>, { 'data-plain': 'true' }) : item
    })
    return cloneElement(list, undefined, items)
  })
}

/**
 * Wraps a Markdown ordered list so its numbers become round badges in the tone colour.
 * With `count`, only the first `count` items get a badge; the rest keep a plain marker.
 */
export function BadgeList({ tone, count, children }: { tone: Tone; count?: number; children: ReactNode }) {
  return (
    <div className="badge-list" data-tone={tone}>
      {count === undefined ? children : plainAfter(children, count)}
    </div>
  )
}
