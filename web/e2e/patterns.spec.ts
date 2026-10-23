import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { setCode, waitReady } from './helpers'

const patternsRoot = new URL('../../content/patterns/', import.meta.url)
const headings = ['Problem', 'Analogy', 'Structure', 'How it runs', 'C# example', 'When to use it']

/** The first Exercise id of a Pattern, read from its pattern.yaml. */
function firstExercise(pattern: string): string {
  const yaml = readFileSync(new URL(`${pattern}/pattern.yaml`, patternsRoot), 'utf8')
  return /^exercises:\s*\[\s*([\w-]+)/m.exec(yaml)![1]
}

const solution = (pattern: string, exercise: string) => readFileSync(new URL(`${pattern}/exercises/${exercise}/solution.cs`, patternsRoot), 'utf8')

// Smoke test of the first-release Patterns: the Lesson renders, fits a phone, and its first Exercise is solvable in the real engine.
for (const pattern of ['strategy', 'decorator', 'factory-method', 'singleton']) {
  test(`the ${pattern} Lesson renders and its first Exercise is solved by the reference solution`, async ({ page }) => {
    const exercise = firstExercise(pattern)

    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto(`/patterns/${pattern}`)
    for (const name of headings) await expect(page.getByRole('heading', { level: 2, name })).toBeVisible({ timeout: 30_000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/patterns/${pattern}/practice/${exercise}`)
    await waitReady(page)
    await setCode(page, solution(pattern, exercise))
    await page.getByRole('button', { name: /^Check/ }).click()
    await expect(page.getByText('Solved — every check passed.')).toBeVisible({ timeout: 60_000 })
  })
}
