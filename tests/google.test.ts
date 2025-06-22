import test from "@playwright/test";

test.describe("google test", () => {
  test("Googleのサイトが表示されているか", async ({ page }) => {
    await page.goto("https://www.google.com/");
  });
});
