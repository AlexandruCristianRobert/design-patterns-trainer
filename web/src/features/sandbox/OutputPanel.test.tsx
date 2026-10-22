import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OutputPanel } from './OutputPanel'

describe('OutputPanel', () => {
  it('renders timeout, truncation and exception copy', () => {
    const { rerender } = render(<OutputPanel output={{ kind: 'timedOut' }} onLocate={() => {}} />)
    expect(screen.getByText('Stopped after 5 seconds — your program may contain an infinite loop.')).toBeInTheDocument()

    rerender(
      <OutputPanel
        output={{
          kind: 'completed',
          stdout: 'partial',
          truncated: true,
          exception: { type: 'System.InvalidOperationException', message: 'Nope' },
        }}
        onLocate={() => {}}
      />,
    )
    expect(screen.getByText('partial')).toBeInTheDocument()
    expect(screen.getByText('Output cut off at 64K characters.')).toBeInTheDocument()
    expect(screen.getByText('Unhandled exception: System.InvalidOperationException: Nope')).toBeInTheDocument()
  })

  it('renders the crash copy', () => {
    render(<OutputPanel output={{ kind: 'crashed' }} onLocate={() => {}} />)
    expect(
      screen.getByText('Your program crashed — this is often infinite recursion (a stack overflow).'),
    ).toBeInTheDocument()
  })

  it('renders idle, empty and no-entry-point copy', () => {
    const { rerender } = render(<OutputPanel output={{ kind: 'idle' }} onLocate={() => {}} />)
    expect(screen.getByText('Run your program to see its output here.')).toBeInTheDocument()
    rerender(<OutputPanel output={{ kind: 'completed', stdout: '', truncated: false }} onLocate={() => {}} />)
    expect(screen.getByText('Your program finished without printing anything.')).toBeInTheDocument()
    rerender(<OutputPanel output={{ kind: 'noEntryPoint' }} onLocate={() => {}} />)
    expect(screen.getByText('Nothing to run — add top-level statements or a Main method.')).toBeInTheDocument()
  })

  it('lists compile errors with locations that can be clicked', () => {
    const onLocate = vi.fn()
    render(
      <OutputPanel
        output={{
          kind: 'compileErrors',
          diagnostics: [
            {
              id: 'DP0001',
              level: 'error',
              message: 'x',
              args: { api: 'System.Console.ReadLine' },
              file: 'user',
              startLine: 3,
              startColumn: 9,
              endLine: 3,
              endColumn: 20,
            },
          ],
        }}
        onLocate={onLocate}
      />,
    )
    expect(screen.getByText('Fix these errors to run your program:')).toBeInTheDocument()
    expect(screen.getByText('Not available in the browser runtime: System.Console.ReadLine')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Line 3, column 9' }))
    expect(onLocate).toHaveBeenCalledWith(3, 9)
  })
})
