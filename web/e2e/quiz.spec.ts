import { expect, test } from '@playwright/test'

test('a keyboard-only 5-question quiz lands in the history, and the length is remembered', async ({ page }) => {
  await page.goto('/quiz')
  await expect(page.getByRole('heading', { level: 1, name: 'Quiz' })).toBeVisible()
  await page.getByRole('button', { name: '5', exact: true }).click()
  await page.getByRole('button', { name: 'Start quiz' }).focus()
  await page.keyboard.press('Enter')

  for (let i = 1; i <= 5; i++) {
    await expect(page.getByText(`Question ${i} of 5`)).toBeVisible()
    await page.keyboard.press(String(((i - 1) % 4) + 1))
    await page.keyboard.press('Enter')
    await expect(page.locator('.quiz-outcome')).toBeVisible()
    await expect(page.locator('.quiz-explanation')).toHaveCount(4)
    await page.keyboard.press('Enter')
  }

  await expect(page.getByRole('heading', { name: 'Quiz complete' })).toBeVisible()
  await expect(page.getByText(/^\d \/ 5 \(\d+%\)$/)).toBeVisible()
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('region', { name: 'Quiz history' }).getByText(/^\d \/ 5$/)).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: '5', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('region', { name: 'Quiz history' }).getByText(/^\d \/ 5$/)).toBeVisible()
})

test('the quiz fits a 390px screen without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/quiz')
  await page.getByRole('button', { name: 'Start quiz' }).click()
  await page.keyboard.press('1')
  await page.keyboard.press('Enter')
  await expect(page.locator('.quiz-explanation')).toHaveCount(4)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
