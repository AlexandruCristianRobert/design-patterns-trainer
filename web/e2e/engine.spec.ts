import { expect, test } from '@playwright/test'

test('grades a Singleton in the browser and survives a check that overflows the stack', async ({ page }) => {
  await page.goto('/dev/engine')
  const text = await page.getByTestId('engine-results').textContent({ timeout: 90_000 })
  const results = JSON.parse(text ?? '[]') as { id: string; status: string; reason?: string; args?: object }[]
  expect(results.map((r) => [r.id, r.status])).toEqual([
    ['same-instance', 'passed'],
    ['overflow', 'errored'],
    ['private-ctor', 'passed'],
  ])
  expect(results[1]).toMatchObject({ reason: 'threw', args: { type: 'System.StackOverflowException' } })
})
