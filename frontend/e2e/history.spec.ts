import { test, expect } from '@playwright/test';

test.describe('Conversion History', () => {
  test('history page is accessible when authenticated', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await page.goto('/dashboard/history');
    await expect(page.getByText(/conversion history/i)).toBeVisible({ timeout: 10000 });
  });

  test('history page shows search input', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await page.goto('/dashboard/history');
    await expect(page.getByPlaceholder(/search/i)).toBeVisible({ timeout: 10000 });
  });

  test('history page has export button', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await page.goto('/dashboard/history');
    await expect(page.getByRole('button', { name: /export/i })).toBeVisible({ timeout: 10000 });
  });

  test('unauthenticated user redirected from history', async ({ page }) => {
    await page.goto('/dashboard/history');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
