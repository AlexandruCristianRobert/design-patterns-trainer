import { expect, test, type Request } from '@playwright/test'
import { waitReady } from './helpers'

interface IdeManifest {
  assemblies: string[]
  bytes: number
}

const fileOf = (r: Request) => new URL(r.url()).pathname.split('/').pop() ?? ''

test('a normal Sandbox visit requests none of the lazy IDE assemblies', async ({ page, context }) => {
  const requested: string[] = []
  context.on('request', (r) => requested.push(fileOf(r)))
  await page.goto('/sandbox')
  await waitReady(page) // the compiler and the runner worker have both booted

  const manifest = (await (await page.request.get('/dotnet/ide-manifest.json')).json()) as IdeManifest
  expect(manifest.assemblies).toHaveLength(9)
  expect(manifest.bytes).toBeGreaterThan(1_000_000)
  // The workers' own requests are seen: the default bundle was fetched.
  expect(requested.some((f) => /^DesignPatterns\.Core\.[a-z0-9]+\.wasm$/.test(f))).toBe(true)
  expect(requested.filter((f) => manifest.assemblies.includes(f))).toEqual([])
})

test('the compiler worker loads the IDE on loadIde and then completes, formats and supersedes', async ({
  page,
  context,
}) => {
  const requested: string[] = []
  context.on('request', (r) => requested.push(fileOf(r)))
  // A same-origin document without the app, so only this test's compiler worker runs.
  await page.goto('/dotnet/ide-manifest.json')
  const manifest = (await page.evaluate(() => JSON.parse(document.body.innerText))) as IdeManifest

  const out = await page.evaluate(async () => {
    const worker = new Worker('/src/compiler/compiler.worker.ts', { type: 'module' })
    const waiting = new Map<number, (m: { ok: boolean; result?: string; error?: string }) => void>()
    const ready = new Promise<void>((resolve, reject) => {
      worker.onmessage = (e) => {
        const m = e.data
        if (m.type === 'ready') resolve()
        else if (m.type === 'bootError') reject(new Error(m.message))
        else waiting.get(m.id)?.(m)
      }
    })
    const send = (id: number, method: string, payload: unknown) =>
      new Promise<string>((resolve, reject) => {
        waiting.set(id, (m) => (m.ok ? resolve(m.result!) : reject(new Error(m.error))))
        worker.postMessage({ id, method, payload: typeof payload === 'string' ? payload : JSON.stringify(payload) })
      })

    await ready
    const beforeLoad = await send(1, 'complete', { source: 'Console.', line: 1, column: 9 }).catch((e) => String(e))
    const t0 = performance.now()
    await send(2, 'loadIde', '')
    const loadMs = performance.now() - t0

    const completion = JSON.parse(await send(3, 'complete', { source: 'Console.', line: 1, column: 9 }))
    const format = JSON.parse(await send(4, 'format', { source: 'class C{void M(){}}' }))

    // Supersession: a newer completion posted while the older one runs (150-line file, ~100 ms warm).
    const lines = ['var list = new List<int>();', 'list.']
    for (let i = 0; lines.length < 150; i++) lines.push(`class H${i} { int _n; public void Handle(string r) { if (r.Length > ${i}) _n++; } }`)
    const big = { source: lines.join('\n'), line: 2, column: 6 }
    const older = send(10, 'complete', big)
    await new Promise((r) => setTimeout(r, 20))
    const newer = send(11, 'complete', big)
    const [olderAnswer, newerAnswer] = await Promise.all([older, newer])
    worker.terminate()
    return {
      beforeLoad,
      loadMs,
      labels: (completion.items as { label: string }[]).map((i) => i.label),
      range: completion.range,
      formatted: format.text as string,
      older: JSON.parse(olderAnswer),
      newerCount: (JSON.parse(newerAnswer).items as unknown[]).length,
    }
  })

  test.info().annotations.push(
    { type: 'loadIde ms', description: String(Math.round(out.loadMs)) },
    { type: 'older answer', description: JSON.stringify(out.older).slice(0, 80) },
  )
  console.log(`loadIde (fetch 9 files + load + WarmUp): ${Math.round(out.loadMs)} ms; older answer: ${JSON.stringify(out.older)}`)
  expect(out.beforeLoad).toContain('IDE features are not loaded')
  expect(out.labels).toContain('WriteLine')
  expect(out.range).toEqual({ startLine: 1, startColumn: 9, endLine: 1, endColumn: 9 })
  expect(out.formatted).toContain('\n')
  expect(out.older).toEqual({ superseded: true, cancelled: true })
  expect(out.newerCount).toBeGreaterThan(0)
  expect(manifest.assemblies.every((a) => requested.includes(a))).toBe(true)
})
