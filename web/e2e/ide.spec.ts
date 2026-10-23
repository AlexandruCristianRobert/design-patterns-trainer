import { expect, test, type Page, type Request } from '@playwright/test'
import { getCode, setCode, waitReady } from './helpers'

interface IdeManifest {
  assemblies: string[]
  bytes: number
}

declare global {
  interface Window {
    ideRpc: { send(id: number, method: string, payload: unknown): Promise<string> }
  }
}

const fileOf = (r: Request) => new URL(r.url()).pathname.split('/').pop() ?? ''

/**
 * Opens a same-origin document without the app (so only this test's compiler worker runs), starts a real compiler
 * worker there and exposes `window.ideRpc.send`, which posts one request and settles with its result or error.
 */
async function startCompilerWorker(page: Page): Promise<IdeManifest> {
  await page.goto('/dotnet/ide-manifest.json')
  const manifest = (await page.evaluate(() => JSON.parse(document.body.innerText))) as IdeManifest
  await page.evaluate(async () => {
    const worker = new Worker('/src/compiler/compiler.worker.ts', { type: 'module' })
    const waiting = new Map<number, (m: { ok: boolean; result?: string; error?: string }) => void>()
    await new Promise<void>((resolve, reject) => {
      worker.onmessage = (e) => {
        const m = e.data
        if (m.type === 'ready') resolve()
        else if (m.type === 'bootError') reject(new Error(m.message))
        else waiting.get(m.id)?.(m)
      }
    })
    window.ideRpc = {
      send: (id, method, payload) =>
        new Promise<string>((resolve, reject) => {
          waiting.set(id, (m) => (m.ok ? resolve(m.result!) : reject(new Error(m.error))))
          worker.postMessage({ id, method, payload: typeof payload === 'string' ? payload : JSON.stringify(payload) })
        }),
    }
  })
  return manifest
}

test('a normal Sandbox visit requests none of the lazy IDE assemblies', async ({ page, context }) => {
  const requested: string[] = []
  context.on('request', (r) => requested.push(fileOf(r)))
  await page.goto('/sandbox')
  await waitReady(page) // the compiler and the runner worker have both booted
  // The button's size is built in: nothing IDE-related is requested before the learner opts in.
  expect(requested).not.toContain('ide-manifest.json')

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
  const manifest = await startCompilerWorker(page)

  const out = await page.evaluate(async () => {
    const { send } = window.ideRpc
    const beforeLoad = await send(1, 'complete', { source: 'Console.', line: 1, column: 9 }).catch((e) => String(e))
    const t0 = performance.now()
    await send(2, 'loadIde', '')
    const loadMs = performance.now() - t0

    const completion = JSON.parse(await send(3, 'complete', { source: 'Console.', line: 1, column: 9 }))
    const format = JSON.parse(await send(4, 'format', { source: 'class C{void M(){}}' }))

    const lines = ['var list = new List<int>();', 'list.']
    for (let i = 0; lines.length < 150; i++) lines.push(`class H${i} { int _n; public void Handle(string r) { if (r.Length > ${i}) _n++; } }`)
    const big = { source: lines.join('\n'), line: 2, column: 6 }

    // Deterministic: both posted in the same task, so the newer one is queued before the older one can answer.
    const [olderAnswer, newerAnswer] = await Promise.all([send(10, 'complete', big), send(11, 'complete', big)])

    // Observation only (timing-dependent, never asserted): a newer completion posted 20 ms into a running one.
    const running = send(20, 'complete', big)
    await new Promise((r) => setTimeout(r, 20))
    const [midCallAnswer] = await Promise.all([running, send(21, 'complete', big)])

    return {
      beforeLoad,
      loadMs,
      labels: (completion.items as { label: string }[]).map((i) => i.label),
      range: completion.range,
      formatted: format.text as string,
      older: JSON.parse(olderAnswer),
      newerCount: (JSON.parse(newerAnswer).items as unknown[]).length,
      midCall: JSON.stringify(JSON.parse(midCallAnswer)).slice(0, 60),
    }
  })

  test.info().annotations.push(
    { type: 'loadIde ms', description: String(Math.round(out.loadMs)) },
    { type: 'cancel 20 ms into a running completion', description: out.midCall },
  )
  console.log(`loadIde (fetch 9 files + load + WarmUp): ${Math.round(out.loadMs)} ms; 20 ms cancel answer: ${out.midCall}`)
  expect(out.beforeLoad).toContain('IDE features are not loaded')
  expect(out.labels).toContain('WriteLine')
  expect(out.range).toEqual({ startLine: 1, startColumn: 9, endLine: 1, endColumn: 9 })
  expect(out.formatted).toContain('\n')
  expect(out.older).toMatchObject({ superseded: true })
  expect(out.newerCount).toBeGreaterThan(0)
  expect(manifest.assemblies.every((a) => requested.includes(a))).toBe(true)
})

test('a failed IDE download says to reload and leaves the compiler working', async ({ page }) => {
  await page.goto('/dotnet/ide-manifest.json')
  const { assemblies } = (await page.evaluate(() => JSON.parse(document.body.innerText))) as IdeManifest
  const humanizer = assemblies.find((a) => a.startsWith('Humanizer.'))! // the first one loaded
  await page.route(
    (url) => url.pathname.endsWith(`/${humanizer}`),
    (route) => route.fulfill({ status: 503, body: 'unavailable' }),
  )
  await startCompilerWorker(page)

  const out = await page.evaluate(async () => {
    const { send } = window.ideRpc
    const compile = async (id: number) =>
      JSON.parse(await send(id, 'compile', { source: 'Console.WriteLine(1);', purpose: 'run' })).success as boolean
    const firstLoad = await send(1, 'loadIde', '').then(() => 'resolved', (e: Error) => e.message)
    const compiled = await compile(2)
    const secondLoad = await send(3, 'loadIde', '').then(() => 'resolved', (e: Error) => e.message)
    const complete = await send(4, 'complete', { source: 'x', line: 1, column: 1 }).then(() => 'resolved', (e: Error) => e.message)
    return { firstLoad, compiled, secondLoad, complete, compiledAgain: await compile(5) }
  })

  expect(out.firstLoad).toContain("IDE features couldn't be downloaded; reload the page to try again.")
  expect(out.compiled).toBe(true)
  expect(out.secondLoad).toContain("IDE features couldn't be downloaded; reload the page to try again.")
  expect(out.complete).toContain('IDE features are not loaded')
  expect(out.compiledAgain).toBe(true)
})

// ---- UI-level flow ----

const enableButton = (page: Page) => page.getByRole('button', { name: /^Enable IDE features/ })
const onButton = (page: Page) => page.getByRole('button', { name: 'IDE features on' })

/** The toolbar button opens a small offer with the size; its own Enable IDE features button starts the download. */
async function enableIde(page: Page) {
  await enableButton(page).click()
  const offer = page.getByRole('dialog', { name: 'Enable IDE features' })
  await expect(offer).toContainText(/IDE features download about \d+\.\d MB\./)
  await offer.getByRole('button', { name: 'Enable IDE features' }).click()
  await expect(onButton(page)).toBeVisible({ timeout: 120_000 })
}

/** Replaces the model's text, focuses the editor and puts the cursor at the end of the last line. */
async function typeInEditor(page: Page, text: string) {
  await page.locator('.monaco-editor').first().click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  await page.keyboard.type(text, { delay: 15 })
}

const cursor = (page: Page) =>
  page.evaluate(() => {
    const m = (window as unknown as { monaco: { editor: { getEditors(): { getPosition(): { lineNumber: number; column: number } }[] } } }).monaco
    const p = m.editor.getEditors()[0].getPosition()
    return { line: p.lineNumber, column: p.column }
  })

/** Strict: one typed sequence, no re-invoking suggest. Typing past the "." must not close the session. */
async function expectCompletion(page: Page) {
  await typeInEditor(page, 'Console.WriteL')
  await expect(page.locator('.suggest-widget .monaco-list-row', { hasText: 'WriteLine' }).first()).toBeVisible({
    timeout: 30_000,
  })
}

test('enabling IDE features gives completion, hover, definition and format', async ({ page }) => {
  await page.goto('/sandbox')
  await waitReady(page)
  await enableIde(page)

  await expectCompletion(page)
  await page.keyboard.press('Escape')

  // Hover: the signature, not just the name
  await setCode(page, 'Console.WriteLine')
  const word = page.locator('.monaco-editor .view-line span span', { hasText: 'WriteLine' }).first()
  const hover = page.locator('.monaco-hover').filter({ hasText: '(' }).first()
  await expect(async () => {
    await page.mouse.move(0, 0)
    await word.hover()
    await expect(hover).toBeVisible({ timeout: 5_000 })
  }).toPass({ timeout: 45_000 })
  await expect(hover).toContainText('WriteLine')

  // Go to definition
  await setCode(page, 'int Add(int a, int b) => a + b;\nvar x = Add(1, 2);\n')
  await page.locator('.monaco-editor').first().click()
  await page.evaluate(() => {
    const m = (window as unknown as { monaco: { editor: { getEditors(): { setPosition(p: unknown): void; focus(): void }[] } } }).monaco
    const ed = m.editor.getEditors()[0]
    ed.setPosition({ lineNumber: 2, column: 10 })
    ed.focus()
  })
  await expect(async () => {
    await page.keyboard.press('F12')
    await expect.poll(() => cursor(page), { timeout: 5_000 }).toMatchObject({ line: 1 })
  }).toPass({ timeout: 45_000 })

  // Format
  await setCode(page, 'class C{void M(){}}')
  await page.locator('.monaco-editor').first().click()
  await expect(async () => {
    if ((await getCode(page)) === 'class C{void M(){}}') await page.keyboard.press('Shift+Alt+F')
    await expect.poll(async () => (await getCode(page)).includes('\n'), { timeout: 5_000 }).toBe(true)
  }).toPass({ timeout: 45_000 })
})

test('auto-load setting loads on the next visit', async ({ page }) => {
  await page.goto('/sandbox')
  await waitReady(page)
  await enableIde(page)
  await onButton(page).click()
  const autoload = page.getByLabel('Load IDE features automatically on this device')
  await autoload.check()
  await expect(autoload).toBeChecked()
  await page.reload()
  await expect(onButton(page)).toBeVisible({ timeout: 120_000 })
})

test('IDE features work in an exam session', async ({ page }) => {
  await page.goto('/exam?pattern=observer')
  await page.getByLabel('Number of questions').fill('1')
  await page.getByRole('button', { name: 'Start exam' }).click()
  await expect(page).toHaveURL(/\/exam\/[0-9a-f-]+$/)
  await waitReady(page)
  await enableIde(page)
  await expectCompletion(page)
})
