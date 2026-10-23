import { readFileSync } from 'node:fs'
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
