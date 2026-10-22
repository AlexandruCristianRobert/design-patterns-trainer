import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type Lines = [number, number] | null

interface LinkedLines {
  lines: Lines
  link(lines: Lines): void
}

const noLink: LinkedLines = { lines: null, link: () => {} }
const LessonContext = createContext<LinkedLines>(noLink)

/** Shares the code lines a visual points at (a hovered class, the current scene step) with the Lesson example. */
export function LessonProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<Lines>(null)
  // Keep the current tuple when the range is unchanged so consumers don't re-highlight.
  const link = useCallback(
    (next: Lines) => setLines((cur) => (cur?.[0] === next?.[0] && cur?.[1] === next?.[1] ? cur : next)),
    [],
  )
  const value = useMemo<LinkedLines>(() => ({ lines, link }), [lines, link])
  return <LessonContext.Provider value={value}>{children}</LessonContext.Provider>
}

/** Outside a LessonProvider this is inert: `lines` stays null and `link` does nothing. */
export function useLinkedLines(): LinkedLines {
  return useContext(LessonContext)
}
