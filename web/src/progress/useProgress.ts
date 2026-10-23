import { useEffect, useState } from 'react'
import { getAllProgress, getProgress, subscribeProgress, type PatternProgress } from './progressStore'

/**
 * Stored progress as a page sees it. Loading: `data` undefined and `error` false. `error` true: the store couldn't be
 * read (storage blocked or broken), so the page must work without it. `data` keeps the last value that did load.
 */
export interface Stored<T> {
  data: T | undefined
  error: boolean
}

function useStored<T>(load: () => Promise<T>, key: string): Stored<T> {
  const [value, setValue] = useState<Stored<T>>({ data: undefined, error: false })
  useEffect(() => {
    let live = true
    const refresh = () =>
      void load().then(
        (data) => {
          if (live) setValue({ data, error: false })
        },
        () => {
          if (live) setValue((v) => ({ data: v.data, error: true }))
        },
      )
    refresh()
    const off = subscribeProgress(refresh)
    return () => {
      live = false
      off()
    }
    // `load` is derived from `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return value
}

export function usePatternProgress(patternId: string): Stored<PatternProgress> {
  return useStored(() => getProgress(patternId), patternId)
}

export function useAllProgress(): Stored<PatternProgress[]> {
  return useStored(getAllProgress, 'all')
}
