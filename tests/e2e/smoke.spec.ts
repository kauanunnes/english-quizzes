import { test, expect } from '@playwright/test';

test('a tela inicial abre com a marca do app', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Segunda Tela');
  await expect(page.getByRole('link', { name: /Segunda Tela/ })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Pratique listening');
});

test('/api/health responde ok', async ({ request }) => {
  const response = await request.get('/api/health');

  expect(response.ok()).toBe(true);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(await response.json()).toMatchObject({ status: 'ok' });
});
