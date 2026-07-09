import { test, expect } from '@playwright/test';
import { testUser } from './fixtures/test-data';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('landing page shows sign in and get started buttons for guests', async ({ page }) => {
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /get started/i })).toBeVisible();
  });

  test('navigates to login page', async ({ page }) => {
    await page.getByRole('link', { name: /sign in/i }).first().click();
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('navigates to register page', async ({ page }) => {
    await page.getByRole('link', { name: /get started/i }).first().click();
    await expect(page).toHaveURL(/\/auth\/register/);
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });

  test('login form validation shows errors for empty fields', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid email/i)).toBeVisible();
  });

  test('register form validation shows errors for empty fields', async ({ page }) => {
    await page.goto('/auth/register');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/invalid email/i)).toBeVisible();
  });

  test('login link in register page navigates to login', async ({ page }) => {
    await page.goto('/auth/register');
    await page.getByRole('link', { name: /sign in$/i }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('register link in login page navigates to register', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('link', { name: /create one here/i }).click();
    await expect(page).toHaveURL(/\/auth\/register/);
  });

  test('protected route redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
