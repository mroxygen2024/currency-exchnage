import { test, expect } from '@playwright/test';

test.describe('Notifications', () => {
  test('notifications bell is visible in dashboard', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.getByRole('button', { name: /system notifications/i })).toBeVisible();
  });

  test('clicking notifications bell opens dropdown', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await page.getByRole('button', { name: /system notifications/i }).click();
    await expect(page.getByRole('menu', { name: /notifications/i })).toBeVisible();
  });

  test('notifications dropdown shows alert rules', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await page.getByRole('button', { name: /system notifications/i }).click();
    await expect(page.getByText(/usd\/eur/i)).toBeVisible({ timeout: 10000 });
  });
});
