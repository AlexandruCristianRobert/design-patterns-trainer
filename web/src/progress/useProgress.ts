import { useEffect, useState } from 'react'
import { getAllProgress, getProgress, subscribeProgress, type PatternProgress } from './progressStore'

function useStored<T>(load: () => Promise<T>, key: string): T | undefined {
  const [value, setValue] = useState<T>()
  useEffect(() => {
    let live = true
    const refresh = () =>
      void load().then(
        (v) => {
          if (live) setValue(v)
        },
        () => {},
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

export function usePatternProgress(patternId: string): PatternProgress | undefined {
  return useStored(() => getProgress(patternId), patternId)
}

export function useAllProgress(): PatternProgress[] | undefined {
  return useStored(getAllProgress, 'all')
}
