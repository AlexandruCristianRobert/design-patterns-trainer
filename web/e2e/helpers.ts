import { readdirSync, readFileSync } from 'node:fs'
import { expect, type Page } from '@playwright/test'

declare global {
  interface Window {
    monaco: { editor: { getModels(): { setValue(v: string): void; getValue(): string }[] } }
  }
}

export async function setCode(page: Page, code: string) {
  await page.waitForFunction(() => window.monaco?.editor.getModels().length > 0)
  await page.evaluate((c) => window.monaco.editor.getModels()[0].setValue(c), code)
}

export async function waitReady(page: Page) {
  await expect(page.locator('[data-state="ready"]')).toBeVisible({ timeout: 90_000 })
}

export async function getCode(page: Page): Promise<string> {
  await page.waitForFunction(() => window.monaco?.editor.getModels().length > 0)
  return page.evaluate(() => window.monaco.editor.getModels()[0].getValue())
}

/** The reference solution of an Observer exercise, read from the content folder. */
export function observerSolution(exerciseId: string): string {
  return readFileSync(new URL(`../../content/patterns/observer/exercises/${exerciseId}/solution.cs`, import.meta.url), 'utf8')
}

const examRoot = new URL('../../content/patterns/observer/exam/', import.meta.url)

/** Observer exam question title -> reference solution, read from the content folder. */
export function examSolutions(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const id of readdirSync(examRoot)) {
    const text = readFileSync(new URL(`${id}/text.en.yaml`, examRoot), 'utf8')
    const title = /^title:\s*"?(.+?)"?\s*$/m.exec(text)![1]
    out[title] = readFileSync(new URL(`${id}/solution.cs`, examRoot), 'utf8')
  }
  return out
}

/** The on-screen question's title (its first level-2 heading), trimmed. */
export async function questionTitle(page: Page): Promise<string> {
  return ((await page.getByRole('heading', { level: 2 }).first().textContent()) ?? '').trim()
}
