import type { CompileRequest, CompileResponse } from './protocol'
import { WorkerChannel, type WorkerLike } from './workerRpc'

export class CompilerClient {
  readonly ready: Promise<void>
  private readonly channel: WorkerChannel

  constructor(createWorker: () => WorkerLike) {
    this.channel = new WorkerChannel(createWorker())
    this.ready = this.channel.ready
  }

  async compile(req: CompileRequest): Promise<CompileResponse> {
    return JSON.parse(await this.channel.call('compile', JSON.stringify(req))) as CompileResponse
  }

  dispose() {
    this.channel.dispose()
  }
}
