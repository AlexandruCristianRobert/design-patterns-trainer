import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CompilerClient } from './CompilerClient'
import { CompilerProvider, useCompiler } from './CompilerProvider'
import { RunnerHost } from './RunnerHost'
import { FakeWorker } from './testing/FakeWorker'

function Status() {
  const { status, error } = useCompiler()
  return <p>{error ? `${status}: ${error}` : status}</p>
}

describe('CompilerProvider', () => {
  it('turns failed with the message when the compiler worker dies after ready', async () => {
    const cw = new FakeWorker()
    const rw = new FakeWorker()
    const engine = { compiler: new CompilerClient(() => cw), runner: new RunnerHost(() => rw) }
    render(
      <CompilerProvider engine={engine}>
        <Status />
      </CompilerProvider>,
    )
    expect(screen.getByText('starting')).toBeInTheDocument()
    await act(async () => {
      cw.emitReady()
      rw.emitReady()
    })
    expect(screen.getByText('ready')).toBeInTheDocument()
    await act(async () => cw.emitError('Uncaught RuntimeError: unreachable'))
    expect(screen.getByText('failed: Uncaught RuntimeError: unreachable')).toBeInTheDocument()
  })
})
