import { expect, test } from '@playwright/test'

test('the Catalog is home and links into the Observer Lesson', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Catalog' })).toBeVisible()
  await expect(page.getByText('2 of 11 available')).toBeVisible()
  await page.getByRole('link', { name: 'Observer' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Problem' })).toBeVisible()
  await expect(page).toHaveURL(/\/patterns\/observer$/)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Sandbox' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sandbox' })).toBeVisible()
})
