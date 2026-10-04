import { expect, test } from '@playwright/test';
import { registerAndOpenToday } from './helpers';

test('商机看板：新建、改阶段、删除', async ({ page }) => {
  await registerAndOpenToday(page);

  await page.goto('/#/opportunity?tab=fde');
  await expect(page.getByRole('heading', { name: '还没有FDE商机' })).toBeVisible();

  // 新建商机
  await page.getByRole('button', { name: '新增商机' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('如：意定监护合作').fill('e2e 冒烟商机');
  await dialog.getByPlaceholder('如：意安顿健康科技（重庆）有限公司').fill('e2e 公司');
  await dialog.getByRole('button', { name: '创建' }).click();

  // 卡片出现在「线索」列，统计同步
  await expect(page.locator('text=e2e 冒烟商机')).toBeVisible();
  await expect(page.getByText('商机总数', { exact: true })).toBeVisible();

  // 卡片下拉改阶段：线索 → 已接触
  const cardSelect = page.getByRole('combobox').filter({ hasText: '线索' }).last();
  await cardSelect.selectOption({ label: '已接触' });
  await expect(page.locator('div', { hasText: 'e2e 冒烟商机' }).first()).toBeVisible();

  // 删除：卡片上的删除按钮 + 确认
  await page.getByRole('button', { name: '删除商机' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '删除' }).click();
  await expect(page.getByRole('heading', { name: '还没有FDE商机' })).toBeVisible();
});
