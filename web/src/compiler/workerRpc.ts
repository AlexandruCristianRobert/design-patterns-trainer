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
}

export class TimeoutSignal extends Error {
  constructor() {
    super('timed out')
  }
}

interface Pending {
  resolve(result: string): void
  reject(error: Error): void
  timer?: ReturnType<typeof setTimeout>
}

/** Request/response correlation over a WorkerLike; requests queue until the worker reports ready. */
export class WorkerChannel {
  readonly ready: Promise<void>
  private nextId = 1
  private pending = new Map<number, Pending>()
  private isReady = false
  private failure: Error | null = null
  private queue: Array<{ id: number; method: string; payload: string; timeoutMs?: number }> = []
  private resolveReady!: () => void
  private rejectReady!: (e: Error) => void

  private readonly worker: WorkerLike

  constructor(worker: WorkerLike) {
    this.worker = worker
    this.ready = new Promise<void>((res, rej) => {
      this.resolveReady = res
      this.rejectReady = rej
    })
    this.ready.catch(() => {})
    worker.onmessage = (e) => this.onMessage(e.data)
  }

  /** Rejects with TimeoutSignal if timeoutMs elapses after the request is posted to a ready worker. */
  call(method: string, payload: string, timeoutMs?: number): Promise<string> {
    if (this.failure) return Promise.reject(this.failure)
    const id = this.nextId++
    return new Promise<string>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      const req = { id, method, payload, timeoutMs }
      if (this.isReady) this.post(req)
      else this.queue.push(req)
    })
  }

  dispose() {
    this.worker.onmessage = null
    this.worker.terminate()
    this.fail(new Error('Worker disposed'))
  }

  private post(req: { id: number; method: string; payload: string; timeoutMs?: number }) {
    const p = this.pending.get(req.id)
    if (!p) return
    if (req.timeoutMs !== undefined) {
      p.timer = setTimeout(() => {
        this.pending.delete(req.id)
        p.reject(new TimeoutSignal())
      }, req.timeoutMs)
    }
    this.worker.postMessage({ id: req.id, method: req.method, payload: req.payload })
  }

  private onMessage(m: FromWorker) {
    if (m.type === 'ready') {
      this.isReady = true
      this.resolveReady()
      for (const req of this.queue.splice(0)) this.post(req)
    } else if (m.type === 'bootError') {
      const err = new Error(m.message)
      this.rejectReady(err)
      this.fail(err)
    } else {
      const p = this.pending.get(m.id)
      if (!p) return
      this.pending.delete(m.id)
      clearTimeout(p.timer)
      if (m.ok) p.resolve(m.result)
      else p.reject(new Error(m.error))
    }
  }

  private fail(err: Error) {
    this.failure = err
    this.queue = []
    for (const p of this.pending.values()) {
      clearTimeout(p.timer)
      p.reject(err)
    }
    this.pending.clear()
  }
}
