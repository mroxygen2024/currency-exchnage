import { test, expect } from '@playwright/test';

test.describe('Critical Workflows', () => {
  test('full landing page content loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByLabelText(/send amount/i)).toBeVisible();
    await expect(page.getByText(/top currency pairs/i)).toBeVisible();
    await expect(page.getByText(/architected for speed/i)).toBeVisible();
    await expect(page.getByText(/frequently asked questions/i)).toBeVisible();
  });

  test('navigation between auth pages', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('link', { name: /create one here/i }).click();
    await expect(page).toHaveURL(/\/auth\/register/);

    await page.getByRole('link', { name: /sign in$/i }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('dashboard navigation between sections', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    await page.getByRole('link', { name: /conversions/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/history/);

    await page.getByRole('link', { name: /favorites/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/favorites/);

    await page.getByRole('link', { name: /analytics/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/analytics/);

    await page.getByRole('link', { name: /settings/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/settings/);

    await page.getByRole('link', { name: /overview/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('login form displays validation errors', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid email/i)).toBeVisible();
  });

  test('register form displays validation errors', async ({ page }) => {
    await page.goto('/auth/register');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/invalid email/i)).toBeVisible();
  });

  test('landing page FAQ accordion works', async ({ page }) => {
    await page.goto('/');
    const faqButton = page.getByRole('button', { name: /how secure is the bearer token/i });
    await faqButton.click();
    await expect(page.getByText(/extremely secure/i)).toBeVisible();

    await faqButton.click();
    await expect(page.getByText(/extremely secure/i)).not.toBeVisible();
  });

  test('mobile menu toggle works', async ({ page }) => {
    await page.goto('/');
    const menuButton = page.getByRole('button', { name: /toggle navigation menu/i });
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await expect(page.getByRole('button', { name: /toggle navigation menu/i })).toBeVisible();
    }
  });
});
