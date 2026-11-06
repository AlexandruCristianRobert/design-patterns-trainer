import type { ReactNode } from 'react'
import { inlineCode } from '../exercise/inlineCode'

const FENCE = /```[\w#+-]*\n([\s\S]*?)```/g

export function QuizCode({ code }: { code: string }) {
  return (
    <pre className="quiz-code">
      <code>{code.replace(/\n$/, '')}</code>
    </pre>
  )
}

/** Quiz content prose: blank-line paragraphs with `inline code`, plus fenced code blocks shown read-only. */
export function QuizText({ text }: { text: string }) {
  const out: ReactNode[] = []
  let key = 0
  const prose = (s: string) => {
    for (const para of s.split(/\n\s*\n/)) {
      const p = para.trim()
      if (p) out.push(<p key={key++}>{inlineCode(p)}</p>)
    }
  }
  let last = 0
  for (const m of text.matchAll(FENCE)) {
    prose(text.slice(last, m.index))
    out.push(<QuizCode key={key++} code={m[1]} />)
    last = m.index + m[0].length
  }
  prose(text.slice(last))
  return <>{out}</>
}
