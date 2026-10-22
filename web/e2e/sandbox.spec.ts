import { expect, test } from '@playwright/test'
import { setCode, waitReady } from './helpers'

test('runs hello world', async ({ page }) => {
  await page.goto('/sandbox')
  await waitReady(page)
  await page.getByRole('button', { name: 'Run' }).click()
  await expect(page.getByText('Hello, patterns!')).toBeVisible({ timeout: 20_000 })
})

test('stops an infinite loop after 5 s and recovers', async ({ page }) => {
  await page.goto('/sandbox')
  await waitReady(page)
  await setCode(page, 'while (true) { Console.Write("x"); }')
  await page.getByRole('button', { name: 'Run' }).click()
  await expect(
    page.getByText('Stopped after 5 seconds — your program may contain an infinite loop.'),
  ).toBeVisible({ timeout: 20_000 })
  await setCode(page, 'Console.WriteLine("back");')
  await page.getByRole('button', { name: 'Run' }).click()
  await expect(page.getByText('back', { exact: true })).toBeVisible({ timeout: 20_000 })
})

test('infinite recursion shows crash message, then hello world runs', async ({ page }) => {
  await page.goto('/sandbox')
  await waitReady(page)
  await setCode(page, 'Console.WriteLine(F(0));\nstatic int F(int n) => F(n + 1) + 1;')
  await page.getByRole('button', { name: 'Run' }).click()
  await expect(
    page.getByText('Your program crashed — this is often infinite recursion (a stack overflow).'),
  ).toBeVisible({ timeout: 20_000 })
  await setCode(page, 'Console.WriteLine("Hello, world!");')
  await page.getByRole('button', { name: 'Run' }).click()
  await expect(page.getByText('Hello, world!', { exact: true })).toBeVisible({ timeout: 60_000 })
})

test('shows a live error squiggle', async ({ page }) => {
  await page.goto('/sandbox')
  await waitReady(page)
  await setCode(page, 'var x = y;')
  await expect(page.locator('.squiggly-error').first()).toBeVisible({ timeout: 10_000 })
})

test('reports DP0001 for Console.ReadLine', async ({ page }) => {
  await page.goto('/sandbox')
  await waitReady(page)
  await setCode(page, 'var s = Console.ReadLine();')
  await page.getByRole('button', { name: 'Run' }).click()
  await expect(page.getByText('Not available in the browser runtime: System.Console.ReadLine')).toBeVisible({ timeout: 20_000 })
})
