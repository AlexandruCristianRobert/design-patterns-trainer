import { expect, test, type Page } from '@playwright/test'
import { examSolutions, getCode, questionTitle, setCode, waitReady } from './helpers'

const questionNav = (page: Page) => page.getByRole('navigation', { name: 'Questions' })

async function startExam(page: Page, opts: { count?: number; named?: boolean } = {}) {
  await page.goto('/exam')
  if (opts.count !== undefined) await page.getByLabel('Number of questions').fill(String(opts.count))
  if (opts.named) await page.getByRole('switch', { name: 'Named mode' }).click()
  await page.getByRole('button', { name: 'Start exam' }).click()
  await expect(page).toHaveURL(/\/exam\/[0-9a-f-]+$/)
  await waitReady(page)
}

async function submit(page: Page) {
  await page.getByRole('button', { name: 'Submit exam' }).click()
  await page.getByRole('group', { name: /Submit your exam/ }).getByRole('button', { name: 'Submit exam' }).click()
  await expect(page).toHaveURL(/\/exam\/[0-9a-f-]+\/report$/, { timeout: 120_000 })
  await expect(page.getByRole('heading', { level: 1, name: 'Exam report' })).toBeVisible()
}

test('named exam with Observer solutions passes', async ({ page }) => {
  const bySolution = examSolutions()
  await startExam(page, { named: true })
  await expect(page.getByLabel('Which pattern does this call for?')).toHaveCount(0)
  for (let n = 1; n <= 3; n++) {
    await questionNav(page).getByRole('button', { name: new RegExp(`Question ${n}`) }).click()
    await expect(page.getByRole('heading', { level: 1, name: `Question ${n} of 3` })).toBeVisible()
    await setCode(page, bySolution[await questionTitle(page)])
  }
  await submit(page)
  await expect(page.getByText('Passed', { exact: true })).toBeVisible()
  await expect(page.getByText(/checks passed · 100%/)).toHaveCount(3)

  await page.goto('/')
  await expect(page.locator('.score').filter({ hasText: 'Best exam' }).filter({ hasText: '100%' })).toHaveCount(1)
})

test('unnamed exam scores identification', async ({ page }) => {
  const bySolution = examSolutions()
  await startExam(page, { count: 1 })
  await page.getByLabel('Which pattern does this call for?').selectOption('strategy')
  await setCode(page, bySolution[await questionTitle(page)])
  await submit(page)
  await expect(page.getByText(/checks passed · 80%/)).toBeVisible()
  await expect(page.getByText('Incorrect')).toBeVisible()
})

test('answers survive a reload mid-exam', async ({ page }) => {
  await startExam(page, { count: 1 })
  const code = '// my saved answer\n'
  await page.getByLabel('Which pattern does this call for?').selectOption('observer')
  await setCode(page, code)
  await page.waitForTimeout(700) // the answer is saved 500 ms after typing
  await page.reload()
  await expect(page.getByLabel('Which pattern does this call for?')).toHaveValue('observer')
  await expect.poll(() => getCode(page)).toBe(code)
})

test('an expired exam is auto-submitted on return', async ({ page }) => {
  await page.clock.install()
  await startExam(page, { count: 1 })
  await page.getByRole('link', { name: 'Progress' }).click()
  await expect(page.getByText(/Exam in progress — \d+:\d\d left\./)).toBeVisible()
  await page.clock.fastForward('16:00')
  await expect(page.getByText(/Exam in progress/)).toHaveCount(0, { timeout: 120_000 })
  await page.getByRole('link', { name: /^View report/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Exam report' })).toBeVisible()
  await expect(page.getByText('Submitted when time ran out')).toBeVisible()
})

test('abandon logs the exam without a score', async ({ page }) => {
  await startExam(page, { count: 1 })
  await page.goto('/exam')
  await page.getByRole('button', { name: 'Abandon exam' }).click()
  await page.getByRole('group').getByRole('button', { name: 'Abandon exam' }).click()
  await expect(page.getByRole('button', { name: 'Start exam' })).toBeVisible()
  await page.goto('/progress')
  await expect(page.getByText('Abandoned', { exact: true })).toBeVisible()
})
