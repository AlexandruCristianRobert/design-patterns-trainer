import {
  RECYCLE_AFTER_LOADS,
  RUN_TIMEOUT_MS,
  type CheckResult,
  type LoadRequest,
  type LoadResponse,
  type RunOutcome,
} from './protocol'
import { AbandonedSignal, CrashSignal, TimeoutSignal, WorkerChannel, type WorkerLike } from './workerRpc'

/** `crashed`: the runtime died while running learner code (e.g. a stack overflow); the runner has already recovered. */
export type Timed<T> = { kind: 'ok'; value: T } | { kind: 'timedOut' } | { kind: 'crashed'; message: string }

/** A check that timed out or crashed the runtime, expressed as the CheckResult the learner sees. */
export function checkResultOf(id: string, timed: Timed<CheckResult>): CheckResult {
  switch (timed.kind) {
    case 'ok':
      return timed.value
    case 'timedOut':
      return { id, status: 'timedOut', reason: 'timedOut' }
    case 'crashed':
      // A stack overflow is the one crash the runtime names; any other crash has no exception type to show.
      return timed.message.includes('StackOverflow')
        ? { id, status: 'errored', reason: 'threw', args: { type: 'System.StackOverflowException' } }
        : { id, status: 'errored', reason: 'crashed' }
  }
}

/**
 * Runs learner code in a worker that can be thrown away. A timed-out or crashed worker is terminated and replaced at
 * once (synchronously, so no request can reach the dead one), and the last loaded program is reloaded into the new
 * worker before its next call. A replacement worker that fails to boot is replaced again on the following call.
 */
export class RunnerHost {
  private channel: WorkerChannel
  private readonly timeoutMs: number
  private readonly recycleAfterLoads: number
  private readonly createWorker: () => WorkerLike
  private loads = 0
  /** Settles when the last job given to `exclusive` has. */
  private queue: Promise<void> = Promise.resolve()
  private lastLoad: LoadRequest | null = null
  /** What the current worker last finished loading, and what it is loading now. */
  private loaded: { channel: WorkerChannel; req: LoadRequest } | null = null
  private loading: { channel: WorkerChannel; req: LoadRequest; promise: Promise<string> } | null = null

  constructor(createWorker: () => WorkerLike, opts?: { timeoutMs?: number; recycleAfterLoads?: number }) {
    this.createWorker = createWorker
    this.timeoutMs = opts?.timeoutMs ?? RUN_TIMEOUT_MS
    this.recycleAfterLoads = opts?.recycleAfterLoads ?? RECYCLE_AFTER_LOADS
    this.channel = this.spawn()
  }

  /**
   * Runs `job` once every earlier job has settled. A job is a `load` and every call that relies on it (its checks, or
   * `runMain`): the runner holds one program, so two pages that load in between each other's calls would run the wrong
   * code. The lock is released however the job ends; a timeout or crash has already replaced the worker by then.
   */
  exclusive<T>(job: () => Promise<T>): Promise<T> {
    const result = this.queue.then(job)
    this.queue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  /** Readiness of the current worker. */
  get ready(): Promise<void> {
    return this.channel.ready
  }

  /** Rejects with the CrashSignal/TimeoutSignal if loading kills the worker; the runner itself stays usable. */
  async load(req: LoadRequest): Promise<LoadResponse> {
    this.lastLoad = req
    for (;;) {
      // Recycling waits until nothing is in flight, so it never cuts another request short.
      if (this.loads >= this.recycleAfterLoads && !this.channel.busy) this.replace()
      try {
        return JSON.parse(await this.postLoad(this.current(), req)) as LoadResponse
      } catch (e) {
        if (!(e instanceof AbandonedSignal)) throw e
      }
    }
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
    for (;;) {
      const channel = this.current()
      try {
        await this.ensureLoaded(channel)
        const result = await channel.call(method, payload, this.timeoutMs)
        return { kind: 'ok', value: JSON.parse(result) as T }
      } catch (e) {
        if (e instanceof AbandonedSignal) continue
        if (e instanceof TimeoutSignal) return { kind: 'timedOut' }
        if (e instanceof CrashSignal) return { kind: 'crashed', message: e.message }
        throw e
      }
    }
  }

  private async ensureLoaded(channel: WorkerChannel): Promise<void> {
    const req = this.lastLoad
    if (!req || (this.loaded?.channel === channel && this.loaded.req === req)) return
    if (this.loading?.channel === channel && this.loading.req === req) await this.loading.promise
    else await this.postLoad(channel, req)
  }

  private postLoad(channel: WorkerChannel, req: LoadRequest): Promise<string> {
    this.loads++
    const promise = channel.call('load', JSON.stringify(req), this.timeoutMs)
    const entry = { channel, req, promise }
    this.loading = entry
    const settle = () => {
      if (this.loading === entry) this.loading = null
    }
    promise.then(() => {
      // The worker answers in order, so the load that finished last is the one it holds.
      this.loaded = { channel, req }
      settle()
    }, settle)
    return promise
  }

  /** The live worker; a dead one (e.g. a replacement that failed to boot) is replaced here, on demand. */
  private current(): WorkerChannel {
    if (this.channel.dead) this.replace()
    return this.channel
  }

  private spawn(): WorkerChannel {
    const channel: WorkerChannel = new WorkerChannel(this.createWorker(), {
      onDead: (_reason, wasReady) => {
        // Replace a worker that died while working right away; one that never booted is replaced by the next call,
        // so a persistent boot failure cannot spin.
        if (channel === this.channel && wasReady) this.replace()
      },
    })
    return channel
  }

  private replace() {
    this.channel.dispose(new AbandonedSignal('recycled'))
    this.channel = this.spawn()
    this.loads = 0
    this.loaded = null
    this.loading = null
  }
}
