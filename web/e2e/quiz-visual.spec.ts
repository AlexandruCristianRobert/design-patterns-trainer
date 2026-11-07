import { expect, test } from '@playwright/test'

const url = '/dev/quiz-visual/configureawait-false-library'
const overflow = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

test('a wrong answer autoplays its Claim play; arrows step; Enter moves on mid-play', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(url)
  const panel = page.getByRole('region', { name: 'Question visual' })
  await expect(panel.getByText('Step 1 of 3')).toBeVisible()

  // before answering, ←/→ on a radio move the selection and leave the Setup alone
  await page.getByRole('radio').first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio').nth(1)).toBeChecked()
  await expect(panel.getByText('Step 1 of 3')).toBeVisible()

  await page.keyboard.press('2') // file order in the harness: index 1 is wrong
  await page.keyboard.press('Enter')
  await expect(panel.getByRole('button', { name: 'What B claims' })).toHaveAttribute('aria-pressed', 'true')
  await expect(panel.getByRole('button', { name: 'Pause' })).toBeVisible()
  expect(await overflow(page)).toBeLessThanOrEqual(0)

  await panel.getByRole('button', { name: 'What really happens' }).click()
  await page.getByRole('button', { name: 'Next question' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(panel.getByText('Step 2 of 6')).toBeVisible()

  await panel.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'Next question' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Question 2 of 2')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Question visual' })).toHaveCount(0)
})

test('keyboard focus on the visual panel steps and plays before answering', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(url)
  const panel = page.getByRole('region', { name: 'Question visual' })
  await expect(panel.getByText('Step 1 of 3')).toBeVisible()
  await panel.focus()
  await expect(panel).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(panel.getByText('Step 2 of 3')).toBeVisible()
  await page.keyboard.press('Space')
  await expect(panel.getByRole('button', { name: 'Pause' })).toBeVisible()
})

test('the visual fits a 390px screen without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(url)
  await expect(page.getByRole('region', { name: 'Question visual' }).getByText('Step 1 of 3')).toBeVisible()
  await page.keyboard.press('2')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Question visual' }).getByRole('button', { name: 'Pause' })).toBeVisible()
  expect(await overflow(page)).toBeLessThanOrEqual(0)
})
