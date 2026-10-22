import type { FromWorker, ToWorker, WorkerLike } from '../workerRpc'

export class FakeWorker implements WorkerLike {
  posted: ToWorker[] = []
  terminated = false
  onmessage: ((e: { data: FromWorker }) => void) | null = null

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
  reply(id: number, result: string) {
    this.emit({ type: 'result', id, ok: true, result })
  }
  replyError(id: number, error: string) {
    this.emit({ type: 'result', id, ok: false, error })
  }
}
