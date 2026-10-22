/// <reference lib="webworker" />
import { bootDotnet } from './dotnetBoot'
import type { FromWorker, ToWorker } from './workerRpc'

const post = (m: FromWorker) => self.postMessage(m)

async function main() {
  let exports
  try {
    exports = await bootDotnet()
  } catch (e) {
    post({ type: 'bootError', message: e instanceof Error ? e.message : String(e) })
    return
  }
  const runner = exports.RunnerExports
  self.onmessage = async (e: MessageEvent<ToWorker>) => {
    const { id, method, payload } = e.data
    try {
      let result: string
      switch (method) {
        case 'load':
          result = runner.Load(payload)
          break
        case 'runMain':
          result = await runner.RunMain()
          break
        case 'runCheck':
          result = await runner.RunCheck(payload)
          break
        default:
          throw new Error(`Unknown method: ${method}`)
      }
      post({ type: 'result', id, ok: true, result })
    } catch (err) {
      post({ type: 'result', id, ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }
  post({ type: 'ready' })
}

void main()
