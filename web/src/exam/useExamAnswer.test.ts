import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveAnswer } from './examStore'
import { useExamAnswer } from './useExamAnswer'

vi.mock('./examStore', () => ({ saveAnswer: vi.fn() }))
const save = vi.mocked(saveAnswer)
const a = (code: string) => ({ code, identification: null })

beforeEach(() => {
  save.mockReset().mockResolvedValue(undefined)
})

describe('useExamAnswer', () => {
  it('does not lose an earlier failed save when a later one succeeds', async () => {
    const { result } = renderHook(() => useExamAnswer('s1'))
    save.mockRejectedValueOnce(new Error('blocked'))
    act(() => result.current.schedule('q1', a('one')))
    // Switching question writes q1 (which fails) and keeps q2 pending.
    act(() => result.current.schedule('q2', a('two')))
    await act(async () => {
      await expect(result.current.flush()).resolves.toBeUndefined()
    })
    // The flush wrote q1 again, so the stored state is complete.
    expect(save.mock.calls.filter((c) => c[1] === 'q1')).toHaveLength(2)
    expect(save).toHaveBeenCalledWith('s1', 'q2', a('two'))
    expect(result.current.saveError).toBe(false)
  })

  it('rejects the flush and keeps the error visible while an answer still cannot be stored', async () => {
    const { result } = renderHook(() => useExamAnswer('s1'))
    save.mockImplementation(async (_id, key) => {
      if (key === 'q1') throw new Error('blocked')
    })
    act(() => result.current.schedule('q1', a('one')))
    act(() => result.current.schedule('q2', a('two')))
    await act(async () => {
      await expect(result.current.flush()).rejects.toThrow()
    })
    expect(result.current.saveError).toBe(true)
    // Still rejects on the next flush, with nothing new pending.
    await act(async () => {
      await expect(result.current.flush()).rejects.toThrow()
    })
  })

  it('saves when the page is hidden', async () => {
    const { result } = renderHook(() => useExamAnswer('s1'))
    act(() => result.current.schedule('q1', a('one')))
    expect(save).not.toHaveBeenCalled()
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    expect(save).toHaveBeenCalledWith('s1', 'q1', a('one'))
  })

  it('saves on pagehide', async () => {
    const { result } = renderHook(() => useExamAnswer('s1'))
    act(() => result.current.schedule('q1', a('one')))
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(save).toHaveBeenCalledWith('s1', 'q1', a('one'))
  })
})
