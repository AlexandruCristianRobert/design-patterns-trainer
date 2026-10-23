import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompilerStatus } from '../../compiler/CompilerProvider'
import { SandboxPage } from './SandboxPage'

const state: { status: CompilerStatus } = { status: 'starting' }
const compile = vi.fn()

vi.mock('../../compiler/CompilerProvider', () => ({
  useCompiler: () => ({
    status: state.status,
    compiler: { compile },
    runner: { exclusive: (job: () => Promise<unknown>) => job(), load: vi.fn(), runMain: vi.fn() },
  }),
}))

vi.mock('../../editor/CodeEditor', () => ({
  CodeEditor: (p: { value: string; ariaLabel: string }) => (
    <textarea aria-label={p.ariaLabel} value={p.value} readOnly />
  ),
}))

describe('SandboxPage', () => {
  beforeEach(() => compile.mockReset())

  it('disables Run while the compiler is starting and shows the failure message when it fails', async () => {
    state.status = 'starting'
    const { rerender } = render(<SandboxPage />)
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled()
    expect(screen.getByText('Starting the C# compiler…')).toBeInTheDocument()
    expect(document.querySelector('[data-state="starting"]')).not.toBeNull()
    expect(await screen.findByLabelText('C# code editor')).toHaveValue('Console.WriteLine("Hello, patterns!");')

    state.status = 'failed'
    rerender(<SandboxPage />)
    expect(screen.getByText("The C# compiler couldn't start. Reload the page to try again.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled()
  })

  it('enables Run when the compiler is ready and shows compile errors from a run', async () => {
    state.status = 'ready'
    compile.mockResolvedValue({
      success: false,
      contractViolations: [],
      diagnostics: [
        {
          id: 'CS0103',
          level: 'error',
          message: "The name 'y' does not exist in the current context",
          file: 'user',
          startLine: 1,
          startColumn: 9,
          endLine: 1,
          endColumn: 10,
        },
      ],
    })
    render(<SandboxPage />)
    expect(screen.getByText('C# compiler ready')).toBeInTheDocument()
    const run = screen.getByRole('button', { name: 'Run' })
    expect(run).toBeEnabled()
    fireEvent.click(run)
    expect(await screen.findByText("The name 'y' does not exist in the current context")).toBeInTheDocument()
  })

  it('starts only one run when Run is triggered twice before React re-renders', async () => {
    state.status = 'ready'
    let finish!: (v: unknown) => void
    compile.mockReturnValue(new Promise((res) => (finish = res)))
    render(<SandboxPage />)
    await screen.findByLabelText('C# code editor')
    const ctrlEnter = () => fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })
    act(() => {
      ctrlEnter()
      ctrlEnter()
    })
    expect(compile).toHaveBeenCalledTimes(1)
    await act(async () => finish({ success: false, diagnostics: [], contractViolations: [] }))
  })
})
