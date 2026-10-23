import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CodePanel } from '../../code/CodePanel'
import { IDE_DOWNLOAD_FAILED } from '../../compiler/dotnetBoot'
import { IdeButton, IdeStatusLine } from './IdeButton'
import type { IdeClient, IdeStatus } from './IdeClient'
import { IdeProvider } from './IdeProvider'

let compilerStatus = 'ready'
vi.mock('../../compiler/CompilerProvider', () => ({
  useCompiler: () => ({ status: compilerStatus, compiler: {}, runner: {} }),
}))
vi.mock('../CodeEditor', () => ({ CodeEditor: () => <div /> }))

function fakeClient(loadImpl: (c: FakeClient) => Promise<void>) {
  const c = {
    status: 'off' as IdeStatus,
    error: null as Error | null,
    listeners: new Set<() => void>(),
    subscribe(l: () => void) {
      c.listeners.add(l)
      return () => void c.listeners.delete(l)
    },
    set(s: IdeStatus) {
      c.status = s
      c.listeners.forEach((l) => l())
    },
    load: vi.fn(() => loadImpl(c)),
  }
  return c
}
type FakeClient = ReturnType<typeof fakeClient>

const succeed = async (c: FakeClient) => {
  c.set('loading')
  c.set('ready')
}
const failWith = (message: string) => async (c: FakeClient) => {
  c.error = new Error(message)
  c.set('failed')
  throw c.error
}

function renderIde(
  client: FakeClient,
  ui: ReactNode = (
    <>
      <IdeStatusLine />
      <IdeButton />
    </>
  ),
) {
  return render(<IdeProvider client={client as unknown as IdeClient}>{ui}</IdeProvider>)
}

beforeEach(() => {
  compilerStatus = 'ready'
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ assemblies: [], bytes: 7_340_032 }) }))
})
afterEach(() => vi.unstubAllGlobals())

describe('IdeButton', () => {
  it('shows the download size from the manifest in its tooltip', async () => {
    renderIde(fakeClient(succeed))
    expect(await screen.findByRole('button', { name: 'Enable IDE features (≈ 7.0 MB download)' })).toBeInTheDocument()
  })

  it('falls back to the plain name when the manifest is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    renderIde(fakeClient(succeed))
    expect(await screen.findByRole('button', { name: 'Enable IDE features' })).toBeInTheDocument()
  })

  it('loads on click and becomes a pressed toggle', async () => {
    const client = fakeClient(succeed)
    renderIde(client)
    fireEvent.click(await screen.findByRole('button', { name: /Enable IDE features/ }))
    expect(client.load).toHaveBeenCalledTimes(1)
    const on = await screen.findByRole('button', { name: 'IDE features on' })
    expect(on).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows the loading state while the download runs', async () => {
    let finish!: () => void
    const client = fakeClient(
      (c) =>
        new Promise<void>((resolve) => {
          c.set('loading')
          finish = () => {
            c.set('ready')
            resolve()
          }
        }),
    )
    renderIde(client)
    fireEvent.click(await screen.findByRole('button', { name: /Enable IDE features/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('Loading IDE features…')
    expect(screen.getByRole('button', { name: 'Loading IDE features…' })).toHaveAttribute('aria-disabled', 'true')
    finish()
    expect(await screen.findByRole('button', { name: 'IDE features on' })).toBeInTheDocument()
  })

  it('shows the failure with Try again, and retrying loads again', async () => {
    let attempt = 0
    const client = fakeClient((c) => (++attempt === 1 ? failWith('boom')(c) : succeed(c)))
    renderIde(client)
    fireEvent.click(await screen.findByRole('button', { name: /Enable IDE features/ }))
    expect(await screen.findByText("IDE features couldn't be loaded. Editing still works.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('button', { name: 'IDE features on' })).toBeInTheDocument()
    expect(client.load).toHaveBeenCalledTimes(2)
  })

  it('offers a reload, not a retry, when the download itself failed', async () => {
    renderIde(fakeClient(failWith(`${IDE_DOWNLOAD_FAILED} (net)`)))
    fireEvent.click(await screen.findByRole('button', { name: /Enable IDE features/ }))
    expect(await screen.findByText("IDE features couldn't be downloaded. Reload the page to try again.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('writes the auto-load setting to localStorage from the popover', async () => {
    renderIde(fakeClient(succeed))
    fireEvent.click(await screen.findByRole('button', { name: /Enable IDE features/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'IDE features on' }))
    const box = screen.getByRole('checkbox', { name: 'Load IDE features automatically on this device' })
    expect(box).not.toBeChecked()
    fireEvent.click(box)
    expect(localStorage.getItem('dpt.ide.autoload')).toBe('1')
    fireEvent.click(box)
    expect(localStorage.getItem('dpt.ide.autoload')).toBeNull()
  })

  it('closes the popover with Escape and returns focus to the button', async () => {
    renderIde(fakeClient(succeed))
    fireEvent.click(await screen.findByRole('button', { name: /Enable IDE features/ }))
    const on = await screen.findByRole('button', { name: 'IDE features on' })
    fireEvent.click(on)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(on).toHaveFocus()
  })
})

describe('auto-load', () => {
  it('loads on mount when the flag is set and the compiler is ready', async () => {
    localStorage.setItem('dpt.ide.autoload', '1')
    const client = fakeClient(succeed)
    renderIde(client)
    await waitFor(() => expect(client.load).toHaveBeenCalledTimes(1))
  })

  it('waits for the compiler', () => {
    localStorage.setItem('dpt.ide.autoload', '1')
    compilerStatus = 'starting'
    const client = fakeClient(succeed)
    renderIde(client)
    expect(client.load).not.toHaveBeenCalled()
  })

  it('does not load without the flag', () => {
    const client = fakeClient(succeed)
    renderIde(client)
    expect(client.load).not.toHaveBeenCalled()
  })

  it('catches a failed auto-load instead of leaving the rejection unhandled', async () => {
    localStorage.setItem('dpt.ide.autoload', '1')
    const client = fakeClient(async () => {})
    const rejection = Promise.reject(new Error('boom'))
    const caught = vi.spyOn(rejection, 'catch')
    client.load.mockReturnValue(rejection)
    renderIde(client)
    await waitFor(() => expect(caught).toHaveBeenCalledTimes(1))
  })

  it('is off when localStorage cannot be read', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const client = fakeClient(succeed)
    renderIde(client)
    spy.mockRestore()
    expect(client.load).not.toHaveBeenCalled()
  })
})

describe('in the panels', () => {
  it('CodePanel, which the Sandbox, Lesson example, Exercise and Exam session all use, has the button', async () => {
    renderIde(fakeClient(succeed), <CodePanel code="" onChange={() => {}} fileName="Exam.cs" ariaLabel="Exam editor" />)
    expect(await screen.findByRole('button', { name: /Enable IDE features/ })).toBeInTheDocument()
  })
})
