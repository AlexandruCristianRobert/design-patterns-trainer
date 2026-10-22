import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompileRequest, CompileResponse, DiagnosticInfo } from '../compiler/protocol'
import { useLiveDiagnostics } from './useLiveDiagnostics'

const diag = (id: string): DiagnosticInfo => ({
  id, level: 'error', message: id, file: 'user', startLine: 1, startColumn: 1, endLine: 1, endColumn: 2,
})

function deferredCompiler() {
  const calls: { req: CompileRequest; resolve: (r: CompileResponse) => void }[] = []
  const compile = vi.fn(
    (req: CompileRequest) => new Promise<CompileResponse>((resolve) => calls.push({ req, resolve })),
  )
  return { compile, calls }
}

const response = (d: DiagnosticInfo): CompileResponse => ({ success: false, diagnostics: [d], contractViolations: [] })

describe('useLiveDiagnostics', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('keeps the newest result when responses arrive out of order', async () => {
    const compiler = deferredCompiler()
    const { result, rerender } = renderHook(({ src }) => useLiveDiagnostics(src, compiler), {
      initialProps: { src: 'a' },
    })
    await act(() => vi.advanceTimersByTimeAsync(500))
    rerender({ src: 'b' })
    await act(() => vi.advanceTimersByTimeAsync(500))
    expect(compiler.calls.map((c) => c.req.source)).toEqual(['a', 'b'])
    expect(compiler.calls[0].req.purpose).toBe('diagnostics')

    await act(async () => compiler.calls[1].resolve(response(diag('B'))))
    await act(async () => compiler.calls[0].resolve(response(diag('A'))))
    expect(result.current).toEqual([diag('B')])
  })

  it('waits 500 ms after the last change', async () => {
    const compiler = deferredCompiler()
    const { rerender } = renderHook(({ src }) => useLiveDiagnostics(src, compiler), {
      initialProps: { src: 'a' },
    })
    await act(() => vi.advanceTimersByTimeAsync(100))
    rerender({ src: 'ab' })
    await act(() => vi.advanceTimersByTimeAsync(150))
    rerender({ src: 'abc' })
    await act(() => vi.advanceTimersByTimeAsync(150))
    expect(compiler.compile).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(500))
    expect(compiler.compile).toHaveBeenCalledTimes(1)
    expect(compiler.calls[0].req.source).toBe('abc')
  })

  it('does nothing without a compiler', async () => {
    const { result } = renderHook(() => useLiveDiagnostics('a', null))
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(result.current).toEqual([])
  })
})
