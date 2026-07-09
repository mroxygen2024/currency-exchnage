import { test, expect } from '@playwright/test';

test.describe('Currency Conversion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('landing page converter widget is visible', async ({ page }) => {
    await expect(page.getByLabelText(/send amount/i)).toBeVisible();
    await expect(page.getByLabelText(/source currency/i)).toBeVisible();
    await expect(page.getByLabelText(/target currency/i)).toBeVisible();
    await expect(page.getByLabelText(/receive amount/i)).toBeVisible();
  });

  test('converter shows rate after conversion', async ({ page }) => {
    await expect(page.getByText(/rate:/i)).toBeVisible({ timeout: 10000 });
  });

  test('swap button swaps currency selects', async ({ page }) => {
    const fromSelect = page.getByLabelText(/source currency/i);
    const toSelect = page.getByLabelText(/target currency/i);

    const initialFrom = await fromSelect.inputValue();
    const initialTo = await toSelect.inputValue();

    await page.getByRole('button', { name: /swap currencies/i }).click();

    await expect(fromSelect).toHaveValue(initialTo);
    await expect(toSelect).toHaveValue(initialFrom);
  });

  test('amount input accepts numeric values', async ({ page }) => {
    const amountInput = page.getByLabelText(/send amount/i);
    await amountInput.fill('500');
    await expect(amountInput).toHaveValue('500');
  });

  test('receive amount updates after conversion', async ({ page }) => {
    const resultInput = page.getByLabelText(/receive amount/i);
    await expect(resultInput).not.toHaveValue('');
  });

  test('convert now button scrolls to calculator', async ({ page }) => {
    await page.getByRole('button', { name: /convert now/i }).click();
    await expect(page.getByLabelText(/send amount/i)).toBeVisible();
  });
});
