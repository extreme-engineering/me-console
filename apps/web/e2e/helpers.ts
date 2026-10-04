import { expect, type Page } from '@playwright/test';

// 每个用例通过 /register 页面注册独立用户：本地模式下账号写入该上下文的
// IndexedDB，setAuth 后跳转到首页（Today），后续用例步骤直接复用该会话。
export async function registerAndOpenToday(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.dev`;
  await page.goto('/#/register');
  await page.fill('#name', 'E2E 用户');
  await page.fill('#email', email);
  await page.fill('#password', 'e2epassword');
  await page.getByRole('button', { name: '注册' }).click();
  await expect(page).toHaveURL(/\/#\/$/);
  await expect(page.getByPlaceholder('快速添加待办...')).toBeVisible();
  return email;
}

export async function addTodoViaToday(page: Page, title: string) {
  const input = page.getByPlaceholder('快速添加待办...');
  await input.fill(title);
  await page.getByRole('button', { name: '添加', exact: true }).click();
  const item = page.locator('div.card', { hasText: title });
  await expect(item).toBeVisible();
  return item;
}
