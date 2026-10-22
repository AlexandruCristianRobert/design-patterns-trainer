import {
  RECYCLE_AFTER_LOADS,
  RUN_TIMEOUT_MS,
  type CheckResult,
  type LoadRequest,
  type LoadResponse,
  type RunOutcome,
} from './protocol'
import { TimeoutSignal, WorkerChannel, type WorkerLike } from './workerRpc'

export type Timed<T> = { kind: 'ok'; value: T } | { kind: 'timedOut' }

export class RunnerHost {
  readonly ready: Promise<void>
  private channel: WorkerChannel
  private readonly timeoutMs: number
  private readonly recycleAfterLoads: number
  private loads = 0
  private lastLoad: LoadRequest | null = null
  private needsReload = false
  private reloading: Promise<void> | null = null
  private readonly createWorker: () => WorkerLike

  constructor(createWorker: () => WorkerLike, opts?: { timeoutMs?: number; recycleAfterLoads?: number }) {
    this.createWorker = createWorker
    this.timeoutMs = opts?.timeoutMs ?? RUN_TIMEOUT_MS
    this.recycleAfterLoads = opts?.recycleAfterLoads ?? RECYCLE_AFTER_LOADS
    this.channel = new WorkerChannel(createWorker())
    this.ready = this.channel.ready
  }

  async load(req: LoadRequest): Promise<LoadResponse> {
    if (this.loads >= this.recycleAfterLoads) this.respawn()
    this.needsReload = false
    this.loads++
    this.lastLoad = req
    return JSON.parse(await this.channel.call('load', JSON.stringify(req))) as LoadResponse
  }

  runMain(): Promise<Timed<RunOutcome>> {
    return this.timed<RunOutcome>('runMain', '')
  }

  runCheck(id: string): Promise<Timed<CheckResult>> {
    return this.timed<CheckResult>('runCheck', id)
  }

  dispose() {
    this.channel.dispose()
  }

  private async timed<T>(method: string, payload: string): Promise<Timed<T>> {
    await this.ensureLoaded()
    const channel = this.channel
    try {
      const result = await channel.call(method, payload, this.timeoutMs)
      return { kind: 'ok', value: JSON.parse(result) as T }
    } catch (e) {
      if (e instanceof TimeoutSignal) {
        if (channel === this.channel) this.respawn(true)
        return { kind: 'timedOut' }
      }
      throw e
    }
  }

  private ensureLoaded(): Promise<void> {
    if (!this.needsReload) return this.reloading ?? Promise.resolve()
    this.needsReload = false
    const req = this.lastLoad!
    this.loads = 1
    this.reloading = this.channel
      .call('load', JSON.stringify(req))
      .then(() => undefined)
      .finally(() => {
        this.reloading = null
      })
    return this.reloading
  }

  private respawn(afterTimeout = false) {
    this.channel.dispose()
    this.channel = new WorkerChannel(this.createWorker())
    this.loads = 0
    this.reloading = null
    this.needsReload = afterTimeout && this.lastLoad !== null
  }
}
