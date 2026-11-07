import { expect, test, type Locator, type Page } from '@playwright/test'
import { readdirSync } from 'node:fs'

// Review screenshots (spec §8), not a test: run with SHOTS=1, optionally VISUAL=<question-id>[,<question-id>…].
const dir = new URL('../../content/quiz/visuals/', import.meta.url)
const ids = readdirSync(dir).filter((f) => f.endsWith('.en.yaml')).map((f) => f.replace(/\.en\.yaml$/, ''))

test.skip(!process.env.SHOTS, 'set SHOTS=1 to capture review screenshots')

async function shootSteps(page: Page, panel: Locator, out: string) {
  const pos = panel.getByText(/^Step \d+ of \d+$/)
  const total = Number((await pos.textContent())!.match(/of (\d+)/)![1])
  for (let i = 1; i <= total; i++) {
    await expect(pos).toHaveText(`Step ${i} of ${total}`)
    await page.screenshot({ path: `${out}-${i}.png`, fullPage: true })
    if (i < total) await panel.getByRole('button', { name: 'Step forward' }).click()
  }
}

for (const id of ids.filter((i) => !process.env.VISUAL || process.env.VISUAL.split(",").includes(i))) {
  for (const width of [1920, 390]) {
    test(`${id} @${width}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' }) // no autoplay, no fades: every shot is a settled step
      await page.setViewportSize({ width, height: 1080 })
      await page.goto(`/dev/quiz-visual/${id}`)
      const panel = page.getByRole('region', { name: 'Question visual' })
      await expect(panel.getByRole('figure').first()).not.toContainText('Loading the picture', { timeout: 20_000 }) // a cold dev server can take a while
      const out = `test-results/visual-shots/${id}/${width}`
      await shootSteps(page, panel, `${out}/setup`)
      const correct = Number(await page.getByTestId('dev-correct').textContent())
      await page.getByRole('radio').nth(correct).check()
      await page.getByRole('button', { name: 'Submit' }).click()
      const tabs = panel.getByRole('group', { name: 'Views' }).getByRole('button')
      for (let t = 0; t < (await tabs.count()); t++) {
        const name = (await tabs.nth(t).textContent())!.replace(/\W+/g, '-').toLowerCase()
        await tabs.nth(t).click()
        await shootSteps(page, panel, `${out}/${t + 1}-${name}`)
      }
    })
  }
}
