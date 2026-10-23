import { expect, test } from '@playwright/test'
import { observerSolution, setCode, waitReady } from './helpers'

const solution = observerSolution('complete')

// Real C# engine: the starter fails its checks, the reference solution passes them all.
test('the Observer "complete" exercise is graded in the browser', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/patterns/observer/practice/complete')
  await expect(page.getByRole('heading', { level: 1, name: 'Finish the weather station' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440)
  await waitReady(page)

  await expect(page.getByRole('button', { name: 'Reveal solution' })).toBeDisabled()
  await page.getByRole('button', { name: /^Check/ }).click()
  await expect(page.getByText(/^\d of 4 checks passed$/)).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText(/^4 of 4/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reveal solution' })).toBeEnabled()

  await setCode(page, solution)
  await page.getByRole('button', { name: /^Check/ }).click()
  await expect(page.getByText('Solved — every check passed.')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('4 of 4 checks passed')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Next exercise' })).toBeVisible()
})
