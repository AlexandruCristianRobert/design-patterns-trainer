/// <reference lib="webworker" />
import { bootDotnet } from './dotnetBoot'
import { errorText, type FromWorker, type ToWorker } from './workerRpc'

const post = (m: FromWorker) => self.postMessage(m)

async function main() {
  let exports
  try {
    exports = await bootDotnet()
    exports.CompilerExports.WarmUp()
  } catch (e) {
    post({ type: 'bootError', message: errorText(e) })
    return
  }
  self.onmessage = (e: MessageEvent<ToWorker>) => {
    const { id, method, payload } = e.data
    try {
      if (method !== 'compile') throw new Error(`Unknown method: ${method}`)
      post({ type: 'result', id, ok: true, result: exports.CompilerExports.Compile(payload) })
    } catch (err) {
      post({ type: 'result', id, ok: false, error: errorText(err) })
    }
  }
  post({ type: 'ready' })
}

void main()
