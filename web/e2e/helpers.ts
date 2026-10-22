import { expect, type Page } from '@playwright/test'

declare global {
  interface Window {
    monaco: { editor: { getModels(): { setValue(v: string): void }[] } }
  }
}

export async function setCode(page: Page, code: string) {
  await page.waitForFunction(() => window.monaco?.editor.getModels().length > 0)
  await page.evaluate((c) => window.monaco.editor.getModels()[0].setValue(c), code)
}

export async function waitReady(page: Page) {
  await expect(page.locator('[data-state="ready"]')).toBeVisible({ timeout: 90_000 })
}
