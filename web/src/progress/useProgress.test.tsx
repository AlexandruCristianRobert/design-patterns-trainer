import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDbForTests } from './db'
import { recordExerciseEvent } from './progressStore'
import { useAllProgress, usePatternProgress } from './useProgress'

const fails = { read: false }
vi.mock('./progressStore', async (orig) => {
  const real = await orig<typeof import('./progressStore')>()
  return {
    ...real,
    getProgress: (id: string) => (fails.read ? Promise.reject(new Error('blocked')) : real.getProgress(id)),
    getAllProgress: () => (fails.read ? Promise.reject(new Error('blocked')) : real.getAllProgress()),
  }
})

beforeEach(async () => {
  fails.read = false
  await resetDbForTests()
})

describe('progress hooks', () => {
  it('start loading, then return the stored data', async () => {
    await recordExerciseEvent('observer', 'complete', { type: 'hintRevealed' })
    const { result } = renderHook(() => usePatternProgress('observer'))
    expect(result.current).toEqual({ data: undefined, error: false })
    await waitFor(() => expect(result.current.data?.exercises.complete.hintsRevealed).toBe(1))
    expect(result.current.error).toBe(false)
  })

  it('report an error, not endless loading, when the store rejects', async () => {
    fails.read = true
    const one = renderHook(() => usePatternProgress('observer'))
    const all = renderHook(() => useAllProgress())
    await waitFor(() => expect(one.result.current).toEqual({ data: undefined, error: true }))
    await waitFor(() => expect(all.result.current).toEqual({ data: undefined, error: true }))
  })
})
