import { expect, test } from '@playwright/test'
import { waitReady } from './helpers'

// Real layout and the real C# engine: diagram and scene drive the example's highlighted lines, and Run works.
test('the Observer Lesson links diagram and scene to the example, and runs it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/patterns/observer')
  await expect(page.getByRole('heading', { level: 2, name: 'Problem' })).toBeVisible({ timeout: 30_000 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440)

  await page.getByTestId('class-observer').focus()
  await expect(page.locator('.code-editor .line-linked')).toHaveCount(4)

  const scene = page.getByRole('region', { name: 'Interaction scene' })
  await scene.focus()
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('slider', { name: 'Step 4 of 7' })).toBeVisible()
  await expect(page.locator('.code-editor .line-linked')).toHaveCount(2)

  // The section strip follows the reader: jumping to the example marks it as current.
  await page.getByRole('link', { name: 'C# example' }).click()
  await expect(page.locator('.lesson-toc a[aria-current]')).toHaveText('C# example')

  await waitReady(page)
  await page.getByRole('button', { name: /^Run/ }).click()
  await expect(page.locator('.stdout')).not.toBeEmpty({ timeout: 60_000 })
})
