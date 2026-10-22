import { useEffect, useRef, useState } from 'react'
import type { CompilerClient } from '../compiler/CompilerClient'
import type { DiagnosticInfo } from '../compiler/protocol'

/** Compiles `source` for diagnostics 500 ms after the last change; only the newest request's result is kept. */
export function useLiveDiagnostics(
  source: string,
  compiler: Pick<CompilerClient, 'compile'> | null,
  delayMs = 500,
): DiagnosticInfo[] {
  const [diagnostics, setDiagnostics] = useState<DiagnosticInfo[]>([])
  const latest = useRef(0)

  useEffect(() => {
    if (!compiler) return
    const timer = setTimeout(() => {
      const request = ++latest.current
      compiler.compile({ source, purpose: 'diagnostics' }).then(
        (res) => {
          if (request === latest.current) setDiagnostics(res.diagnostics)
        },
        () => {
          // A failed pass keeps the previous markers. A dead compiler is not hidden: CompilerProvider turns its status
          // to 'failed' (shown with a reload action) and callers then pass compiler = null, which stops this hook.
        },
      )
    }, delayMs)
    return () => clearTimeout(timer)
  }, [source, compiler, delayMs])

  return diagnostics
}
