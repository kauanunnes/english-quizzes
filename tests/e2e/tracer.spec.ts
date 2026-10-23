import { test, expect } from '@playwright/test';

// Fase 1 (docs/10 F1) com upstreams sintéticos e LLM falsa (playwright.config.ts)
test('o tracer gera o quiz do episódio fixo e a segunda abertura vem do cache', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/tracer');
  await page.getByLabel('Código de acesso').fill('e2e-access-code');
  await page.getByRole('button', { name: 'Gerar quiz' }).click();

  // Os dois navegadores rodam em paralelo contra o mesmo servidor: o 2º pode pegar o job ativo ou o quiz pronto
  const summary = page.getByText(/\d+ blocos · \d+ perguntas/);
  await expect(summary).toBeVisible({ timeout: 60_000 });
  expect(await page.getByRole('heading', { level: 2 }).count()).toBeGreaterThanOrEqual(3);

  await page.getByRole('button', { name: 'Mostrar resposta' }).first().click();
  await expect(page.getByText(/^Resposta: [a-d]\)/).first()).toBeVisible();

  await page.getByRole('button', { name: 'Abrir de novo' }).click();
  await expect(page.getByText(/do cache/)).toBeVisible();
});

test('código errado mostra "Código inválido." sem gerar nada', async ({ page }) => {
  await page.goto('/tracer');
  await page.getByLabel('Código de acesso').fill('codigo-errado');
  await page.getByRole('button', { name: 'Gerar quiz' }).click();
  // O Next também injeta um anunciador de rota com role="alert": filtra pelo texto
  await expect(page.getByRole('alert').filter({ hasText: 'Código inválido.' })).toBeVisible();
});
