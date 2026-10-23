import { expect, test } from "@playwright/test";

const shots = process.env.SHOT_DIR;

for (const width of [390, 1440]) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test("sets up an exam, shows the banner elsewhere, and offers Resume or Abandon", async ({
      page,
    }) => {
      await page.goto("/exam");
      await expect(
        page.getByRole("heading", { level: 1, name: "Exam" }),
      ).toBeVisible();
      await expect(page.getByLabel("Number of questions")).toHaveValue("3");
      await expect(page.getByText("45 minutes")).toBeVisible();
      if (shots)
        await page.screenshot({
          path: `${shots}/setup-${page.viewportSize()!.width}.png`,
          fullPage: true,
        });

      // Keyboard: the switches toggle with Space.
      await page.getByRole("switch", { name: "Named mode" }).focus();
      await page.keyboard.press("Space");
      await expect(
        page.getByRole("switch", { name: "Named mode" }),
      ).toBeChecked();

      await page.getByRole("button", { name: "Start exam" }).click();
      await expect(page).toHaveURL(/\/exam\/[0-9a-f-]+$/);
      await expect(page.getByText(/Exam in progress/)).toHaveCount(0);

      await page.getByRole("link", { name: "Progress" }).click();
      await expect(
        page.getByText(/Exam in progress — \d+:\d\d left\./),
      ).toBeVisible();
      if (shots)
        await page.screenshot({
          path: `${shots}/banner-${page.viewportSize()!.width}.png`,
        });

      await page.getByRole("link", { name: "Exam", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "You have an exam in progress" }),
      ).toBeVisible();
      if (shots)
        await page.screenshot({
          path: `${shots}/resume-${page.viewportSize()!.width}.png`,
          fullPage: true,
        });
      await page.getByRole("button", { name: "Abandon exam" }).click();
      await expect(page.getByRole("button", { name: "Keep it" })).toBeFocused();
      if (shots)
        await page.screenshot({
          path: `${shots}/confirm-${page.viewportSize()!.width}.png`,
          fullPage: true,
        });
      await page
        .getByRole("group")
        .getByRole("button", { name: "Abandon exam" })
        .click();
      await expect(
        page.getByRole("button", { name: "Start exam" }),
      ).toBeVisible();
      await expect(page.getByText(/Exam in progress/)).toHaveCount(0);
    });
  });
}
