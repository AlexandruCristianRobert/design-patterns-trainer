import type { ReactNode } from 'react'

/** Content prose marks code with `backticks`; render those spans as <code>. */
export function inlineCode(text: string): ReactNode[] {
  return text.split(/`([^`]+)`/).map((part, i) => (i % 2 === 1 ? <code key={i}>{part}</code> : part))
}
