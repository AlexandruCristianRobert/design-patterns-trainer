/// <reference lib="webworker" />
import { bootDotnet, loadIdeExports } from './dotnetBoot'
import { IdeHost } from './ideHost'
import { errorText, type FromWorker, type ToWorker } from './workerRpc'

const post = (m: FromWorker) => self.postMessage(m)

async function main() {
  let boot
  try {
    boot = await bootDotnet()
    boot.wasm.CompilerExports.WarmUp()
  } catch (e) {
    post({ type: 'bootError', message: errorText(e) })
    return
  }
  const { wasm, runtime } = boot
  // The IDE assemblies are fetched only on loadIde, and only by this worker (never the runner).
  const ide = new IdeHost(() => loadIdeExports(runtime))
  self.onmessage = async (e: MessageEvent<ToWorker>) => {
    const { id, method, payload } = e.data
    try {
      let result: string
      if (method === 'compile') result = wasm.CompilerExports.Compile(payload)
      else if (ide.handles(method)) result = await ide.handle(method, payload, id)
      else throw new Error(`Unknown method: ${method}`)
      post({ type: 'result', id, ok: true, result })
    } catch (err) {
      post({ type: 'result', id, ok: false, error: errorText(err) })
    }
  }
  post({ type: 'ready' })
}

void main()
