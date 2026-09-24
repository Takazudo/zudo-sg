import { expect, type Page } from "@playwright/test";

export type AppearanceTheme = "light" | "dark";

/** Choose an explicit site appearance through zudo-doc's header menu. */
export async function setAppearanceTheme(
  page: Page,
  theme: AppearanceTheme,
): Promise<void> {
  const label = theme === "light" ? "Light" : "Dark";
  const trigger = page
    .getByRole("banner")
    .getByRole("button", { name: /^Appearance:/ });

  await expect(trigger).toBeVisible();
  await expect(trigger).toBeEnabled();

  if ((await trigger.getAttribute("aria-label")) !== `Appearance: ${label}`) {
    await trigger.click();
    const choice = page.getByRole("menuitemradio", { name: label, exact: true });
    await expect(choice).toBeVisible();
    await choice.click();
  }

  await expect(trigger).toHaveAttribute("aria-label", `Appearance: ${label}`);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}
