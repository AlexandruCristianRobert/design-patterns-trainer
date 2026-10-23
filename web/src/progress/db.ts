import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { PatternProgress } from './progressStore'
import type { Draft } from './drafts'
import type { ExamSession } from '../exam/types'

export const DB_NAME = 'design-patterns-trainer'
export const DB_VERSION = 2

interface TrainerDB extends DBSchema {
  progress: { key: string; value: PatternProgress }
  drafts: { key: string; value: Draft }
  examSessions: { key: string; value: ExamSession }
}
export type TrainerDatabase = IDBPDatabase<TrainerDB>

let dbPromise: Promise<TrainerDatabase> | undefined

/** Opens (once) the trainer database. Rejects with a clear Error when IndexedDB is unavailable or blocked. */
export function getDb(): Promise<TrainerDatabase> {
  if (dbPromise) return dbPromise
  const p = new Promise<TrainerDatabase>((resolve, reject) => {
    let settled = false
    if (typeof indexedDB === 'undefined') return reject(new Error('Local storage (IndexedDB) is not available in this browser.'))
    openDB<TrainerDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('progress', { keyPath: 'patternId' })
          db.createObjectStore('drafts', { keyPath: 'key' })
        }
        if (oldVersion < 2) db.createObjectStore('examSessions', { keyPath: 'id' })
      },
      blocked() {
        settled = true
        reject(new Error('Local storage is blocked by another open tab. Close the other tabs and reload.'))
      },
      blocking() {
        // another tab wants to upgrade: release this connection so it can proceed
        void p.then((db) => db.close(), () => undefined)
        if (dbPromise === p) dbPromise = undefined
      },
    }).then(
      (db) => {
        if (settled) db.close() // blocked() already rejected: don't leak the late connection
        else resolve(db)
      },
      (cause) =>
        reject(new Error(`Could not open local storage: ${cause instanceof Error ? cause.message : String(cause)}`, { cause })),
    )
  })
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
