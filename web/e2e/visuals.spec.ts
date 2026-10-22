import { expect, test } from '@playwright/test'

// Real layout (jsdom has none): React Flow measures the class boxes before it can draw the UML edges.
test('the Observer Structure Diagram and Interaction Scene render and link code lines', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dev/visuals')
  await expect(page.locator('.react-flow__edge')).toHaveCount(3)
  await expect(page.getByText('observers 0..*')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

  await page.getByTestId('class-observer').focus()
  await expect(page.locator('.dev-line-on')).toHaveCount(4) // lines 12–15

  const scene = page.getByRole('region', { name: 'Interaction scene' })
  await scene.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('slider', { name: 'Step 2 of 7' })).toBeVisible()
  await expect(page.locator('.dev-line-on')).toHaveText(/station\.Subscribe\(tv\)/)
})
