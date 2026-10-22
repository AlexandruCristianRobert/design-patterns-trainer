import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDraft } from './useDraft'

const loadDraft = vi.fn()
const saveDraft = vi.fn()

vi.mock('../progress/drafts', () => ({
  loadDraft: (...a: unknown[]) => loadDraft(...a),
  saveDraft: (...a: unknown[]) => saveDraft(...a),
}))

const KEY = 'exercise:observer/a' as const
const draft = (code: string, contentVersion: number) => ({
  draft: { key: KEY, code, contentVersion, updatedAt: '2026-01-01T00:00:00.000Z' },
  stale: contentVersion !== 2,
})

async function settle() {
  await act(async () => {})
}

describe('useDraft', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    loadDraft.mockReset()
    saveDraft.mockReset().mockResolvedValue(undefined)
  })
  afterEach(() => vi.useRealTimers())

  it('loads an existing draft', async () => {
    loadDraft.mockResolvedValue(draft('saved code', 2))
    const { result } = renderHook(() => useDraft(KEY, 'starter', 2))
    expect(result.current.loaded).toBe(false)
    await settle()
    expect(loadDraft).toHaveBeenCalledWith(KEY, 2)
    expect(result.current).toMatchObject({ code: 'saved code', stale: false, loaded: true })
  })

  it('keeps the initial code when there is no draft', async () => {
    loadDraft.mockResolvedValue(undefined)
    const { result } = renderHook(() => useDraft(KEY, 'starter', 2))
    await settle()
    expect(result.current).toMatchObject({ code: 'starter', stale: false, loaded: true })
  })

  it('autosaves once, 500 ms after the last change', async () => {
    loadDraft.mockResolvedValue(undefined)
    const { result } = renderHook(() => useDraft(KEY, 'starter', 2))
    await settle()
    act(() => result.current.setCode('a'))
    act(() => vi.advanceTimersByTime(300))
    act(() => result.current.setCode('ab'))
    act(() => vi.advanceTimersByTime(499))
    expect(saveDraft).not.toHaveBeenCalled()
    expect(result.current.code).toBe('ab')
    act(() => vi.advanceTimersByTime(1))
    expect(saveDraft).toHaveBeenCalledTimes(1)
    expect(saveDraft).toHaveBeenCalledWith(KEY, 'ab', 2)
  })

  it('reports a stale draft and keeps it stale while editing', async () => {
    loadDraft.mockResolvedValue(draft('old code', 1))
    const { result } = renderHook(() => useDraft(KEY, 'starter', 2))
    await settle()
    expect(result.current).toMatchObject({ code: 'old code', stale: true })
    act(() => result.current.setCode('old code edited'))
    act(() => vi.advanceTimersByTime(500))
    // Saved against the draft's own version, so it is still flagged stale after a reload.
    expect(saveDraft).toHaveBeenCalledWith(KEY, 'old code edited', 1)
    expect(result.current.stale).toBe(true)
  })

  it('reset overwrites the code, clears stale and saves right away', async () => {
    loadDraft.mockResolvedValue(draft('old code', 1))
    const { result } = renderHook(() => useDraft(KEY, 'starter', 2))
    await settle()
    act(() => result.current.setCode('pending edit'))
    act(() => result.current.reset('starter'))
    expect(result.current).toMatchObject({ code: 'starter', stale: false })
    expect(saveDraft).toHaveBeenCalledTimes(1)
    expect(saveDraft).toHaveBeenCalledWith(KEY, 'starter', 2)
    act(() => vi.advanceTimersByTime(1000))
    expect(saveDraft).toHaveBeenCalledTimes(1)
  })

  it('saves a pending change immediately on unmount', async () => {
    loadDraft.mockResolvedValue(undefined)
    const { result, unmount } = renderHook(() => useDraft(KEY, 'starter', 2))
    await settle()
    act(() => result.current.setCode('typed'))
    unmount()
    expect(saveDraft).toHaveBeenCalledWith(KEY, 'typed', 2)
  })

  it('ignores a draft that loads after the learner already typed', async () => {
    let resolve!: (v: unknown) => void
    loadDraft.mockReturnValue(new Promise((r) => (resolve = r)))
    const { result } = renderHook(() => useDraft(KEY, 'starter', 2))
    act(() => result.current.setCode('typed first'))
    await act(async () => resolve(draft('saved code', 2)))
    expect(result.current).toMatchObject({ code: 'typed first', loaded: true })
  })

  it('switching key without remounting saves the old edit under the old key and starts from initial', async () => {
    loadDraft.mockResolvedValue(undefined)
    const { result, rerender } = renderHook(({ k, init }) => useDraft(k, init, 2), {
      initialProps: { k: KEY as `exercise:${string}/${string}`, init: 'starter a' },
    })
    await settle()
    act(() => result.current.setCode('edited a'))
    let resolveB!: (v: unknown) => void
    loadDraft.mockReturnValue(new Promise((r) => (resolveB = r)))
    rerender({ k: 'exercise:observer/b', init: 'starter b' })
    expect(result.current).toMatchObject({ code: 'starter b', stale: false, loaded: false })
    expect(saveDraft).toHaveBeenCalledTimes(1)
    expect(saveDraft).toHaveBeenCalledWith(KEY, 'edited a', 2)
    await act(async () => resolveB(draft('saved b', 2)))
    expect(result.current).toMatchObject({ code: 'saved b', loaded: true })
    act(() => vi.advanceTimersByTime(1000))
    expect(saveDraft).toHaveBeenCalledTimes(1)
  })

  it('a stale flag does not carry over to the next key', async () => {
    loadDraft.mockResolvedValue(draft('old code', 1))
    const { result, rerender } = renderHook(({ k }) => useDraft(k, 'starter', 2), {
      initialProps: { k: KEY as `exercise:${string}/${string}` },
    })
    await settle()
    expect(result.current.stale).toBe(true)
    loadDraft.mockResolvedValue(undefined)
    rerender({ k: 'exercise:observer/b' })
    expect(result.current).toMatchObject({ code: 'starter', stale: false })
    await settle()
    expect(result.current).toMatchObject({ code: 'starter', stale: false, loaded: true })
  })

  it('a pending edit is saved under its own version when the content version changes', async () => {
    loadDraft.mockResolvedValue(undefined)
    const { result, rerender } = renderHook(({ v }) => useDraft(KEY, 'starter', v), { initialProps: { v: 2 } })
    await settle()
    act(() => result.current.setCode('typed on v2'))
    rerender({ v: 3 })
    expect(saveDraft).toHaveBeenCalledTimes(1)
    expect(saveDraft).toHaveBeenCalledWith(KEY, 'typed on v2', 2)
    await settle()
  })

  it('reports a failed save through saveError and clears it after the next success', async () => {
    loadDraft.mockResolvedValue(undefined)
    saveDraft.mockRejectedValueOnce(new Error('QuotaExceededError'))
    const { result } = renderHook(() => useDraft(KEY, 'starter', 2))
    await settle()
    expect(result.current.saveError).toBe(false)
    act(() => result.current.setCode('a'))
    act(() => vi.advanceTimersByTime(500))
    await settle()
    expect(result.current.saveError).toBe(true)
    act(() => result.current.setCode('ab'))
    act(() => vi.advanceTimersByTime(500))
    await settle()
    expect(result.current.saveError).toBe(false)
  })

  it('does not persist when the key is null', async () => {
    const { result } = renderHook(() => useDraft(null, 'starter', 1))
    expect(result.current).toMatchObject({ code: 'starter', loaded: true, stale: false })
    act(() => result.current.setCode('x'))
    act(() => vi.advanceTimersByTime(1000))
    act(() => result.current.reset('starter'))
    expect(result.current.code).toBe('starter')
    expect(loadDraft).not.toHaveBeenCalled()
    expect(saveDraft).not.toHaveBeenCalled()
  })
})
