import { test, expect } from '@playwright/test';

test.describe('Realtime Updates', () => {
  test('rates table loads on landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/top currency pairs/i)).toBeVisible();
    await expect(page.locator('.rates-table')).toBeVisible({ timeout: 10000 });
  });

  test('rates table shows currency pairs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/eur\/usd/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('rates table has action buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /select/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('select button in rates table updates converter', async ({ page }) => {
    await page.goto('/');
    const selectButtons = page.getByRole('button', { name: /select/i });
    await expect(selectButtons.first()).toBeVisible({ timeout: 10000 });
    await selectButtons.first().click();
    const fromSelect = page.getByLabelText(/source currency/i);
    await expect(fromSelect).toBeVisible();
  });
});
