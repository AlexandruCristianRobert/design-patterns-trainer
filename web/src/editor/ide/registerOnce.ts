import { registerIdeProviders, type MonacoApi } from './monacoProviders'
import type { IdeClient } from './IdeClient'

// Monaco is one global, and its provider registry is global too: a second registration would answer every request twice.
const registered = new WeakSet<object>()

export function registerIdeProvidersOnce(monaco: MonacoApi & object, client: IdeClient): void {
  if (registered.has(monaco)) return
  registered.add(monaco)
  registerIdeProviders(monaco, client)
}
