import type { FromWorker, ToWorker, WorkerLike } from '../workerRpc'

export class FakeWorker implements WorkerLike {
  posted: ToWorker[] = []
  terminated = false
  onmessage: ((e: { data: FromWorker }) => void) | null = null
  onerror: ((e: { message?: string }) => void) | null = null

  postMessage(m: ToWorker) {
    this.posted.push(m)
  }
  terminate() {
    this.terminated = true
  }
  emit(data: FromWorker) {
    this.onmessage?.({ data })
  }
  emitReady() {
    this.emit({ type: 'ready' })
  }
  emitBootError(message: string) {
    this.emit({ type: 'bootError', message })
  }
  /** The browser's Worker `error` event (uncaught error inside the worker). */
  emitError(message: string) {
    this.onerror?.({ message })
  }
  reply(id: number, result: string) {
    this.emit({ type: 'result', id, ok: true, result })
  }
  replyError(id: number, error: string) {
    this.emit({ type: 'result', id, ok: false, error })
  }
  /** Last posted message (the request the worker is currently working on). */
  last(): ToWorker {
    return this.posted[this.posted.length - 1]
  }
}
