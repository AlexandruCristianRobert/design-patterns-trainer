import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { beforeEach, describe, expect, it } from 'vitest'
import { DB_NAME, DB_VERSION, getDb, resetDbForTests } from './db'

beforeEach(async () => {
  await resetDbForTests()
})

describe('trainer database', () => {
  it('upgrades a v2 database to v3 and keeps the old records', async () => {
    const exam = { id: 'e1', status: 'abandoned', startedAt: '2026-03-01T10:00:00.000Z' }
    const v2 = await openDB(DB_NAME, 2, {
      upgrade(db) {
        db.createObjectStore('progress', { keyPath: 'patternId' })
        db.createObjectStore('drafts', { keyPath: 'key' })
        db.createObjectStore('examSessions', { keyPath: 'id' })
      },
    })
    await v2.put('examSessions', exam)
    v2.close()

    const db = await getDb()
    expect(DB_VERSION).toBe(3)
    expect(db.version).toBe(3)
    expect([...db.objectStoreNames].sort()).toEqual(['drafts', 'examSessions', 'progress', 'quizBoxes', 'quizResults'])
    expect(await db.getAll('examSessions')).toEqual([exam])
    expect(await db.count('quizBoxes')).toBe(0)
    expect(await db.count('quizResults')).toBe(0)
    expect(db.transaction('quizBoxes').store.keyPath).toBe('questionId')
    expect(db.transaction('quizResults').store.keyPath).toBe('id')
  })
})
