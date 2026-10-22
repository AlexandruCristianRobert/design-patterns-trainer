import type { CompileRequest, CompileResponse } from './protocol'
import { WorkerChannel, type WorkerLike } from './workerRpc'

export class CompilerClient {
  readonly ready: Promise<void>
  /** Resolves with the reason if the compiler worker dies (before or after ready). */
  readonly failed: Promise<Error>
  private readonly channel: WorkerChannel

  constructor(createWorker: () => WorkerLike) {
    this.channel = new WorkerChannel(createWorker())
    this.ready = this.channel.ready
    this.failed = this.channel.failed
  }

  async compile(req: CompileRequest): Promise<CompileResponse> {
    return JSON.parse(await this.channel.call('compile', JSON.stringify(req))) as CompileResponse
  }

  dispose() {
    this.channel.dispose()
  }
}
