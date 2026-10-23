import { expect, test } from '@playwright/test'
import { examSolutions, questionTitle, setCode, waitReady } from './helpers'

const shots = process.env.SHOT_DIR

for (const width of [390, 1440]) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })
    test('completes a 3-question Observer exam in the browser', async ({ page }) => {
      const bySolution = examSolutions()
      await page.goto('/exam')
      await page.getByRole('button', { name: 'Start exam' }).click()
      await expect(page).toHaveURL(/\/exam\/[0-9a-f-]+$/)
      await waitReady(page)
      await expect(page.getByRole('heading', { level: 1, name: 'Question 1 of 3' })).toBeVisible()
      await expect(page.getByRole('timer')).toBeVisible()
      if (shots) await page.screenshot({ path: `${shots}/session-${width}.png`, fullPage: true })

      for (let n = 1; n <= 3; n++) {
        await page.getByRole('navigation', { name: 'Questions' }).getByRole('button', { name: new RegExp(`Question ${n}`) }).click()
        await expect(page.getByRole('heading', { level: 1, name: `Question ${n} of 3` })).toBeVisible()
        const title = await questionTitle(page)
        await page.getByLabel('Which pattern does this call for?').selectOption('observer')
        await setCode(page, bySolution[title])
      }
      await expect(page.getByRole('button', { name: /Question \d, answered/ })).toHaveCount(3)
      if (shots) await page.screenshot({ path: `${shots}/answered-${width}.png`, fullPage: true })

      await page.getByRole('button', { name: 'Submit exam' }).click()
      await expect(page.getByText("Submit your exam? You can't change your answers afterwards.")).toBeVisible()
      await expect(page.getByRole('button', { name: 'Keep working' })).toBeFocused()
      if (shots) await page.screenshot({ path: `${shots}/confirm-${width}.png` })
      await page.getByRole('group', { name: /Submit your exam/ }).getByRole('button', { name: 'Submit exam' }).click()
      await expect(page).toHaveURL(/\/exam\/[0-9a-f-]+\/report$/, { timeout: 120_000 })
      await expect(page.getByRole('heading', { level: 1, name: 'Exam report' })).toBeVisible()
      await expect(page.getByRole('heading', { level: 2 })).toHaveCount(3)
      await expect(page.getByText('Passed', { exact: true })).toBeVisible()
      await expect(page.getByRole('link', { name: 'See exam history' })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      if (shots) await page.screenshot({ path: `${shots}/report-${width}.png`, fullPage: true })
    })
  })
}
