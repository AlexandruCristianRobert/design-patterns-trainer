import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { PatternProgress } from './progressStore'
import type { Draft } from './drafts'

export const DB_NAME = 'design-patterns-trainer'

interface TrainerDB extends DBSchema {
  progress: { key: string; value: PatternProgress }
  drafts: { key: string; value: Draft }
}
export type TrainerDatabase = IDBPDatabase<TrainerDB>

let dbPromise: Promise<TrainerDatabase> | undefined

/** Opens (once) the trainer database. Rejects with a clear Error when IndexedDB is unavailable or blocked. */
export function getDb(): Promise<TrainerDatabase> {
  if (dbPromise) return dbPromise
  const p = (async () => {
    if (typeof indexedDB === 'undefined') throw new Error('Local storage (IndexedDB) is not available in this browser.')
    try {
      return await openDB<TrainerDB>(DB_NAME, 1, {
        upgrade(db) {
          db.createObjectStore('progress', { keyPath: 'patternId' })
          db.createObjectStore('drafts', { keyPath: 'key' })
        },
        blocked() {
          throw new Error('Local storage is blocked by another open tab.')
        },
      })
    } catch (cause) {
      throw new Error(`Could not open local storage: ${cause instanceof Error ? cause.message : String(cause)}`, { cause })
    }
  })()
  dbPromise = p
  p.catch(() => {
    if (dbPromise === p) dbPromise = undefined
  })
  return p
}

/** Test helper: closes the connection and deletes the database. */
export async function resetDbForTests(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise.catch(() => undefined)
    db?.close()
    dbPromise = undefined
  }
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase(DB_NAME)
    r.onsuccess = () => resolve()
    r.onerror = () => reject(r.error)
  })
}
