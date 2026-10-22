import { expect, test } from '@playwright/test'

test('grades a Singleton in the browser', async ({ page }) => {
  await page.goto('/dev/engine')
  const text = await page.getByTestId('engine-results').textContent({ timeout: 90_000 })
  const results = JSON.parse(text ?? '[]') as { id: string; status: string }[]
  expect(results.map((r) => [r.id, r.status])).toEqual([
    ['same-instance', 'passed'],
    ['private-ctor', 'passed'],
  ])
})
