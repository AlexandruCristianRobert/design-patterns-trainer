import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CodePanel } from './CodePanel'
import { useDraft } from './useDraft'

const loadDraft = vi.fn()
vi.mock('../progress/drafts', () => ({
  loadDraft: (...a: unknown[]) => loadDraft(...a),
  saveDraft: vi.fn().mockResolvedValue(undefined),
}))

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

// The intended wiring for persisted panels (Lesson example, Exercise).
function DraftPanel() {
  const { code, setCode, loaded } = useDraft('exercise:observer/a', 'starter', 1)
  return <CodePanel code={code} onChange={setCode} fileName="Draft.cs" ariaLabel="Draft" readOnly={!loaded} />
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

  it('keeps the editor read-only while a draft is loading', async () => {
    let resolve!: (v: unknown) => void
    loadDraft.mockReturnValue(new Promise((r) => (resolve = r)))
    render(<DraftPanel />)
    const editor = await screen.findByLabelText('Draft')
    expect(editor).toHaveAttribute('readonly')
    expect(editor).toHaveValue('starter')
    await act(async () => resolve({ draft: { code: 'saved', contentVersion: 1 }, stale: false }))
    expect(editor).not.toHaveAttribute('readonly')
    expect(editor).toHaveValue('saved')
  })

  it('turns Run and Ctrl+Enter off with runDisabled, and reports when a Run starts and ends', async () => {
    succeedWith('out')
    const seen: boolean[] = []
    const { rerender } = render(
      <CodePanel code="x" onChange={() => undefined} fileName="A.cs" ariaLabel="A" runDisabled onRunningChange={(r) => seen.push(r)} />,
    )
    const editor = await screen.findByLabelText('A')
    expect(screen.getByRole('button', { name: /^Run/ })).toBeDisabled()
    await act(async () => {
      fireEvent.keyDown(editor, { key: 'Enter', ctrlKey: true })
    })
    expect(compile).not.toHaveBeenCalled()
    rerender(<CodePanel code="x" onChange={() => undefined} fileName="A.cs" ariaLabel="A" onRunningChange={(r) => seen.push(r)} />)
    expect(screen.getByRole('button', { name: /^Run/ })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: /^Run/ }))
    expect(await screen.findByText('out')).toBeInTheDocument()
    expect(seen).toContain(true)
    expect(seen[seen.length - 1]).toBe(false)
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
