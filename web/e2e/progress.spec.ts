import { expect, test } from '@playwright/test'

test('Progress shows the empty state, then the Observer Lesson visit', async ({ page }) => {
  await page.goto('/progress')
  await expect(page.getByRole('heading', { level: 1, name: 'Progress' })).toBeVisible()
  await expect(page.getByText('Nothing here yet — open a pattern in the Catalog to start.')).toBeVisible()
  await page.getByRole('link', { name: 'Open the Catalog' }).click()
  await page.getByRole('link', { name: 'Observer' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Problem' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Progress' }).click()
  await expect(page.getByText('Lesson visited')).toBeVisible()
  await expect(page.getByText('0 of 3 exercises solved')).toBeVisible()
  await expect(page.getByLabel('Import progress')).toBeVisible()
})
