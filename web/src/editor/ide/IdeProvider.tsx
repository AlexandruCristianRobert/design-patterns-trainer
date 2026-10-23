import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useCompiler } from '../../compiler/CompilerProvider'
import type { CompilerClient } from '../../compiler/CompilerClient'
import { createIdeClient, type IdeClient } from './IdeClient'
import { IdeContext, readAutoload, writeAutoload, type IdeState } from './useIde'

// One client per compiler: the app has one compiler, and StrictMode renders must not create a second client.
const clients = new WeakMap<CompilerClient, IdeClient>()
function clientFor(compiler: CompilerClient): IdeClient {
  let client = clients.get(compiler)
  if (!client) {
    client = createIdeClient(compiler)
    clients.set(compiler, client)
  }
  return client
}

async function fetchSize(): Promise<number | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}dotnet/ide-manifest.json`)
    if (!res.ok) return null
    const bytes = ((await res.json()) as { bytes?: unknown }).bytes
    return typeof bytes === 'number' && bytes > 0 ? bytes : null
  } catch {
    return null
  }
}

/** Provides the one IDE client, its status and the auto-load setting. Goes inside CompilerProvider. */
export function IdeProvider({ children, client: given }: { children: ReactNode; client?: IdeClient }) {
  const { compiler, status: compilerStatus } = useCompiler()
  const client = useMemo(() => given ?? clientFor(compiler), [given, compiler])
  const [autoload, setAutoloadState] = useState(readAutoload)
  const [sizeBytes, setSizeBytes] = useState<number | null>(null)

  // Re-read on every status change; the snapshot is a primitive so React can compare it.
  const status = useSyncExternalStore(client.subscribe, () => client.status)
  const error = client.error

  const load = useCallback(() => {
    // The failure is already in the client's status and error; the rejection only has to be caught.
    client.load().catch(() => {})
  }, [client])

  const setAutoload = useCallback((on: boolean) => {
    writeAutoload(on)
    setAutoloadState(on)
  }, [])

  useEffect(() => {
    let active = true
    void fetchSize().then((n) => active && setSizeBytes(n))
    return () => {
      active = false
    }
  }, [])

  // Only once the compiler is ready, so the IDE download doesn't compete with booting it. A failed load isn't retried here.
  useEffect(() => {
    if (autoload && compilerStatus === 'ready' && client.status === 'off') load()
  }, [autoload, compilerStatus, client, load])

  const value = useMemo<IdeState>(
    () => ({ status, error, sizeBytes, load, autoload, setAutoload, client }),
    [status, error, sizeBytes, load, autoload, setAutoload, client],
  )
  return <IdeContext value={value}>{children}</IdeContext>
}
