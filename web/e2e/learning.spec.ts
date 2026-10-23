import { expect, test } from '@playwright/test'
import { getCode, observerSolution, setCode, waitReady } from './helpers'

const sections = ['Problem', 'Analogy', 'Structure', 'How it runs', 'C# example', 'When to use it']

test('catalog lists 23 patterns and opens the Observer lesson', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.cat-row')).toHaveCount(23)
  await page.getByRole('link', { name: 'Observer' }).click()
  await expect(page).toHaveURL(/\/patterns\/observer$/)
  for (const name of sections) await expect(page.getByRole('heading', { level: 2, name })).toBeVisible({ timeout: 30_000 })
})

test('scene steps and the diagram link to example lines', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/patterns/observer')
  await expect(page.getByRole('heading', { level: 2, name: 'How it runs' })).toBeVisible({ timeout: 30_000 })

  const caption = page.getByTestId('scene-caption')
  const first = await caption.textContent()
  await page.getByRole('button', { name: 'Next step' }).click()
  await expect(caption).not.toHaveText(first ?? '')

  await page.getByTestId('class-observer').focus()
  await expect(page.locator('.code-editor .line-linked').first()).toBeVisible()
})

test('solves the complete exercise with its solution', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/patterns/observer/practice/complete')
  await waitReady(page)
  await setCode(page, observerSolution('complete'))
  await page.getByRole('button', { name: /^Check/ }).click()
  await expect(page.getByText('Solved — every check passed.')).toBeVisible({ timeout: 60_000 })

  await page.goto('/')
  await expect(page.getByRole('img', { name: 'Exercise 1: Solved' })).toBeVisible()
})

test('a hint before solving gives Solved with help', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/patterns/observer/practice/refactor')
  await waitReady(page)
  await page.getByRole('button', { name: /^Show hint 1 of/ }).click()
  await expect(page.locator('.hint')).toHaveCount(1)
  await setCode(page, observerSolution('refactor'))
  await page.getByRole('button', { name: /^Check/ }).click()
  await expect(page.getByText('Solved with help — every check passed.')).toBeVisible({ timeout: 60_000 })
})

test('drafts survive a reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/patterns/observer/practice/build')
  await waitReady(page)
  const mine = '// my draft survives\n' + observerSolution('build').slice(0, 60)
  await setCode(page, mine)
  await page.waitForTimeout(700) // autosave fires 500 ms after the last keystroke
  await page.reload()
  await waitReady(page)
  await expect.poll(() => getCode(page)).toContain('// my draft survives')
})

test('export then import restores progress', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/patterns/observer/practice/complete')
  await waitReady(page)
  await setCode(page, observerSolution('complete'))
  await page.getByRole('button', { name: /^Check/ }).click()
  await expect(page.getByText('Solved — every check passed.')).toBeVisible({ timeout: 60_000 })

  await page.goto('/progress')
  await expect(page.getByText('1 of 3 exercises solved')).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export progress' }).click()
  const file = testInfo.outputPath('progress.json')
  await (await download).saveAs(file)

  // Wipe the site data. The open connection holds the delete until the reload closes it.
  await page.evaluate(() => void indexedDB.deleteDatabase('design-patterns-trainer'))
  await page.reload()
  await expect(page.getByText('Nothing here yet — open a pattern in the Catalog to start.')).toBeVisible()

  await page.getByLabel('Import progress').setInputFiles(file)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Imported progress' })).toBeVisible()
  await expect(page.getByText('1 of 3 exercises solved')).toBeVisible()
})
