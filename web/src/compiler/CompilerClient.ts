import type {
  CompileRequest,
  CompileResponse,
  IdeCompletion,
  IdeDefinition,
  IdeFormat,
  IdeFormatRequest,
  IdeHover,
  IdeMethod,
  IdePositionRequest,
  Superseded,
} from './protocol'
import { WorkerChannel, type WorkerLike } from './workerRpc'

const SUPERSEDED: Superseded = { superseded: true }

export function isSuperseded(value: unknown): value is Superseded {
  return typeof value === 'object' && value !== null && (value as { superseded?: unknown }).superseded === true
}

export class CompilerClient {
  readonly ready: Promise<void>
  /** Resolves with the reason if the compiler worker dies (before or after ready). */
  readonly failed: Promise<Error>
  private readonly channel: WorkerChannel
  private ideLoad: Promise<void> | null = null
  private readonly latest = new Map<IdeMethod, number>()
  private nextSeq = 1

  constructor(createWorker: () => WorkerLike) {
    this.channel = new WorkerChannel(createWorker())
    this.ready = this.channel.ready
    this.failed = this.channel.failed
  }

  async compile(req: CompileRequest): Promise<CompileResponse> {
    return JSON.parse(await this.channel.call('compile', JSON.stringify(req))) as CompileResponse
  }

  /**
   * Downloads the IDE assemblies into the compiler worker and warms them up (ADR 0003). Sent once; after a failure it
   * may be sent again. The worker keeps only a download failure (IDE_DOWNLOAD_FAILED) and answers a retry with the same
   * "reload the page" error; after any other failure, such as a failed WarmUp, the retry really runs again.
   * No time limit: a slow network must not kill the compiler.
   */
  loadIde(): Promise<void> {
    this.ideLoad ??= this.channel.call('loadIde', '').then(
      () => {},
      (e: unknown) => {
        this.ideLoad = null
        throw e
      },
    )
    return this.ideLoad
  }

  complete(req: IdePositionRequest): Promise<IdeCompletion | Superseded> {
    return this.ide<IdeCompletion>('complete', req)
  }

  hover(req: IdePositionRequest): Promise<IdeHover | null | Superseded> {
    return this.ide<IdeHover | null>('hover', req)
  }

  definition(req: IdePositionRequest): Promise<IdeDefinition | null | Superseded> {
    return this.ide<IdeDefinition | null>('definition', req)
  }

  format(req: IdeFormatRequest): Promise<IdeFormat | Superseded> {
    return this.ide<IdeFormat>('format', req)
  }

  dispose() {
    this.channel.dispose()
  }

  /**
   * A newer request of the same kind supersedes this one. The worker answers `{ superseded: true }` when it notices;
   * a result that was already on its way back is dropped here.
   */
  private async ide<T>(method: IdeMethod, req: IdePositionRequest | IdeFormatRequest): Promise<T | Superseded> {
    const seq = this.nextSeq++
    this.latest.set(method, seq)
    let text: string
    try {
      text = await this.channel.call(method, JSON.stringify(req))
    } catch (e) {
      if (this.latest.get(method) !== seq) return SUPERSEDED // a newer request will report the problem, if any
      throw e
    }
    return this.latest.get(method) === seq ? (JSON.parse(text) as T | Superseded) : SUPERSEDED
  }
}
