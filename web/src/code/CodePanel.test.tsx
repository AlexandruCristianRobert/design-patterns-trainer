import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CodePanel } from './CodePanel'

const compile = vi.fn()
const load = vi.fn()
const runMain = vi.fn()

vi.mock('../compiler/CompilerProvider', () => ({
  useCompiler: () => ({ status: 'ready', compiler: { compile }, runner: { load, runMain } }),
}))

vi.mock('../editor/CodeEditor', () => ({
  CodeEditor: (p: {
    value: string
    ariaLabel: string
    onChange(v: string): void
    readOnly?: boolean
    highlightedLines?: [number, number] | null
  }) => (
    <textarea
      aria-label={p.ariaLabel}
      value={p.value}
      readOnly={p.readOnly}
      data-highlighted={p.highlightedLines ? p.highlightedLines.join('-') : ''}
      onChange={(e) => p.onChange(e.target.value)}
    />
  ),
}))

function Panel(props: { initial: string; label: string; extra?: boolean; highlighted?: [number, number] | null }) {
  const [code, setCode] = useState(props.initial)
  return (
    <CodePanel
      code={code}
      onChange={setCode}
      fileName={`${props.label}.cs`}
      ariaLabel={props.label}
      highlightedLines={props.highlighted}
      extraActions={props.extra ? <button type="button">Check</button> : undefined}
      results={props.extra ? <p>check results</p> : undefined}
    />
  )
}

function succeedWith(stdout: string) {
  compile.mockResolvedValue({ success: true, assemblyBase64: 'AA==', diagnostics: [], contractViolations: [] })
  load.mockResolvedValue({ hasEntryPoint: true })
  runMain.mockResolvedValue({ kind: 'completed', value: { stdout, truncated: false } })
}

describe('CodePanel', () => {
  beforeEach(() => {
    compile.mockReset()
    load.mockReset()
    runMain.mockReset()
  })

  it('runs the current code through runSandbox and shows the output', async () => {
    succeedWith('hello from panel\n')
    render(<Panel initial='Console.WriteLine("x");' label="Example" />)
    const editor = await screen.findByLabelText('Example')
    fireEvent.change(editor, { target: { value: 'Console.WriteLine("edited");' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    expect(await screen.findByText('hello from panel')).toBeInTheDocument()
    expect(compile).toHaveBeenCalledWith({ source: 'Console.WriteLine("edited");', purpose: 'run' })
    expect(screen.getByText('Example.cs')).toBeInTheDocument()
    expect(document.querySelector('[data-state="ready"]')).not.toBeNull()
  })

  it('places extra actions before Run, renders results and passes highlighted lines to the editor', async () => {
    render(<Panel initial="" label="Exercise" extra highlighted={[3, 5]} />)
    const names = screen.getAllByRole('button').map((b) => b.textContent ?? '')
    expect(names.indexOf('Check')).toBeGreaterThanOrEqual(0)
    expect(names.indexOf('Check')).toBeLessThan(names.findIndex((n) => n.startsWith('Run')))
    expect(screen.getByText('check results')).toBeInTheDocument()
    expect(await screen.findByLabelText('Exercise')).toHaveAttribute('data-highlighted', '3-5')
  })

  it('Ctrl+Enter runs only the panel that has focus', async () => {
    succeedWith('')
    render(
      <>
        <Panel initial="first" label="First" />
        <Panel initial="second" label="Second" />
      </>,
    )
    const second = await screen.findByLabelText('Second')
    await act(async () => {
      fireEvent.keyDown(second, { key: 'Enter', ctrlKey: true })
    })
    expect(compile).toHaveBeenCalledTimes(1)
    expect(compile).toHaveBeenCalledWith({ source: 'second', purpose: 'run' })

    // Focus outside every panel with two panels on the page is ambiguous, so nothing runs.
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })
    })
    expect(compile).toHaveBeenCalledTimes(1)
  })
})
