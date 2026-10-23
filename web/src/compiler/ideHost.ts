import type { IdeExports } from './dotnetBoot'
import type { IdeMethod } from './protocol'

const IDE_METHODS = ['complete', 'hover', 'definition', 'format'] as const satisfies readonly IdeMethod[]

/** What .NET answers when a request's CancellationToken was tripped (IdeWire.Cancelled). */
const DOTNET_CANCELLED = '{"cancelled":true}'
const SUPERSEDED = '{"superseded":true}'
const SUPERSEDED_CANCELLED = '{"superseded":true,"cancelled":true}'

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/**
 * The IDE half of the compiler worker: `loadIde` and the four language-service methods (ADR 0003).
 *
 * A newer request of a kind supersedes the older one, which answers `{ superseded: true }`:
 * - a request first yields one task, so a newer one already waiting in the message queue replaces it before it starts;
 * - a running one is cancelled through `IdeExports.Cancel`. That only lands if .NET yields to the event loop during the
 *   call; if it does, the answer also says `cancelled: true`;
 * - otherwise its finished result is dropped.
 */
export class IdeHost {
  private exports: IdeExports | null = null
  private loading: Promise<void> | null = null
  private readonly latest = new Map<IdeMethod, number>()
  private readonly running = new Map<IdeMethod, number>()

  private readonly loadExports: () => Promise<IdeExports>
  private readonly yieldTask: () => Promise<void>

  constructor(loadExports: () => Promise<IdeExports>, yieldTask: () => Promise<void> = nextTask) {
    this.loadExports = loadExports
    this.yieldTask = yieldTask
  }

  handles(method: string): boolean {
    return method === 'loadIde' || (IDE_METHODS as readonly string[]).includes(method)
  }

  async handle(method: string, payload: string, id: number): Promise<string> {
    if (method === 'loadIde') {
      await this.load()
      return 'ok'
    }
    return this.call(method as IdeMethod, payload, id)
  }

  private load(): Promise<void> {
    this.loading ??= (async () => {
      const exports = await this.loadExports()
      await exports.WarmUp()
      this.exports = exports
    })().catch((e: unknown) => {
      this.loading = null // a failed download may be retried
      throw e
    })
    return this.loading
  }

  private async call(method: IdeMethod, payload: string, id: number): Promise<string> {
    const exports = this.exports
    if (!exports) throw new Error('IDE features are not loaded: send loadIde first.')

    this.latest.set(method, id)
    const older = this.running.get(method)
    if (older !== undefined) exports.Cancel(older)

    await this.yieldTask()
    if (this.latest.get(method) !== id) return SUPERSEDED

    this.running.set(method, id)
    let result: string
    try {
      result = await this.invoke(exports, method, payload, id)
    } finally {
      if (this.running.get(method) === id) this.running.delete(method)
    }
    if (result === DOTNET_CANCELLED) return SUPERSEDED_CANCELLED
    return this.latest.get(method) === id ? result : SUPERSEDED
  }

  private invoke(exports: IdeExports, method: IdeMethod, payload: string, id: number): Promise<string> {
    switch (method) {
      case 'complete':
        return exports.Complete(payload, id)
      case 'hover':
        return exports.Hover(payload, id)
      case 'definition':
        return exports.Definition(payload, id)
      case 'format':
        return exports.Format(payload, id)
    }
  }
}
