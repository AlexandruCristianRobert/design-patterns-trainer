import { useCallback, useEffect, useRef, useState } from 'react'
import { loadDraft, saveDraft, type DraftKey } from '../progress/drafts'

const AUTOSAVE_MS = 500

export interface DraftState {
  code: string
  setCode(c: string): void
  /** The loaded Draft was written for another content version. It stays stale until `reset`. */
  stale: boolean
  /**
   * False while the stored Draft is being read; always true when `key` is null. Keep the editor read-only until it
   * is true (`<CodePanel readOnly={!loaded} />`): edits made earlier win over the stored Draft, which is then not shown.
   */
  loaded: boolean
  /** The last save failed (storage full or unavailable); cleared by the next successful save. */
  saveError: boolean
  /** Replaces the code (e.g. with the starter code), clears `stale` and saves at once. */
  reset(to: string): void
}

interface Doc {
  id: string
  code: string
  stale: boolean
}

interface Pending {
  timer: ReturnType<typeof setTimeout>
  key: DraftKey
  version: number
  code: string
}

/**
 * Editor code backed by a Draft: loads it for `key`, autosaves 500 ms after the last change. `key` null = no
 * persistence. Changing `key` or `contentVersion` saves any pending edit under the old ones, then starts again from
 * `initial` until the new Draft has loaded.
 */
export function useDraft(key: DraftKey | null, initial: string, contentVersion: number): DraftState {
  const id = `${key ?? ''}@${contentVersion}`
  const [doc, setDoc] = useState<Doc>({ id, code: initial, stale: false })
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState(false)

  // New key or version: drop the previous Exercise's code during render so it is never shown (or saved) under this one.
  let current = doc
  if (doc.id !== id) {
    current = { id, code: initial, stale: false }
    setDoc(current)
  }
  const loaded = key === null || loadedId === id

  // A stale Draft keeps its own version when autosaved, so it is still flagged after a reload.
  const saveVersion = useRef(contentVersion)
  const pending = useRef<Pending | null>(null)
  const touchedId = useRef<string | null>(null)

  const save = useCallback((k: DraftKey, code: string, version: number) => {
    saveDraft(k, code, version).then(
      () => setSaveError(false),
      () => setSaveError(true),
    )
  }, [])

  // Saves under the key and version the edit was made for, not the current ones.
  const flush = useCallback(() => {
    const p = pending.current
    if (!p) return
    clearTimeout(p.timer)
    pending.current = null
    save(p.key, p.code, p.version)
  }, [save])

  useEffect(() => {
    saveVersion.current = contentVersion
    if (key === null) return
    let active = true
    loadDraft(key, contentVersion).then(
      (found) => {
        if (!active) return
        if (found && touchedId.current !== id) {
          setDoc((d) => (d.id === id ? { id, code: found.draft.code, stale: found.stale } : d))
          saveVersion.current = found.draft.contentVersion
        }
        setLoadedId(id)
      },
      () => {
        // Unreadable storage: carry on from `initial`; saves report through saveError.
        if (active) setLoadedId(id)
      },
    )
    return () => {
      active = false
    }
  }, [key, contentVersion, id])

  // Never lose the last keystrokes: a pending save runs at once when the key or version changes, or on unmount.
  useEffect(() => flush, [key, contentVersion, flush])

  const setCode = useCallback(
    (c: string) => {
      touchedId.current = id
      setDoc((d) => (d.id === id ? { ...d, code: c } : { id, code: c, stale: false }))
      if (key === null) return
      if (pending.current) clearTimeout(pending.current.timer)
      pending.current = { key, version: saveVersion.current, code: c, timer: setTimeout(flush, AUTOSAVE_MS) }
    },
    [id, key, flush],
  )

  const reset = useCallback(
    (to: string) => {
      touchedId.current = id
      if (pending.current) clearTimeout(pending.current.timer)
      pending.current = null
      setDoc({ id, code: to, stale: false })
      saveVersion.current = contentVersion
      if (key !== null) save(key, to, contentVersion)
    },
    [id, key, contentVersion, save],
  )

  return { code: current.code, setCode, stale: current.stale, loaded, saveError, reset }
}
