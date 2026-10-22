import { useCallback, useEffect, useRef, useState } from 'react'
import { loadDraft, saveDraft, type DraftKey } from '../progress/drafts'

const AUTOSAVE_MS = 500

export interface DraftState {
  code: string
  setCode(c: string): void
  /** The loaded Draft was written for another content version. It stays stale until `reset`. */
  stale: boolean
  /** False while the stored Draft is being read; always true when `key` is null. */
  loaded: boolean
  /** Replaces the code (e.g. with the starter code), clears `stale` and saves at once. */
  reset(to: string): void
}

/** Editor code backed by a Draft: loads it for `key`, autosaves 500 ms after the last change. `key` null = no persistence. */
export function useDraft(key: DraftKey | null, initial: string, contentVersion: number): DraftState {
  const [code, setCodeState] = useState(initial)
  const [stale, setStale] = useState(false)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const loaded = key === null || loadedKey === `${key}@${contentVersion}`

  // A stale Draft keeps its own version when autosaved, so it is still flagged after a reload.
  const saveVersion = useRef(contentVersion)
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; code: string } | null>(null)
  const touched = useRef(false)

  const flush = useCallback(() => {
    const p = pending.current
    if (!p || key === null) return
    clearTimeout(p.timer)
    pending.current = null
    void saveDraft(key, p.code, saveVersion.current)
  }, [key])

  useEffect(() => {
    touched.current = false
    saveVersion.current = contentVersion
    if (key === null) return
    let active = true
    void loadDraft(key, contentVersion).then((found) => {
      if (!active) return
      if (found && !touched.current) {
        setCodeState(found.draft.code)
        setStale(found.stale)
        saveVersion.current = found.draft.contentVersion
      }
      setLoadedKey(`${key}@${contentVersion}`)
    })
    return () => {
      active = false
    }
  }, [key, contentVersion])

  // Never lose the last keystrokes: a pending save runs immediately when the key changes or the page unmounts.
  useEffect(() => flush, [flush])

  const setCode = useCallback(
    (c: string) => {
      touched.current = true
      setCodeState(c)
      if (key === null) return
      if (pending.current) clearTimeout(pending.current.timer)
      pending.current = { code: c, timer: setTimeout(flush, AUTOSAVE_MS) }
    },
    [key, flush],
  )

  const reset = useCallback(
    (to: string) => {
      touched.current = true
      if (pending.current) clearTimeout(pending.current.timer)
      pending.current = null
      setCodeState(to)
      setStale(false)
      saveVersion.current = contentVersion
      if (key !== null) void saveDraft(key, to, contentVersion)
    },
    [key, contentVersion],
  )

  return { code, setCode, stale, loaded, reset }
}
