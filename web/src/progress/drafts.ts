import { getDb } from './db'

export type DraftKey = `exercise:${string}/${string}` | `lesson:${string}`
export interface Draft {
  key: DraftKey
  code: string
  contentVersion: number
  updatedAt: string
}

/** Loads a Draft; `stale` is true when it was saved against a different content version (it is kept, never discarded). */
export async function loadDraft(key: DraftKey, currentVersion: number): Promise<{ draft: Draft; stale: boolean } | undefined> {
  const draft = await (await getDb()).get('drafts', key)
  return draft && { draft, stale: draft.contentVersion !== currentVersion }
}

export async function saveDraft(key: DraftKey, code: string, contentVersion: number): Promise<void> {
  await (await getDb()).put('drafts', { key, code, contentVersion, updatedAt: new Date().toISOString() })
}

export async function deleteDraft(key: DraftKey): Promise<void> {
  await (await getDb()).delete('drafts', key)
}
