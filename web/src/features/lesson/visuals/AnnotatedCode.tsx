import type { ReactNode } from 'react'
import type { Tone } from './inline'

export type CodeMark = { line: number; tone: Tone | 'concrete'; badge?: string; note?: string }

/** Code with tinted lines, number badges at the line ends and short inline notes. */
export function AnnotatedCode({ code, marks = [], caption }: { code: string; marks?: CodeMark[]; caption?: string }) {
  const lines = code.replace(/^\n/, '').replace(/\n$/, '').split('\n')
  for (const mark of marks) {
    if (mark.line < 1 || mark.line > lines.length) {
      throw new Error(`AnnotatedCode: mark on line ${mark.line}, but the code has ${lines.length} lines`)
    }
  }
  return (
    <figure className="annotated-code lesson-wide">
      <pre>
        <code>
          {lines.map((text, i) => {
            const mark = marks.find((m) => m.line === i + 1)
            return (
              <span key={i} className="code-line" data-tone={mark?.tone}>
                {text}
                {mark?.badge && (
                  <span className="code-badge" data-tone={mark.tone}>
                    {mark.tone === 'warn' ? '!' : mark.badge}
                  </span>
                )}
                {mark?.note && <span className="code-note">{mark.note}</span>}
              </span>
            )
          })}
        </code>
      </pre>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}

/** Wraps a Markdown ordered list so its numbers become round badges in the tone colour. */
export function BadgeList({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <div className="badge-list" data-tone={tone}>
      {children}
    </div>
  )
}
