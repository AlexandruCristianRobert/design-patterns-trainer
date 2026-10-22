export type ToWorker = { id: number; method: string; payload: string }
export type FromWorker =
  | { type: 'ready' }
  | { type: 'bootError'; message: string }
  | { type: 'result'; id: number; ok: true; result: string }
  | { type: 'result'; id: number; ok: false; error: string }

export interface WorkerLike {
  postMessage(m: ToWorker): void
  terminate(): void
  onmessage: ((e: { data: FromWorker }) => void) | null
  /** The DOM Worker `error` event: an uncaught error inside the worker. */
  onerror: ((e: { message?: string; preventDefault?(): void }) => void) | null
}

/** The request ran longer than its time limit; the worker has been terminated. */
export class TimeoutSignal extends Error {
  constructor() {
    super('timed out')
  }
}

/** The worker, or the .NET runtime inside it, died (or never booted); the worker has been terminated. */
export class CrashSignal extends Error {}

/** The worker was terminated because of another request before this one finished; the request is safe to retry. */
export class AbandonedSignal extends Error {}

/**
 * A .NET runtime that called exit() (e.g. after a StackOverflowException) rejects every later call with
 * "Program terminated with exit(n)"; that worker is dead for good. Ordinary learner exceptions never get here:
 * .NET returns them as RunOutcome.exception.
 */
export function isRuntimeExit(message: string): boolean {
  return message.includes('Program terminated') || message.includes('exit(')
}

/** Message of anything thrown, including the runtime's ExitStatus, a plain { name, message, status } object. */
export function errorText(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message
  }
  return String(err)
}

interface Pending {
  resolve(result: string): void
  reject(error: Error): void
  timer?: ReturnType<typeof setTimeout>
}

interface Request {
  id: number
  method: string
  payload: string
  timeoutMs?: number
}

export interface WorkerChannelOptions {
  /**
   * Called synchronously when the worker dies (boot error, crash, runtime exit or a timed-out request), after the
   * worker is terminated and every pending request is settled. Not called for dispose().
   */
  onDead?(reason: Error, wasReady: boolean): void
}

/** Request/response correlation over a WorkerLike; requests queue until the worker reports ready. */
export class WorkerChannel {
  readonly ready: Promise<void>
  /** Resolves with the reason once the worker has died (never on dispose). */
  readonly failed: Promise<Error>
  private nextId = 1
  private pending = new Map<number, Pending>()
  private isReady = false
  private failure: Error | null = null
  private queue: Request[] = []
  private resolveReady!: () => void
  private rejectReady!: (e: Error) => void
  private resolveFailed!: (e: Error) => void

  private readonly worker: WorkerLike
  private readonly onDead?: WorkerChannelOptions['onDead']

  constructor(worker: WorkerLike, options?: WorkerChannelOptions) {
    this.worker = worker
    this.onDead = options?.onDead
    this.ready = new Promise<void>((res, rej) => {
      this.resolveReady = res
      this.rejectReady = rej
    })
    this.ready.catch(() => {})
    this.failed = new Promise<Error>((res) => (this.resolveFailed = res))
    worker.onmessage = (e) => this.onMessage(e.data)
    worker.onerror = (e) => {
      e.preventDefault?.()
      this.die(new CrashSignal(e.message || 'The worker stopped unexpectedly'))
    }
  }

  get dead(): boolean {
    return this.failure !== null
  }

  /** True while any request is queued or in flight. */
  get busy(): boolean {
    return this.pending.size > 0
  }

  /**
   * Rejects with TimeoutSignal if timeoutMs elapses after the request is posted to a ready worker; the worker is then
   * terminated and the other pending requests reject with AbandonedSignal.
   */
  call(method: string, payload: string, timeoutMs?: number): Promise<string> {
    if (this.failure) return Promise.reject(this.lateFailure())
    const id = this.nextId++
    return new Promise<string>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      const req = { id, method, payload, timeoutMs }
      if (this.isReady) this.post(req)
      else this.queue.push(req)
    })
  }

  /** Terminates the worker; pending requests reject with `reason`. */
  dispose(reason: Error = new Error('Worker disposed')) {
    if (this.failure) return
    this.shutDown(reason, () => reason)
  }

  private post(req: Request) {
    const p = this.pending.get(req.id)
    if (!p) return
    if (req.timeoutMs !== undefined) {
      p.timer = setTimeout(() => this.die(new TimeoutSignal(), req.id), req.timeoutMs)
    }
    this.worker.postMessage({ id: req.id, method: req.method, payload: req.payload })
  }

  private onMessage(m: FromWorker) {
    if (this.failure) return
    if (m.type === 'ready') {
      this.isReady = true
      this.resolveReady()
      for (const req of this.queue.splice(0)) this.post(req)
    } else if (m.type === 'bootError') {
      this.die(new CrashSignal(m.message))
    } else if (!m.ok && isRuntimeExit(m.error)) {
      this.die(new CrashSignal(m.error))
    } else {
      const p = this.pending.get(m.id)
      if (!p) return
      this.pending.delete(m.id)
      clearTimeout(p.timer)
      if (m.ok) p.resolve(m.result)
      else p.reject(new Error(m.error))
    }
  }

  /**
   * The worker is unusable: terminate it and settle everything. A timeout blames only the request that timed out;
   * the others never got their turn and may be retried elsewhere. A crash takes down everything in flight.
   */
  private die(reason: Error, culprit?: number) {
    if (this.failure) return
    const wasReady = this.isReady
    this.shutDown(reason, (id) =>
      reason instanceof TimeoutSignal && id !== culprit ? new AbandonedSignal(reason.message) : reason,
    )
    this.rejectReady(reason)
    this.resolveFailed(reason)
    this.onDead?.(reason, wasReady)
  }

  private shutDown(failure: Error, reasonFor: (id: number) => Error) {
    this.failure = failure
    this.worker.onmessage = null
    this.worker.onerror = null
    this.worker.terminate()
    this.queue = []
    const pending = [...this.pending]
    this.pending.clear()
    for (const [id, p] of pending) {
      clearTimeout(p.timer)
      p.reject(reasonFor(id))
    }
  }

  /** What a call made after death sees: it never reached the worker, so it is retryable unless the worker crashed. */
  private lateFailure(): Error {
    return this.failure instanceof TimeoutSignal ? new AbandonedSignal(this.failure.message) : this.failure!
  }
}
