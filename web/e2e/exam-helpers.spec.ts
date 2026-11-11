import { expect, test } from '@playwright/test'
import { examSolutions, getCode, questionTitle, waitReady } from './helpers'

test('practises a one-question exam with Helpers', async ({ page }) => {
  const bySolution = examSolutions()
  await page.goto('/exam')
  await page.getByLabel('Number of questions').fill('1')
  await page.getByRole('switch', { name: /Named mode/ }).check()
  await page.getByRole('switch', { name: /Helpers/ }).check()
  await page.getByRole('button', { name: 'Start exam' }).click()
  await expect(page).toHaveURL(/\/exam\/[0-9a-f-]+$/)
  await waitReady(page)
  const title = await questionTitle(page)

  await page.getByRole('button', { name: 'Show pattern' }).click()
  await expect(page.getByRole('link', { name: /Lesson in a new tab/ })).toBeVisible()

  await page.getByRole('button', { name: 'Reveal solution' }).click()
  await page.getByRole('button', { name: 'Copy into editor' }).click()
  await page.getByRole('button', { name: 'Replace my code' }).click()
  await expect.poll(() => getCode(page)).toBe(bySolution[title])

  await page.getByRole('button', { name: 'Check my answer' }).click()
  await expect(page.getByText(/^(\d+) of \1 Checks pass$/)).toBeVisible({ timeout: 120_000 })

  await page.getByRole('button', { name: 'Submit exam' }).click()
  await page.getByRole('group', { name: /Submit your exam/ }).getByRole('button', { name: 'Submit exam' }).click()
  await expect(page).toHaveURL(/\/report$/, { timeout: 120_000 })
  await expect(page.getByText('Helpers used: show pattern, solution, check my answer')).toBeVisible()
  await expect(page.getByText('Passed', { exact: true })).toBeVisible()

  await page.goto('/progress')
  await expect(page.getByText(/with helpers/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
