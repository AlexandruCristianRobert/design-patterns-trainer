/// <reference lib="webworker" />
import { bootDotnet } from './dotnetBoot'
import { errorText, isRuntimeExit, type FromWorker, type ToWorker } from './workerRpc'

const post = (m: FromWorker) => self.postMessage(m)

// When learner code kills the runtime (e.g. a stack overflow), .NET prints
// "FATAL UNHANDLED EXCEPTION: System.StackOverflowException: ..." to the console and then rejects the call with
// "Program terminated with exit(1)". Remember the exception type so the error can name it.
let fatalType: string | null = null
for (const level of ['error', 'warn', 'log'] as const) {
  const original = console[level].bind(console)
  console[level] = (...args: unknown[]) => {
    const match = /FATAL UNHANDLED EXCEPTION: ([\w.`]+)/.exec(args.map(String).join(' '))
    if (match) fatalType = match[1]
    original(...args)
  }
}

function errorMessage(err: unknown): string {
  const message = errorText(err)
  return isRuntimeExit(message) && fatalType ? `${message} (${fatalType})` : message
}

async function main() {
  let exports
  try {
    exports = await bootDotnet()
  } catch (e) {
    post({ type: 'bootError', message: errorText(e) })
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
      post({ type: 'result', id, ok: false, error: errorMessage(err) })
    }
  }
  post({ type: 'ready' })
}

void main()
