import { registerIdeProviders, type MonacoApi } from './monacoProviders'
import type { IdeClient } from './IdeClient'

// Monaco is one global, and its provider registry is global too: a second registration would answer every request twice.
const registered = new WeakSet<object>()

/**
 * Registers the IDE providers the first time the client is ready, and never unregisters them. Registering earlier
 * would turn on Monaco's Go to Definition, Peek and Format Document menu entries for learners who never opt in, and
 * they would do nothing. Returns the unsubscribe for an editor that unmounts before then.
 */
export function registerIdeProvidersWhenReady(monaco: MonacoApi & object, client: IdeClient): () => void {
  const tryRegister = () => {
    if (registered.has(monaco) || client.status !== 'ready') return registered.has(monaco)
    registered.add(monaco)
    registerIdeProviders(monaco, client)
    return true
  }
  if (tryRegister()) return () => {}
  const unsubscribe = client.subscribe(() => {
    if (tryRegister()) unsubscribe()
  })
  return unsubscribe
}
