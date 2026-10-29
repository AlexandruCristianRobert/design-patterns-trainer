import type { ReactNode } from 'react'
import type { Role as RoleKind } from '../../../content/schema'

/** A verdict colour: ok, bad or warn. Shared by the verdict and figure components. */
export type Tone = 'ok' | 'bad' | 'warn'

/** A participant name in prose, coloured by its role. */
export function Role({ kind, children }: { kind: RoleKind; children: ReactNode }) {
  return (
    <code className="role-tag" data-role={kind}>
      {children}
    </code>
  )
}

/** The phrase to remember. */
export function Key({ children }: { children: ReactNode }) {
  return <mark className="key-mark">{children}</mark>
}

/** An open slot a subclass fills in, drawn as a dashed contract box. */
export function Slot({ children }: { children: ReactNode }) {
  return <span className="slot">{children}</span>
}
