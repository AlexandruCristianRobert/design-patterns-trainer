/// <reference lib="webworker" />
import { bootDotnet } from './dotnetBoot'
import type { FromWorker, ToWorker } from './workerRpc'

const post = (m: FromWorker) => self.postMessage(m)

async function main() {
  let exports
  try {
    exports = await bootDotnet()
    exports.CompilerExports.WarmUp()
  } catch (e) {
    post({ type: 'bootError', message: e instanceof Error ? e.message : String(e) })
    return
  }
  self.onmessage = (e: MessageEvent<ToWorker>) => {
    const { id, method, payload } = e.data
    try {
      if (method !== 'compile') throw new Error(`Unknown method: ${method}`)
      post({ type: 'result', id, ok: true, result: exports.CompilerExports.Compile(payload) })
    } catch (err) {
      post({ type: 'result', id, ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }
  post({ type: 'ready' })
}

void main()
