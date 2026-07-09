import { test, expect } from '@playwright/test';

test.describe('Favorites Management', () => {
  test('favorites page is accessible when authenticated', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await page.goto('/dashboard/favorites');
    await expect(page.getByText(/favorites/i)).toBeVisible({ timeout: 10000 });
  });

  test('favorites page shows favorite cards', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await page.goto('/dashboard/favorites');
    await expect(page.locator('[data-testid^="fav-card-"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('favorites page shows add form', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await page.goto('/dashboard/favorites');
    await expect(page.getByRole('button', { name: /add favorite/i })).toBeVisible({ timeout: 10000 });
  });

  test('unauthenticated user redirected from favorites', async ({ page }) => {
    await page.goto('/dashboard/favorites');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
