import { createContext, useContext } from 'react'
import type { IdeClient, IdeStatus } from './IdeClient'

export const AUTOLOAD_KEY = 'dpt.ide.autoload'

export interface IdeState {
  status: IdeStatus
  error: Error | null
  /** Gzip download size, built in from ide-manifest.json; null if the build had no manifest. */
  sizeBytes: number | null
  /** Starts the download. Never rejects: a failure shows in `status` and `error`. */
  load(): void
  autoload: boolean
  setAutoload(on: boolean): void
  /** The shared client the Monaco providers talk to. */
  client: IdeClient
}

export const IdeContext = createContext<IdeState | null>(null)

/** The IDE features state, shared by every editor on the page. Null outside an IdeProvider. */
export function useIde(): IdeState | null {
  return useContext(IdeContext)
}

export function readAutoload(): boolean {
  try {
    return localStorage.getItem(AUTOLOAD_KEY) === '1'
  } catch {
    return false
  }
}

export function writeAutoload(on: boolean): void {
  try {
    if (on) localStorage.setItem(AUTOLOAD_KEY, '1')
    else localStorage.removeItem(AUTOLOAD_KEY)
  } catch {
    // Storage blocked: the setting lasts for this visit only.
  }
}
