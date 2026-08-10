import { expect, test } from "@playwright/test";

test("records, persists, and deletes a casual game", async ({ page }) => {
  await page.goto("/#/casual");

  await page.getByLabel("Opponent", { exact: true }).fill("Catherine");
  await page.getByLabel("My town").selectOption("Castle");
  await page.getByLabel("Opponent town").selectOption("Dungeon");
  await page.getByLabel("Result").selectOption("win");
  await page.getByLabel("Notes").fill("E2E smoke test");
  await page.getByRole("button", { name: "Save game" }).click();

  const gamesRecorded = page
    .locator(".metric-card")
    .filter({ hasText: "Games recorded" });
  await expect(gamesRecorded.getByText("1", { exact: true })).toBeVisible();
  await expect(page.getByRole("row", { name: /Catherine/ })).toContainText(
    "Castle"
  );

  await page.reload();
  await expect(page.getByRole("row", { name: /Catherine/ })).toContainText(
    "E2E smoke test"
  );

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("row", { name: /Catherine/ }).getByRole("button", {
    name: "Delete"
  }).click();

  await expect(gamesRecorded.getByText("0", { exact: true })).toBeVisible();
  await expect(page.getByText("No casual games recorded yet.")).toBeVisible();
});
